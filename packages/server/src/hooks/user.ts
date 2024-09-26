import type { PinningServiceUser, AccessTokenValidator } from '../index.js'
import type { FastifyInstance } from 'fastify'

// add the `.user` property to the request types
declare module 'fastify' {
  export interface FastifyRequest {
    user: PinningServiceUser
  }
}

/**
 * Create and return an IPFS Pinning Service API server
 */
export default function user (server: FastifyInstance, validateAccessToken: AccessTokenValidator): void {
  server.addHook('preHandler', async (request, reply) => {
    try {
      request.user = await validateAccessToken(request.headers.authorization?.split('Bearer ')?.pop())
    } catch {
      return reply
        .status(401)
        .header('Content-Type', 'application/json')
        .send(JSON.stringify({
          error: {
            reason: 'ERR_NOT_AUTHORIZED',
            details: 'Not authorized'
          }
        }))
    }
  })
}
