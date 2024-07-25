'use strict'

const { parentPort } = require('worker_threads')
const { wire } = require('../../')

wire(null, parentPort)
