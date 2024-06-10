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

test('two service in a mesh', async (t) => {  
  const worker1 = new Worker(join(__dirname, 'fixtures', 'worker1.js'), {
    workerData: { message: 'mesh' }
  })
  t.after(() => worker1.terminate())
  const worker2 = new Worker(join(__dirname, 'fixtures', 'worker2.js'))
  t.after(() => worker2.terminate())

  const interceptor = createThreadInterceptor({
    domain: '.local'
  })
  interceptor.route('myserver', worker1)
  interceptor.route('myserver2', worker2)

  const agent = new Agent().compose(interceptor)

  const { body, headers } = await request('http://myserver2.local',{
    dispatcher: agent
  })

  deepStrictEqual(await body.json(), { hello: 'mesh' })
})
