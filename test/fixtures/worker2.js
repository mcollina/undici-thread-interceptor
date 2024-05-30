'use strict'

const { parentPort, workerData } = require('worker_threads')   
const fastify = require('fastify')
const { wire, createThreadInterceptor } = require('../../')
const { request, agent } = require('undici')

const app = fastify()

wire(app, parentPort)

app.get('/', async (req, reply) => { 
  const { body, headers } = await request('http://myserver.local')
  return await body.json()
})

