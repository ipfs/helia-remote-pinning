import { createHelia as createNode, libp2pDefaults } from 'helia'
import type { HeliaInit, Helia } from 'helia'

export async function createHelia (init?: Partial<HeliaInit>): Promise<Helia> {
  const libp2p = libp2pDefaults()
  libp2p.peerDiscovery = []

  const helia = await createNode({
    libp2p,
    ...init
  })

  return helia
}
