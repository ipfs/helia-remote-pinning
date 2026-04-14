import pinStore from './pin-store.ts'
import user from './user.ts'
import type { AccessTokenValidator } from '../index.js'
import type { Libp2p } from '@libp2p/interface'
import type { FastifyInstance } from 'fastify'
import type { Helia } from 'helia'

export interface HooksOptions {
  validateAccessToken: AccessTokenValidator
}

export default function hooks <T extends Libp2p = Libp2p> (fastify: FastifyInstance, helia: Helia<T>, init: HooksOptions): void {
  pinStore(fastify, helia)
  user(fastify, init.validateAccessToken)
}
