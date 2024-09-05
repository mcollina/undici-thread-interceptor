'use strict'

const { parentPort } = require('worker_threads')

function waitForClose (message) {
  if (message === 'close') {
    parentPort.unref()
  }
}

parentPort.on('message', waitForClose)
