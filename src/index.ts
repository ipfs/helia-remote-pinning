import { type RemotePinningServiceClient, type Pin, type PinStatus, type PinsRequestidPostRequest, Status } from '@ipfs-shipyard/pinning-service-client'
import { multiaddr } from '@multiformats/multiaddr'
import debug from 'debug'
import pRetry from 'p-retry'
import type { Helia } from '@helia/interface'
import type { CID } from 'multiformats/cid'

const log = debug('helia-remote-pinning')
const logError = log.extend('error')
const logTrace = log.extend('trace')
// const trace = log.extend('trace')

export interface HeliaRemotePinningOptions {
  /**
   * Control whether requests are aborted or not by manually aborting a signal or using AbortSignal.timeout()
   */
  signal?: AbortSignal
}

export interface AddPinArgs extends Omit<Pin, 'cid'>, HeliaRemotePinningOptions {
  cid: CID
}

export interface ReplacePinArgs extends Omit<PinsRequestidPostRequest, 'pin'>, Omit<Pin, 'cid'>, HeliaRemotePinningOptions {
  cid: CID
}

export class HeliaRemotePinner {
  constructor (private readonly heliaInstance: Helia, private readonly remotePinningClient: RemotePinningServiceClient) {
  }

  // private readonly getChildSignal = (): AbortSignal => {
  //   const delegateDialAbortController = new AbortController()
  //   // this.options?.signal?.addEventListener('abort', () => {
  //   //   delegateDialAbortController.abort()
  //   // })
  //   return delegateDialAbortController.signal
  // }

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
    // const signal = this.getChildSignal()
    try {
      for (const delegate of delegates) {
        await this.heliaInstance.libp2p.dial(multiaddr(delegate), { signal })
      }
    } catch (e) {
      logError(e)
    }
  }

  // /**
  //  * We need to ensure that pinStatus is either pinned or failed.
  //  * To do so, we will need to poll the remote pinning service for the status of the pin.
  //  */
  // private async waitForPinStatus (requestid: string): Promise<PinStatus> {
  //   const pinStatus =

  //   return pinStatus
  // }

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
        logTrace('p-retry attempt #%d', attemptNum)
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
    if (signal?.aborted === true) {
      throw new Error('Signal was aborted prior to pinning')
    }
    const pinStatus = await this.remotePinningClient.pinsPost({
      pin: {
        ...otherArgs,
        cid: cid.toString(),
        origins: await this.getOrigins(otherArgs.origins)
      }
    })
    return this.handlePinStatus(pinStatus, signal)
  }

  async replacePin ({ cid, requestid, signal, ...otherArgs }: ReplacePinArgs): Promise<PinStatus> {
    if (signal?.aborted === true) {
      throw new Error('Signal was aborted prior to pinning')
    }
    const pinStatus = await this.remotePinningClient.pinsRequestidPost({
      requestid,
      pin: {
        ...otherArgs,
        cid: cid.toString(),
        origins: await this.getOrigins(otherArgs.origins)
      }
    })
    return this.handlePinStatus(pinStatus, signal)
  }
}

export function createRemotePinner (heliaInstance: Helia, remotePinningClient: RemotePinningServiceClient, options?: HeliaRemotePinningOptions): HeliaRemotePinner {
  return new HeliaRemotePinner(heliaInstance, remotePinningClient)
}
