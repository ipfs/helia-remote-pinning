import type { Libp2p } from '@libp2p/interface'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

interface Params {
  requestid: string
}

export default function deletePin <T extends Libp2p = Libp2p> (fastify: FastifyInstance, helia: HeliaLibp2p<T>): void {
  fastify.route<{ Params: Params }>({
    method: 'DELETE',
    url: '/pins/:requestid',
    schema: {
      // request needs to have a querystring with a `name` parameter
      params: {
        type: 'object',
        properties: {
          requestid: {
            type: 'string'
          }
        },
        required: ['requestid']
      }
    },
    handler: async (request, reply) => {
      const { requestid } = request.params

      const pinStatus = await request.pinStore.get(request.user, requestid)

      if (pinStatus == null) {
        return reply
          .status(404)
          .header('Content-Type', 'application/json')
          .send(JSON.stringify({
            error: {
              reason: 'NOT_FOUND',
              details: 'The specified resource was not found'
            }
          }))
      }

      await request.pinStore.cancel(request.user, requestid)

      return reply
        .status(202)
        .send()
    }
  })
}
