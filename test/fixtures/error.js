'use strict'

const { parentPort } = require('worker_threads')
const { wire } = require('../../')

wire(function (req, res) {
  res.destroy(new Error('kaboom'))
}, parentPort)
