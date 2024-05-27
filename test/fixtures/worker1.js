'use strict'

const { parentPort } = require('worker_threads')   
const fastify = require('fastify')
const { wire } = require('../../')

const app = fastify()

app.get('/', async (req, reply) => { 
  reply.send({ hello: 'world' })
})

wire(app, parentPort)

