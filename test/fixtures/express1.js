'use strict'

const { parentPort, workerData } = require('worker_threads')
const express = require('express')
const { wire } = require('../../')

const app = express()

app.get('/', (req, res) => {
  res.send({ hello: workerData?.message || 'world' })
})

wire(app, parentPort)
