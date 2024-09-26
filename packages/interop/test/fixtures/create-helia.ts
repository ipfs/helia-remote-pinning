import { createHelia as createNode, libp2pDefaults } from 'helia'
import type { HeliaInit, HeliaLibp2p } from 'helia'

export async function createHelia (init?: Partial<HeliaInit>): Promise<HeliaLibp2p> {
  const libp2p = libp2pDefaults()
  libp2p.peerDiscovery = []

  const helia = await createNode({
    libp2p,
    ...init
  })

  // @ts-expect-error cannot derive service map type
  return helia
}
