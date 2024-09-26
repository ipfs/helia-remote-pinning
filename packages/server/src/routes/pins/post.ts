import { CID } from 'multiformats/cid'
import { mapPinStatus } from '../../utils/map-pin-status.js'
import { parseMeta } from '../../utils/parse-meta.js'
import type { Libp2p } from '@libp2p/interface'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

interface Body {
  cid: string
  name?: string
  origins?: string[]
  meta?: Record<string, any>
}

export default function postPins <T extends Libp2p = Libp2p> (fastify: FastifyInstance, helia: HeliaLibp2p<T>): void {
  fastify.route<{ Body: Body }>({
    method: 'POST',
    url: '/pins',
    schema: {
      // request needs to have a querystring with a `name` parameter
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
      const { cid: cidStr, name, origins, meta } = request.body

      let cid: CID
      try {
        cid = CID.parse(cidStr)
      } catch (err) {
        fastify.log.error('could not parse CID from body', err)
        return reply.code(400).type('text/html').send('Bad Request')
      }

      const status = await request.pinStore.pin(request.user, cid, {
        name,
        origins,
        meta: parseMeta(meta)
      })

      return reply
        .status(202)
        .header('Content-Type', 'application/json')
        .send(JSON.stringify(mapPinStatus(status, helia)))
    }
  })
}
