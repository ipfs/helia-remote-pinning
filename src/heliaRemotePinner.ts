import { type RemotePinningServiceClient, type Pin, type PinStatus, type PinsRequestidPostRequest, Status } from '@ipfs-shipyard/pinning-service-client'
import { logger } from '@libp2p/logger'
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr'
import pRetry, { type Options as pRetryOptions } from 'p-retry'
import type { Helia } from 'helia'
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

  /**
   * The multiaddrs that the pinning provider can use to retrieve the content.
   */
  origins?: Multiaddr[]
}

export interface AddPinArgs extends Omit<Pin, 'cid' | 'origins'>, HeliaRemotePinningMethodOptions {}

export interface ReplacePinArgs extends Omit<PinsRequestidPostRequest, 'pin'>, Omit<Pin, 'cid' | 'origins'>, HeliaRemotePinningMethodOptions {}

export interface HeliaRemotePinnerConfig {
  /**
   * pRetry options when waiting for pinning to complete/fail in {@link handlePinStatus}
   *
   * @default { retries: 10 }
   */
  retryOptions?: pRetryOptions

  /**
   * Whether to merge the origins from the libp2p node with the provided origins.
   * If false, it will only use the provided origins.
   * If false and no origins are provided, it will use the libp2p node's multiaddrs.
   * If true and no origins are provided, it will use the libp2p node's multiaddrs.
   * If true and origins are provided, it will merge the libp2p node's multiaddrs and the provided origins.
   *
   * @default false
   */
  mergeOrigins?: boolean

  /**
   * A function to filter the origins that the pinning provider can use to retrieve the content.
   * You can use this to filter out multiaddrs that aren't dialable by the pinning provider.
   * This method will only filter out the origins obtained from the libp2p node, not the provided origins.
   * For example, if you are using a remote pinning service that only supports TCP, you can filter out the multiaddrs that use UDP.
   *
   * @default (origins) => origins
   */
  filterOrigins?(origins: Multiaddr[]): Multiaddr[]

  /**
   * A function to filter the delegates that the pinning provider expects us to connect to, before we connect to them.
   *
   * @default (delegates) => delegates
   */
  filterDelegates?(delegates: string[]): string[]
}

export class HeliaRemotePinner {
  private readonly config: Pick<Required<HeliaRemotePinnerConfig>, 'mergeOrigins' | 'retryOptions'> & HeliaRemotePinnerConfig
  constructor (private readonly heliaInstance: Helia, private readonly remotePinningClient: RemotePinningServiceClient, config?: HeliaRemotePinnerConfig) {
    this.config = {
      ...config,
      mergeOrigins: config?.mergeOrigins ?? false,
      retryOptions: {
        retries: 10,
        ...config?.retryOptions
      }
    }
  }

  /**
   * This method is used to get the origins that the pinning provider can use to retrieve the content.
   * If passed origins, it will use those origins. Otherwise, it will use the libp2p multiaddrs.
   * If mergeOrigins is true, it will merge the origins from the libp2p node with the provided origins.
   *
   * @param providedOrigins - provided origins
   * @returns
   */
  private getOrigins (providedOrigins: Multiaddr[] = []): Multiaddr[] {
    if (providedOrigins.length > 0 && !this.config.mergeOrigins) {
      return providedOrigins
    }
    const multiaddrs = this.heliaInstance.libp2p.getMultiaddrs()
    const origins = new Set([...providedOrigins, ...multiaddrs])

    return [...origins]
  }

  private async connectToDelegates (delegates: Set<string>, signal?: AbortSignal): Promise<void> {
    try {
      const filteredDelegates = this.config.filterDelegates?.([...delegates]) ?? [...delegates]
      await Promise.any(filteredDelegates.map(async delegate => {
        try {
          await this.heliaInstance.libp2p.dial(multiaddr(delegate), { signal })
        } catch (e) {
          log.error('Failed to connect to delegate %s', delegate, e)
          throw e
        }
      }))
    } catch (e) {
      log.error('Failed to connect to any delegates', e)
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
        updatedPinStatus = await this.remotePinningClient.pinsRequestidGet({ requestid: pinStatus.requestid })
        log.trace('attempt #%d pinStatus: %s', attemptNum, updatedPinStatus.status)
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
    log.trace('final pinStatus: %s', updatedPinStatus.status)

    return updatedPinStatus
  }

  #getPinArg ({ cid, ...otherArgs }: Omit<Pin, 'cid' | 'origins'> & { cid: CID, origins?: Multiaddr[] }): Pin {
    const origins = this.getOrigins(otherArgs.origins)
    const filteredOrigins = this.config.filterOrigins?.(origins) ?? origins

    return {
      ...otherArgs,
      cid: cid.toString(),
      // @ts-expect-error - broken types: origins needs to be an array of strings
      origins: filteredOrigins.length > 0 ? filteredOrigins.map(ma => ma.toString()) : undefined
    }
  }

  async addPin ({ cid, signal, ...otherArgs }: AddPinArgs): Promise<PinStatus> {
    signal?.throwIfAborted()

    const pinStatus = await this.remotePinningClient.pinsPost({
      pin: this.#getPinArg({ cid, ...otherArgs })
    }, {
      signal
    })
    log.trace('Initial pinsPost made, status: %s', pinStatus.status)
    return this.handlePinStatus(pinStatus, signal)
  }

  async replacePin ({ cid, requestid, signal, ...otherArgs }: ReplacePinArgs): Promise<PinStatus> {
    signal?.throwIfAborted()

    const pinStatus = await this.remotePinningClient.pinsRequestidPost({
      requestid,
      pin: this.#getPinArg({ cid, ...otherArgs })
    }, {
      signal
    })
    log.trace('Initial pinReplace made, status: %s', pinStatus.status)
    return this.handlePinStatus(pinStatus, signal)
  }
}
