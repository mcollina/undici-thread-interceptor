import { createFastifyInterceptor } from 'fastify-undici-interceptor'
import { Agent, request } from 'undici'
import fastify from 'fastify'

const app = fastify()

app.get('/', async (req, reply) => {
  reply.send({ hello: 'world' })
})

const interceptor = createFastifyInterceptor({
  domain: '.local',
})
interceptor.route('myserver', app)

const agent = new Agent().compose(interceptor)

console.time('request')
const responses = []
for (let i = 0; i < 100000; i++) {
  responses.push(request('http://myserver.local', {
    dispatcher: agent,
  }))
}
await Promise.all(responses)
console.timeEnd('request')
