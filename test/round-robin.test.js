'use strict'

const { test } = require('node:test')
const { deepStrictEqual, rejects } = require('node:assert')
const { join } = require('path')
const { Worker } = require('worker_threads')
const { createThreadInterceptor } = require('../')
const { Agent, request } = require('undici')
const { once } = require('events')

test('round-robin .route with array', async (t) => {  
  const worker1 = new Worker(join(__dirname, 'fixtures', 'worker1.js'), {
    workerData: { message: 'mesh' }
  })
  t.after(() => worker1.terminate())
  const worker2 = new Worker(join(__dirname, 'fixtures', 'worker1.js'))
  t.after(() => worker2.terminate())

  const interceptor = createThreadInterceptor({
    domain: '.local'
  })
  interceptor.route('myserver', [worker1, worker2])

  const agent = new Agent().compose(interceptor)

  {
    const { body, headers } = await request('http://myserver.local/whoami',{
      dispatcher: agent
    })

    deepStrictEqual(await body.json(), { threadId: worker1.threadId })
  }

  {
    const { body, headers } = await request('http://myserver.local/whoami',{
      dispatcher: agent
    })

    deepStrictEqual(await body.json(), { threadId: worker2.threadId })
  }
})

test('round-robin multiple .route', async (t) => {  
  const worker1 = new Worker(join(__dirname, 'fixtures', 'worker1.js'), {
    workerData: { message: 'mesh' }
  })
  t.after(() => worker1.terminate())
  const worker2 = new Worker(join(__dirname, 'fixtures', 'worker1.js'))
  t.after(() => worker2.terminate())

  const interceptor = createThreadInterceptor({
    domain: '.local'
  })
  interceptor.route('myserver', worker1)
  interceptor.route('myserver', worker2)

  const agent = new Agent().compose(interceptor)

  {
    const { body, headers } = await request('http://myserver.local/whoami',{
      dispatcher: agent
    })

    deepStrictEqual(await body.json(), { threadId: worker1.threadId })
  }

  {
    const { body, headers } = await request('http://myserver.local/whoami',{
      dispatcher: agent
    })

    deepStrictEqual(await body.json(), { threadId: worker2.threadId })
  }
})

test('round-robin one worker exits', async (t) => {  
  const worker1 = new Worker(join(__dirname, 'fixtures', 'worker1.js'), {
    workerData: { message: 'mesh' }
  })
  t.after(() => worker1.terminate())
  const worker2 = new Worker(join(__dirname, 'fixtures', 'worker1.js'))
  t.after(() => worker2.terminate())

  const interceptor = createThreadInterceptor({
    domain: '.local'
  })
  interceptor.route('myserver', worker1)
  interceptor.route('myserver', worker2)

  const agent = new Agent().compose(interceptor)

  {
    const { body, headers } = await request('http://myserver.local/whoami',{
      dispatcher: agent
    })

    deepStrictEqual(await body.json(), { threadId: worker1.threadId })
  }

  worker2.terminate()
  // We must wait for the worker to exit
  // otherwise the next request will 
  await once(worker2, 'exit')

  {
    const { body, headers } = await request('http://myserver.local/whoami',{
      dispatcher: agent
    })

    deepStrictEqual(await body.json(), { threadId: worker1.threadId })
  }
})

test('round-robin one worker exits, in flight request', async (t) => {  
  const worker1 = new Worker(join(__dirname, 'fixtures', 'worker1.js'), {
    workerData: { message: 'mesh' }
  })
  t.after(() => worker1.terminate())
  const worker2 = new Worker(join(__dirname, 'fixtures', 'worker1.js'))
  t.after(() => worker2.terminate())

  const interceptor = createThreadInterceptor({
    domain: '.local',
  })
  interceptor.route('myserver', worker1)
  interceptor.route('myserver', worker2)

  const agent = new Agent().compose(interceptor)

  {
    const { body, headers } = await request('http://myserver.local/whoami',{
      dispatcher: agent
    })

    deepStrictEqual(await body.json(), { threadId: worker1.threadId })
  }

  worker2.terminate()

  await rejects(request('http://myserver.local/whoami',{
    dispatcher: agent
  }))
})
