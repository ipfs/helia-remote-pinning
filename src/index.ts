import { HeliaRemotePinner, type HeliaRemotePinnerConfig } from './heliaRemotePinner.js'
import type { RemotePinningServiceClient } from '@ipfs-shipyard/pinning-service-client'
import type { Helia } from 'helia'

export type { HeliaRemotePinner, HeliaRemotePinnerConfig } from './heliaRemotePinner.js'

export function createRemotePinner (heliaInstance: Helia, remotePinningClient: RemotePinningServiceClient, config?: HeliaRemotePinnerConfig): HeliaRemotePinner {
  return new HeliaRemotePinner(heliaInstance, remotePinningClient, config)
}
