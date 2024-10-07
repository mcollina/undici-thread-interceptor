'use strict'

const { test } = require('node:test')
const { rejects } = require('node:assert')
const { join } = require('node:path')
const { Worker } = require('node:worker_threads')
const { once } = require('node:events')
const { createThreadInterceptor } = require('../')
const { Agent, request } = require('undici')

test('timeout', async (t) => {
  const empty = new Worker(join(__dirname, 'fixtures', 'empty.js'))

  const interceptor = createThreadInterceptor({
    domain: '.local',
    timeout: 1000,
  })
  interceptor.route('myserver', empty)

  const agent = new Agent().compose(interceptor)

  await rejects(request('http://myserver.local', {
    dispatcher: agent,
  }), new Error('Timeout while waiting from a response from myserver.local'))

  empty.postMessage('close')
  await once(empty, 'exit')
})

test('timeout set to a boolean', async (t) => {
  const empty = new Worker(join(__dirname, 'fixtures', 'empty.js'))

  const interceptor = createThreadInterceptor({
    domain: '.local',
    timeout: true,
  })
  interceptor.route('myserver', empty)

  const agent = new Agent().compose(interceptor)

  await rejects(request('http://myserver.local', {
    dispatcher: agent,
  }), new Error('Timeout while waiting from a response from myserver.local'))

  empty.postMessage('close')
  await once(empty, 'exit')
})
