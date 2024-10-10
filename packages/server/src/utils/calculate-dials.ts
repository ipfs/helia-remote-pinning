import { multiaddr } from '@multiformats/multiaddr'
import type { Multiaddr } from '@multiformats/multiaddr'

/**
 * Take a list of multiaddrs and group them by peer id with a group for those
 * with no peer id
 */
export function calculateDials (addrs?: string[]): Multiaddr[][] {
  if (addrs == null) {
    return []
  }

  const output: Record<string, Multiaddr[]> = {}

  addrs
    .map(addr => multiaddr(addr))
    .forEach(ma => {
      const peerId = ma.getPeerId() ?? '-'

      output[peerId] ??= []
      output[peerId].push(ma)
    })

  return Object.values(output)
}
