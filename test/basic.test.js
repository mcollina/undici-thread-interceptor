'use strict'

const { test } = require('node:test')
const { deepStrictEqual } = require('node:assert')
const { join } = require('path')
const { Worker } = require('worker_threads')
const { createThreadInterceptor } = require('../')
const { Agent, request } = require('undici')

test('basic', async (t) => {  
  const worker = new Worker(join(__dirname, 'fixtures', 'worker1.js'))
  t.after(() => worker.terminate())

  const interceptor = createThreadInterceptor({
    domain: '.local'
  })
  interceptor.route('myserver', worker)

  const agent = new Agent().compose(interceptor)

  const { body, headers } = await request('http://myserver.local',{
    dispatcher: agent
  })

  deepStrictEqual(await body.json(), { hello: 'world' })
})
