import { type RemotePinningServiceClient, type Pin, type PinStatus, type PinsRequestidPostRequest, Status } from '@ipfs-shipyard/pinning-service-client'
import { multiaddr } from '@multiformats/multiaddr'
import debug from 'debug'
import pRetry from 'p-retry'
import { FailedToConnectToDelegates } from './errors.js'
import type { Helia } from '@helia/interface'
import type { CID } from 'multiformats/cid'

const log = debug('helia-remote-pinning')
const logError = log.extend('error')
const logTrace = log.extend('trace')

export interface HeliaRemotePinningOptions {
  /**
   * Control whether requests are aborted or not by manually aborting a signal or using AbortSignal.timeout()
   */
  signal?: AbortSignal

  /**
   * The CID instance to pin. When using Helia, passing around the CID object is preferred over the string.
   */
  cid: CID
}

export interface AddPinArgs extends Omit<Pin, 'cid'>, HeliaRemotePinningOptions {}

export interface ReplacePinArgs extends Omit<PinsRequestidPostRequest, 'pin'>, Omit<Pin, 'cid'>, HeliaRemotePinningOptions {}

export class HeliaRemotePinner {
  constructor (private readonly heliaInstance: Helia, private readonly remotePinningClient: RemotePinningServiceClient) {
  }

  private async getOrigins (otherOrigins: Pin['origins']): Promise<Set<string>> {
    const origins = new Set(this.heliaInstance.libp2p.getMultiaddrs().map(multiaddr => multiaddr.toString()))
    if (otherOrigins != null) {
      for (const origin of otherOrigins) {
        origins.add(origin)
      }
    }
    return origins
  }

  private async connectToDelegates (delegates: Set<string>, signal?: AbortSignal): Promise<void> {
    let successfulDials = 0
    try {
      for (const delegate of delegates) {
        await this.heliaInstance.libp2p.dial(multiaddr(delegate), { signal })
        successfulDials++
      }
    } catch (e) {
      logError(e)
    }
    if (successfulDials === 0) {
      throw new FailedToConnectToDelegates('Failed to connect to any delegates')
    }
  }

  /**
   * The code that runs after we get a pinStatus from the remote pinning service.
   * This method is the orchestrator for waiting for the pin to complete/fail as well as connecting to the delegates.
   */
  private async handlePinStatus (pinStatus: PinStatus, signal?: AbortSignal): Promise<PinStatus> {
    await this.connectToDelegates(pinStatus.delegates, signal)
    let updatedPinStatus = pinStatus

    /**
     * We need to ensure that pinStatus is either pinned or failed.
     * To do so, we will need to poll the remote pinning service for the status of the pin.
     */
    try {
      await pRetry(async (attemptNum) => {
        logTrace('attempt #%d waiting for pinStatus of "pinned" or "failed"', attemptNum)
        updatedPinStatus = await this.remotePinningClient.pinsRequestidGet({ requestid: pinStatus.requestid })
        if ([Status.Pinned, Status.Failed].includes(pinStatus.status)) {
          return updatedPinStatus
        }
        throw new Error(`Pin status is ${pinStatus.status}`)
      }, {
        retries: 10,
        signal
      })
    } catch (e) {
      logError(e)
    }

    return updatedPinStatus
  }

  async addPin ({ cid, signal, ...otherArgs }: AddPinArgs): Promise<PinStatus> {
    signal?.throwIfAborted()

    const pinStatus = await this.remotePinningClient.pinsPost({
      pin: {
        ...otherArgs,
        cid: cid.toString(),
        origins: await this.getOrigins(otherArgs.origins)
      }
    }, {
      signal
    })
    return this.handlePinStatus(pinStatus, signal)
  }

  async replacePin ({ cid, requestid, signal, ...otherArgs }: ReplacePinArgs): Promise<PinStatus> {
    signal?.throwIfAborted()

    const pinStatus = await this.remotePinningClient.pinsRequestidPost({
      requestid,
      pin: {
        ...otherArgs,
        cid: cid.toString(),
        origins: await this.getOrigins(otherArgs.origins)
      }
    }, {
      signal
    })
    return this.handlePinStatus(pinStatus, signal)
  }
}

export function createRemotePinner (heliaInstance: Helia, remotePinningClient: RemotePinningServiceClient, options?: HeliaRemotePinningOptions): HeliaRemotePinner {
  return new HeliaRemotePinner(heliaInstance, remotePinningClient)
}
