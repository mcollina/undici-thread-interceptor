'use strict'

const { test } = require('node:test')
const { deepStrictEqual, strictEqual } = require('node:assert')
const { join } = require('path')
const { Worker } = require('worker_threads')
const { createThreadInterceptor } = require('../')
const { Agent, request } = require('undici')
const { once } = require('events')
const { setTimeout: sleep } = require('timers/promises')

test('basic', async (t) => {  
  const worker = new Worker(join(__dirname, 'fixtures', 'worker1.js'))
  t.after(() => worker.terminate())

  const interceptor = createThreadInterceptor({
    domain: '.local'
  })
  interceptor.route('myserver', worker)

  const agent = new Agent().compose(interceptor)

  const { statusCode, body, headers } = await request('http://myserver.local',{
    dispatcher: agent
  })

  strictEqual(statusCode, 200)
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

test('two service in a mesh, one is terminated with an inflight message', async (t) => {  
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

  worker1.terminate()

  const res = await request('http://myserver2.local',{
    dispatcher: agent
  })

  strictEqual(res.statusCode, 500)
  deepStrictEqual(await res.body.json(), {
    error: 'Internal Server Error',
    message: 'Worker exited',
    statusCode: 500
  })
})

test('two service in a mesh, one is terminated, then a message is sent', async (t) => {  
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

  worker1.terminate()

  await once(worker1, 'exit')
  await sleep(1000)

  const res = await request('http://myserver2.local',{
    dispatcher: agent
  })

  strictEqual(res.statusCode, 500)
  deepStrictEqual(await res.body.json(), {
    error: 'Internal Server Error',
    message: `No server found for myserver.local in ${worker2.threadId}`,
    statusCode: 500
  })
})
