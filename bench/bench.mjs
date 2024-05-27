import { join } from 'path'
import { Worker } from 'worker_threads'
import { createThreadInterceptor } from '../index.js'
import { Agent, request } from 'undici'
import { once } from 'events'

const worker = new Worker(join(import.meta.dirname, '..', 'test', 'fixtures', 'worker1.js'))
await once(worker, 'online')

const interceptor = createThreadInterceptor({
  domain: '.local'
})
interceptor.route('myserver', worker)

const agent = new Agent().compose(interceptor)

console.time('request')
let responses = []
for (let i = 0; i < 100000; i++) {
  responses.push(request('http://myserver.local',{
    dispatcher: agent
  }))
}
await Promise.all(responses)
console.timeEnd('request')

worker.terminate()
