import { setMaxListeners } from '@libp2p/interface'
import { mapPinStatus } from '../../../utils/map-pin-status.js'
import { parseMeta } from '../../../utils/parse-meta.js'
import type { Libp2p } from '@libp2p/interface'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

interface Params {
  requestid: string
}

interface Body {
  cid: string
  name?: string
  origins?: string[]
  meta?: Record<string, any>
}

export default function postPin <T extends Libp2p = Libp2p> (fastify: FastifyInstance, helia: HeliaLibp2p<T>): void {
  fastify.route<{ Params: Params, Body: Body }>({
    method: 'POST',
    url: '/pins/:requestid',
    schema: {
      params: {
        type: 'object',
        properties: {
          requestid: {
            type: 'string'
          }
        },
        required: ['requestid']
      },
      body: {
        type: 'object',
        properties: {
          cid: {
            type: 'string'
          },
          name: {
            type: 'string'
          },
          origins: {
            type: 'array',
            contains: {
              type: 'string'
            },
            maxItems: 20
          },
          meta: {
            type: 'object',
            maxProperties: 1000
          }
        },
        required: ['cid']
      }
    },
    handler: async (request, reply) => {
      const controller = new AbortController()
      setMaxListeners(Infinity, controller.signal)

      request.raw.on('close', () => {
        controller.abort()
      })

      const { requestid } = request.params
      const { cid, name, origins, meta } = request.body

      const updated = await request.pinStore.update(request.user, requestid, {
        cid,
        name,
        origins,
        meta: parseMeta(meta)
      })

      if (updated == null) {
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

      return reply
        .status(202)
        .header('Content-Type', 'application/json')
        .send(JSON.stringify(mapPinStatus(updated, helia)))
    }
  })
}
