'use strict'

const { Dispatcher } = require('undici')
const hyperid = require('hyperid')
const { getGlobalDispatcher, setGlobalDispatcher} = require('undici')
const { threadId, MessageChannel } = require('worker_threads')

function createThreadInterceptor (opts) {
  const routes = new Map()
  const inFlights = new Map()
  const domain = opts?.domain
  const nextId = hyperid()
  const res = (dispatch) => {
    return (opts, handler) => {
      let url = opts.origin
      if (!(url instanceof URL)) {
        url = new URL(opts.path, url)
      }

      const wrap = routes.get(url.hostname)
      if (!wrap) {
        if (dispatch && (domain === undefined || !url.hostname.endsWith(domain))) {
          return dispatch(opts, handler)
        } else {
          throw new Error('No server found for ' + url.hostname + ' in ' + threadId)
        }
      }

      const port = wrap

      if (opts.headers) {
        delete opts.headers.connection
        delete opts.headers['transfer-encoding']
      }

      const id = nextId()
      const newOpts = {
        ...opts
      }
      delete newOpts.dispatcher

      port.postMessage({ type: 'request', id, opts: newOpts, threadId })
      inFlights.set(id, (err, res) => {
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
    if (domain && !url.endsWith(domain)) {
      url += domain
    }

    if (forward) {
      for (const [key, otherPort] of routes) {
        const { port1, port2 } = new MessageChannel()
        otherPort.postMessage({ type: 'route', url, port: port2 }, [port2])
        port.postMessage({ type: 'route', url: key, port: port1 }, [port1])
      }
    }

    routes.set(url, port)

    port.on('message', (msg) => {
      if (msg.type === 'response') {
        const { id, res, err } = msg
        const inflight = inFlights.get(id)
        if (inflight) {
          inFlights.delete(id)
          inflight(err, res)
        }
      }
    })
  }

  return res
}

function wire (server, port) {
  const interceptor = createThreadInterceptor()
  setGlobalDispatcher(getGlobalDispatcher().compose(interceptor))
  function onMessage (msg) {
    if (msg.type === 'request') {
      const { id, opts } = msg
      server.inject({
        method: opts.method,
        url: opts.path,
        headers: opts.headers,
        query: opts.query,
        body: opts.body
      }).then(res => {
        // So we route the message back to the port
        // that sent the request
        this.postMessage({
          type: 'response',
          id,
          res: {
            headers: res.headers,
            rawPayload: res.rawPayload
          }
        })
      }).catch(err => {
        port.postMessage({ type: 'response', id, err })
      })
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
