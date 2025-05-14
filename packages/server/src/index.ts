/**
 * @packageDocumentation
 *
 * Implements HTTP routes for a Fastify server that conform to the [IPFS Pinning Service API](https://ipfs.github.io/pinning-services-api-spec/).
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { createPinningServiceAPIServer} from '@helia/pinning-service-api-server'
 *
 * const helia = await createHelia()
 * const server = await createRemotePinningServer(helia, {
 *   validateAccessToken: async (accessToken, options) => {
 *     // validate the user passed a valid token
 *     return true
 *   },
 *   listen: {
 *     // fastify listen options
 *   }
 * })
 *
 * // now make http requests
 * ```
 *
 * Alternatively if you have a Fastify instance already you can add routes to it.
 *
 * @example
 *
 * ```typescript
 * import fastify from 'fastify'
 * import cors from '@fastify/cors'
 * import { createHelia } from 'helia'
 * import routes from '@helia/pinning-service-api-server/routes'
 *
 * const server = fastify({
 *  // fastify options
 * })
 * await server.register(cors, {
 *   origin: '*',
 *   methods: ['GET', 'OPTIONS'],
 *   strictPreflight: false
 * })
 *
 * const helia = await createHelia()
 *
 * // configure Pinning Service HTTP API routes
 * routes(server, helia)
 *
 * await server.listen({
 *   // fastify listen options
 * })
 *
 * // now make http requests
 * ```
 */

import cors from '@fastify/cors'
import fastify from 'fastify'
import hooks from './hooks/index.js'
import routes from './routes/index.js'
import type { PinStoreInit } from './pin-store.js'
import type { AbortOptions, Libp2p } from '@libp2p/interface'
import type { FastifyListenOptions, FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

export type { PinStoreInit }

export interface PinningServiceUser {
  /**
   * A unique identifier for this user. Will be used as a datastore key segment
   * so should satisfy `/[a-z0-9]+/`.
   */
  id: string
}

export interface PinResults {
  count: number
  results: Pin[]
}

export interface Pin {
  cid: string
  name?: string

  /**
   * Optional list of multiaddrs known to provide the data
   */
  origins?: string[]

  /**
   * Optional metadata for pin object
   */
  meta?: Record<string, string>
}

export interface PinStatus {
  requestid: string
  status: 'queued' | 'pinning' | 'pinned' | 'pinned' | 'failed'
  created: string
  pin: Pin
  delegates: string[]
  info?: Record<string, string>
}

/**
 * Convert an access token into a user or throw an error
 */
export interface AccessTokenValidator {
  (accessToken?: string, options?: AbortOptions): Promise<PinningServiceUser> | PinningServiceUser
}

export interface ServerInit {
  /**
   * A function that can validate access tokens and return user details
   */
  validateAccessToken: AccessTokenValidator

  /**
   * Options to pass to the pinstore
   */
  pinstore?: PinStoreInit

  /**
   * A preconfigured Fastify instance to use instead of creating one
   */
  fastify?: FastifyInstance

  /**
   * Options to pass to the Fastify server
   */
  listen?: FastifyListenOptions
}

/**
 * Create and return an IPFS Pinning Service API server
 */
export async function createPinningServiceAPIServer <T extends Libp2p = Libp2p> (helia: HeliaLibp2p<T>, init: ServerInit): Promise<FastifyInstance> {
  const server = init.fastify ?? fastify()
  await server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    strictPreflight: false
  })

  hooks(server, helia, init)
  routes(server, helia, init)

  await server.listen(init.listen ?? {
    port: 0
  })

  return server
}
