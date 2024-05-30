'use strict'

const { parentPort, workerData } = require('worker_threads')   
const fastify = require('fastify')
const { wire } = require('../../')

const app = fastify()

app.get('/', async (req, reply) => { 
  reply.send({ hello: workerData?.message || 'world' })
})

wire(app, parentPort)
