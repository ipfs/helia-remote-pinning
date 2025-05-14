import { setMaxListeners } from '@libp2p/interface'
import { mapPinStatus } from '../../utils/map-pin-status.js'
import type { Libp2p } from '@libp2p/interface'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

interface Querystring {
  cid?: string
  name?: string
  match?: string
  status?: string
  before?: string
  after?: string
  limit?: number
  meta?: string
}

export default function getPins <T extends Libp2p = Libp2p> (fastify: FastifyInstance, helia: HeliaLibp2p<T>): void {
  fastify.route<{ Querystring: Querystring }>({
    method: 'GET',
    url: '/pins',
    schema: {
      querystring: {
        type: 'object',
        properties: {
          cid: {
            type: 'string'
          },
          name: {
            type: 'string'
          },
          match: {
            enum: ['exact', 'iexact', 'partial', 'ipartial'],
            type: 'string',
            default: 'exact'
          },
          status: {
            type: 'string'
          },
          before: {
            type: 'string'
          },
          after: {
            type: 'string'
          },
          limit: {
            type: 'number',
            maximum: 1000,
            default: 10
          },
          meta: {
            type: 'string'
          }
        }
      }
    },
    handler: async (request, reply) => {
      const controller = new AbortController()
      setMaxListeners(Infinity, controller.signal)

      request.raw.on('close', () => {
        controller.abort()
      })

      try {
        const { count, results } = await request.pinStore.list(request.user, request.query)

        return await reply
          .header('Content-Type', 'application/json')
          .send(JSON.stringify({
            count,
            results: results.map(status => mapPinStatus(status, helia))
          }))
      } catch (err: any) {
        return reply
          .status(500)
          .header('Content-Type', 'application/json')
          .send(JSON.stringify({
            error: {
              reason: 'INTERNAL_SERVER_ERROR',
              details: err.message
            }
          }))
      }
    }
  })
}
