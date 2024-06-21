'use strict'

const { parentPort, workerData, threadId } = require('worker_threads')   
const fastify = require('fastify')
const { wire } = require('../../')

const app = fastify()

app.get('/', async (req, reply) => { 
  reply.send({ hello: workerData?.message || 'world' })
})

app.get('/whoami', async (req, reply) => { 
  reply.send({ threadId })
})

wire(app, parentPort)
