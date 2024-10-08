/**
 * @packageDocumentation
 *
 * Configure your existing Fastify instance with routes that conform to the
 * [IPFS Pinning Service API](https://ipfs.github.io/pinning-services-api-spec/)
 * spec.
 *
 * @example
 *
 * ```typescript
 * import fastify from 'fastify'
 * import cors from '@fastify/cors'
 * import { createHelia } from 'helia'
 * import routes from '@helia/routing-v1-http-api-server/routes'
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

import getPins from './pins/get.js'
import deletePin from './pins/pin/delete.js'
import getPin from './pins/pin/get.js'
import postPin from './pins/pin/post.js'
import postPins from './pins/post.js'
import type { PinStoreInit } from '../index.js'
import type { Libp2p } from '@libp2p/interface'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

export interface RoutesOptions {
  pinstore?: PinStoreInit
}

export default function routes <T extends Libp2p = Libp2p> (fastify: FastifyInstance, helia: HeliaLibp2p<T>, init: RoutesOptions): void {
  getPins(fastify, helia)
  postPins(fastify, helia)
  getPin(fastify, helia)
  deletePin(fastify, helia)
  postPin(fastify, helia)
}
