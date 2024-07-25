# undici-thread-interceptor

An Undici agent that routes requests to a worker thread.

Supports:

* load balancing (round robin)
* mesh networking between the worker threads

## Installation

```bash
npm install undici undici-thread-interceptor
```

## Usage

In `main.js`:

```javascript
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { createThreadInterceptor } from 'undici-thread-interceptor'
import { Agent, request } from 'undici'

const worker = new Worker(join(import.meta.dirname, 'worker.js'))

const interceptor = createThreadInterceptor({
  domain: '.local', // The prefix for all local domains
})
interceptor.route('myserver', worker)

const agent = new Agent().compose(interceptor)

const { statusCode, body } = await request('http://myserver.local', {
  dispatcher: agent,
})

console.log(statusCode, await body.json())

// worker.terminate()
```

In `worker.js`:

```javascript
import { wire } from 'undici-thread-interceptor'
import { parentPort } from 'node:worker_threads'
import express from 'express'
import fastify from 'fastify'
import Koa from 'koa'

function app (req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ hello: 'world' }))
}

wire(app, parentPort)

// or using fastify

const app = fastify()

app.get('/', (req, reply) => {
  reply.send({ hello: 'world' })
})

// Or using express
const app = express()

app.get('/', (req, res) => {
  res.send({ hello: 'world' })
})

wire(app, parentPort)

// or using Koa

const app = new Koa()

app.use(ctx => {
  ctx.body = { hello: workerData?.message || 'world' }
})

wire(app.callback(), parentPort)
```

## API

TBD

## License

MIT
