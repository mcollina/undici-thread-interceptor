'use strict'

const { Dispatcher } = require('undici')
const hyperid = require('hyperid')
const { getGlobalDispatcher, setGlobalDispatcher} = require('undici')
const { threadId } = require('worker_threads')

function createThreadInterceptor (opts) {
  const routes = new Map()
  const inFlights = new Map()
  const domain = opts?.domain
  const nextId = hyperid()
  const routing = opts?.routing ?? true
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
        otherPort.postMessage({ type: 'route', url })
        port.postMessage({ type: 'route', url: key })
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
      } else if (msg.type === 'request' && routing) {
        const opts = msg.opts
        try {
          let url = opts.origin
          if (!(url instanceof URL)) {
            url = new URL(opts.path, url)
          }

          const destinationPort = routes.get(url.hostname)
          if (!destinationPort) {
            throw new Error('No server found for ' + url.hostname + ' in ' + threadId)
          }

          destinationPort.postMessage(msg)
          inFlights.set(msg.id, (err, res) => {
            if (err) {
              port.postMessage({ type: 'response', id: msg.id, err })
              return
            }

            port.postMessage({ type: 'response', id: msg.id, res })
          })
        } catch (err) {
          port.postMessage({ type: 'response', id: msg.id, err })
        }
      }
    })
  }

  return res
}

function wire (server, port) {
  const interceptor = createThreadInterceptor({
    routing: false
  })
  setGlobalDispatcher(getGlobalDispatcher().compose(interceptor))
  port.on('message', (msg) => {
    if (msg.type === 'request') {
      const { id, opts } = msg
      server.inject({
        method: opts.method,
        url: opts.path,
        headers: opts.headers,
        query: opts.query,
        body: opts.body
      }).then(res => {
        port.postMessage({
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
      interceptor.route(msg.url, port, false)
    }
  })
  return interceptor
}

module.exports.createThreadInterceptor = createThreadInterceptor
module.exports.wire = wire
