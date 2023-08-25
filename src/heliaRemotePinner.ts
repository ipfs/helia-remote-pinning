import { type RemotePinningServiceClient, type Pin, type PinStatus, type PinsRequestidPostRequest, Status } from '@ipfs-shipyard/pinning-service-client'
import { logger } from '@libp2p/logger'
import { multiaddr } from '@multiformats/multiaddr'
import pRetry, { type Options as pRetryOptions } from 'p-retry'
import { FailedToConnectToDelegates } from './errors.js'
import type { Helia } from '@helia/interface'
import type { CID } from 'multiformats/cid'

const log = logger('helia:remote-pinning')

interface HeliaRemotePinningMethodOptions {
  /**
   * Control whether requests are aborted or not by manually aborting a signal or using AbortSignal.timeout()
   */
  signal?: AbortSignal

  /**
   * The CID instance to pin. When using Helia, passing around the CID object is preferred over the string.
   */
  cid: CID
}

export interface AddPinArgs extends Omit<Pin, 'cid'>, HeliaRemotePinningMethodOptions {}

export interface ReplacePinArgs extends Omit<PinsRequestidPostRequest, 'pin'>, Omit<Pin, 'cid'>, HeliaRemotePinningMethodOptions {}

export interface HeliaRemotePinnerConfig {
  /**
   * pRetry options when waiting for pinning to complete/fail in {@link handlePinStatus}
   *
   * @default { retries: 10 }
   */
  retryOptions?: pRetryOptions
}

export class HeliaRemotePinner {
  private readonly config: Required<HeliaRemotePinnerConfig>
  constructor (private readonly heliaInstance: Helia, private readonly remotePinningClient: RemotePinningServiceClient, config?: HeliaRemotePinnerConfig) {
    this.config = {
      retryOptions: {
        retries: 10,
        ...config?.retryOptions
      }
    }
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
    try {
      await Promise.any([...delegates].map(async delegate => {
        try {
          await this.heliaInstance.libp2p.dial(multiaddr(delegate), { signal })
        } catch (e) {
          log.error(e)
          throw e
        }
      }))
    } catch (e) {
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
        log.trace('attempt #%d waiting for pinStatus of "pinned" or "failed"', attemptNum)
        updatedPinStatus = await this.remotePinningClient.pinsRequestidGet({ requestid: pinStatus.requestid })
        if ([Status.Pinned, Status.Failed].includes(pinStatus.status)) {
          return updatedPinStatus
        }
        throw new Error(`Pin status is ${pinStatus.status}`)
      }, {
        signal,
        ...this.config?.retryOptions
      })
    } catch (e) {
      log.error(e)
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
