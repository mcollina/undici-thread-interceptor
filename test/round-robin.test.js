'use strict'

const { test } = require('node:test')
const { deepStrictEqual } = require('node:assert')
const { join } = require('path')
const { Worker } = require('worker_threads')
const { createThreadInterceptor } = require('../')
const { Agent, request } = require('undici')

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
