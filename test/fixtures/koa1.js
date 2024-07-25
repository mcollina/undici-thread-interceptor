'use strict'

const { parentPort, workerData } = require('worker_threads')
const Koa = require('koa')
const { wire } = require('../../')

const app = new Koa()

app.use(ctx => {
  ctx.body = { hello: workerData?.message || 'world' }
})

wire({ server: app.callback(), port: parentPort })
