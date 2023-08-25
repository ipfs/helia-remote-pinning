import { HeliaRemotePinner, type HeliaRemotePinnerConfig } from './heliaRemotePinner.js'
import type { Helia } from '@helia/interface'
import type { RemotePinningServiceClient } from '@ipfs-shipyard/pinning-service-client'

export type { HeliaRemotePinner, HeliaRemotePinnerConfig } from './heliaRemotePinner.js'

export function createRemotePinner (heliaInstance: Helia, remotePinningClient: RemotePinningServiceClient, config?: HeliaRemotePinnerConfig): HeliaRemotePinner {
  return new HeliaRemotePinner(heliaInstance, remotePinningClient, config)
}
