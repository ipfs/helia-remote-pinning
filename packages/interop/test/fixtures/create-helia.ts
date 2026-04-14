import { tcp } from '@libp2p/tcp'
import { createHelia as createNode, libp2pDefaults } from 'helia'
import type { HeliaInit, Helia } from 'helia'

export async function createHelia (init?: Partial<HeliaInit>): Promise<Helia> {
  const libp2p = libp2pDefaults()
  libp2p.peerDiscovery = []

  // @ts-expect-error remove non-essential services
  delete libp2p.services.dht

  // @ts-expect-error remove non-essential services
  delete libp2p.services.autoNAT

  // @ts-expect-error remove non-essential services
  delete libp2p.services.autoTLS

  // @ts-expect-error remove non-essential services
  delete libp2p.services.dcutr

  // @ts-expect-error remove non-essential services
  delete libp2p.services.upnp

  // @ts-expect-error remove non-essential services
  delete libp2p.services.relay

  libp2p.transports = [
    tcp()
  ]

  const helia = await createNode({
    libp2p,
    ...init
  })

  return helia
}
