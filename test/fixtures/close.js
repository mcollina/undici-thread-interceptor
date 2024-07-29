'use strict'

const { parentPort, workerData } = require('worker_threads')
const fastify = require('fastify')
const { wire } = require('../../')

function waitForClose (message) {
  if (message === 'close') {
    parentPort.unref()
    interceptor.close()
  }
}

const app = fastify()

app.get('/', (req, reply) => {
  reply.send({ hello: workerData?.message || 'world' })
})

const { interceptor } = wire({ server: app, port: parentPort })

parentPort.on('message', waitForClose)
