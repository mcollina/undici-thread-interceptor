'use strict'

const { parentPort, workerData } = require('worker_threads')
const fastify = require('fastify')
const { wire } = require('../../')

const viaNetwork = workerData?.network
const app = fastify()

app.get('/', (req, reply) => {
  reply.send({ via: viaNetwork ? 'network' : 'thread' })
})

if (viaNetwork) {
  const { replaceServer } = wire({ port: parentPort })

  app.listen({ port: 0 }).then(replaceServer)
} else {
  wire({ server: app, port: parentPort })
}
