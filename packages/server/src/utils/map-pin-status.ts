import type { PinStatus } from '../index.js'
import type { StoredPinStatus } from '../pin-store.js'
import type { Libp2p } from '@libp2p/interface'
import type { HeliaLibp2p } from 'helia'

const MAX_DELEGATES = 20

export function mapPinStatus <T extends Libp2p = Libp2p> (pinStatus: StoredPinStatus, helia: HeliaLibp2p<T>): PinStatus {
  return {
    requestid: pinStatus.id,
    status: pinStatus.status,
    pin: pinStatus.pin,
    created: new Date(pinStatus.created).toISOString(),
    delegates: helia.libp2p.getMultiaddrs()
      .map(ma => ma.toString())
      .slice(0, MAX_DELEGATES)
  }
}
