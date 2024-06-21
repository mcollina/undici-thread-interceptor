'use strict'

const RoundRobin = require('./lib/roundrobin')
const hyperid = require('hyperid')
const { getGlobalDispatcher, setGlobalDispatcher } = require('undici')
const { threadId, MessageChannel } = require('worker_threads')
const inject = require('light-my-request')

function createThreadInterceptor (opts) {
  const routes = new Map()
  const portInflights = new Map()
  const forwarded = new Map()
  const domain = opts?.domain
  const nextId = hyperid()
  const res = (dispatch) => {
    return (opts, handler) => {
      let url = opts.origin
      if (!(url instanceof URL)) {
        url = new URL(opts.path, url)
      }

      const roundRobin = routes.get(url.hostname)
      if (!roundRobin) {
        if (dispatch && (domain === undefined || !url.hostname.endsWith(domain))) {
          return dispatch(opts, handler)
        } else {
          throw new Error('No server found for ' + url.hostname + ' in ' + threadId)
        }
      }

      const port = roundRobin.next()

      if (opts.headers) {
        delete opts.headers.connection
        delete opts.headers['transfer-encoding']
      }

      const id = nextId()
      const newOpts = {
        ...opts,
      }
      delete newOpts.dispatcher

      port.postMessage({ type: 'request', id, opts: newOpts, threadId })
      const inflights = portInflights.get(port)
      inflights.set(id, (err, res) => {
        if (err) {
          handler.onError(err)
          return
        }

        const headers = []
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) {
            for (const v of value) {
              headers.push(key)
              headers.push(v)
            }
          } else {
            headers.push(key)
            headers.push(value)
          }
        }
        handler.onHeaders(res.statusCode, headers, () => {}, res.statusMessage)
        handler.onData(res.rawPayload)
        handler.onComplete([])
      })

      return true
    }
  }

  res.route = (url, port, forward = true) => {
    if (port instanceof Array) {
      for (const p of port) {
        res.route(url, p, forward)
      }
      return
    }

    if (domain && !url.endsWith(domain)) {
      url += domain
    }

    if (!forwarded.has(port)) {
      forwarded.set(port, new Set())
    }

    if (forward) {
      for (const [key, roundRobin] of routes) {
        for (const otherPort of roundRobin) {
          const { port1, port2 } = new MessageChannel()
          forwarded.get(otherPort).add(port2)
          forwarded.get(port).add(port1)
          otherPort.postMessage({ type: 'route', url, port: port2 }, [port2])
          port.postMessage({ type: 'route', url: key, port: port1 }, [port1])
        }
      }
    }

    if (!routes.has(url)) {
      routes.set(url, new RoundRobin())
    }

    routes.get(url).add(port)

    function onClose () {
      const roundRobin = routes.get(url)
      roundRobin.remove(port)
      for (const f of forwarded.get(port)) {
        f.close()
      }
      for (const cb of portInflights.get(port).values()) {
        cb(new Error('Worker exited'))
      }

      if (roundRobin.length === 0) {
        routes.delete(url)
      }
    }

    // If port is a worker, we need to remove it from the routes
    // when it exits
    port.on('exit', onClose)
    port.on('close', onClose)

    const inflights = new Map()
    portInflights.set(port, inflights)
    port.on('message', (msg) => {
      if (msg.type === 'response') {
        const { id, res, err } = msg
        const inflight = inflights.get(id)
        if (inflight) {
          inflights.delete(id)
          inflight(err, res)
        }
      }
    })
  }

  return res
}

function wire (server, port, opts) {
  const interceptor = createThreadInterceptor(opts)
  setGlobalDispatcher(getGlobalDispatcher().compose(interceptor))
  const hasInject = typeof server.inject === 'function'

  function onMessage (msg) {
    if (msg.type === 'request') {
      const { id, opts } = msg

      const injectOpts = {
        method: opts.method,
        url: opts.path,
        headers: opts.headers,
        query: opts.query,
        body: opts.body,
      }

      const onInject = (err, res) => {
        if (err) {
          port.postMessage({ type: 'response', id, err })
          return
        }

        const newRes = {
          headers: res.headers,
          statusCode: res.statusCode,
        }

        if (res.headers['content-length'].indexOf('application/json')) {
          // fast path because it's utf-8, use a string
          newRes.rawPayload = res.payload
        } else {
          // slow path, buffer
          newRes.rawPayload = res.rawPayload
        }

        const forwardRes = {
          type: 'response',
          id,
          res: newRes,
        }

        // So we route the message back to the port
        // that sent the request
        this.postMessage(forwardRes)
      }

      if (hasInject) {
        server.inject(injectOpts, onInject)
      } else {
        inject(server, injectOpts, onInject)
      }
    } else if (msg.type === 'route') {
      interceptor.route(msg.url, msg.port, false)
      msg.port.on('message', onMessage)
    }
  }
  port.on('message', onMessage)
  return interceptor
}

module.exports.createThreadInterceptor = createThreadInterceptor
module.exports.wire = wire
