import { PinStore } from '../pin-store.js'
import type { Libp2p } from '@libp2p/interface'
import type { FastifyInstance } from 'fastify'
import type { Helia } from 'helia'

// add the `.pinStore` property to the request types
declare module 'fastify' {
  export interface FastifyRequest {
    pinStore: PinStore<Libp2p>
  }
}

/**
 * Create and return an IPFS Pinning Service API server
 */
export default function pinStore <T extends Libp2p = Libp2p> (server: FastifyInstance, helia: Helia<T>): void {
  server.addHook('preHandler', async (request, reply) => {
    if (request.pinStore == null) {
      request.pinStore = new PinStore(helia)
      await request.pinStore.start()
    }
  })
}
