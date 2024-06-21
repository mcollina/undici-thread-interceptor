'use strict'

const { parentPort } = require('worker_threads')
const fastify = require('fastify')
const { wire } = require('../../')
const { request } = require('undici')

const app = fastify()

wire(app, parentPort, {
  domain: '.local',
})

app.get('/', async (req, reply) => {
  const { body } = await request('http://myserver.local')
  return await body.json()
})
