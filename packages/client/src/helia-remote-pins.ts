import { Status } from '@ipfs-shipyard/pinning-service-client'
import { NotFoundError, InvalidParametersError } from '@libp2p/interface'
import { logger } from '@libp2p/logger'
import { multiaddr } from '@multiformats/multiaddr'
import delay from 'delay'
import { CID, type Version } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { raceSignal } from 'race-signal'
import { PinningFailedError } from './errors.js'
import type { MulitaddrFilter, HeliaRemotePinnerInit, RemoteAddOptions, RemoteIsPinnedOptions, RemoteLsOptions, RemotePin, RemotePins } from './index.js'
import type { RemotePinningServiceClient, PinsGetRequest, PinsRequestidPostRequest } from '@ipfs-shipyard/pinning-service-client'
import type { AbortOptions, Libp2p } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { HeliaLibp2p, RmOptions } from 'helia'

const log = logger('helia:remote-pinning')

export class HeliaRemotePins <T extends Libp2p = Libp2p> implements RemotePins {
  private readonly helia: HeliaLibp2p<T>
  private readonly remotePinningClient: RemotePinningServiceClient
  private readonly originFilter: MulitaddrFilter
  private readonly delegateFilter: MulitaddrFilter
  private readonly pollInterval: number

  constructor (helia: HeliaLibp2p<T>, remotePinningClient: RemotePinningServiceClient, init: HeliaRemotePinnerInit = {}) {
    this.helia = helia
    this.remotePinningClient = remotePinningClient
    this.originFilter = init.originFilter ?? ((arg) => arg)
    this.delegateFilter = init.delegateFilter ?? ((arg) => arg)
    this.pollInterval = init.pollInterval ?? 1000
  }

  /**
   * When starting a pinning operation the remote pinning service can send us a
   * list of nodes to which it will delegate the fetching of data.
   *
   * We need to dial them for the pinning operation to complete.
   */
  private async connectToDelegates (delegates: Multiaddr[], options?: AbortOptions): Promise<void> {
    log.trace('connect to %d delegates', delegates.length)

    // for where we have been given multiple multiaddrs for each delegate, group
    // them by embedded PeerId. Treat them individually if no PeerId is present.
    const addresses: Record<string, Multiaddr[]> = {}
    this.delegateFilter(delegates).forEach(ma => {
      const peerId = ma.getPeerId() ?? `${Math.random()}`
      addresses[peerId] ??= []
      addresses[peerId].push(ma)
    })

    try {
      await Promise.any(
        Object.values(addresses).map(async addrs => {
          try {
            await this.helia.libp2p.dial(addrs, options)
          } catch (err) {
            log.error('failed to connect to delegate %s - %e', addrs, err)
            throw err
          }
        })
      )
    } catch (err) {
      log.error('failed to connect to any delegates - %e', err)
    }
  }

  #getOrigins (additionalOrigins: Multiaddr[] = []): string[] {
    return this.originFilter([
      ...this.helia.libp2p.getMultiaddrs(),
      ...additionalOrigins
    ])
      .map(ma => ma.toString())
  }

  async * add (cid: CID, options: RemoteAddOptions = {}): AsyncGenerator<CID> {
    const createResult = await this.remotePinningClient.pinsPost({
      pin: {
        ...options,
        cid: cid.toString(),
        // @ts-expect-error - broken types: origins needs to be an array of strings
        origins: this.#getOrigins(options.origins),
        meta: options.metadata
      }
    }, options)

    log.trace('initial pinsPost made, status: %s', createResult.status)

    this.connectToDelegates(createResult.delegates.map(addr => multiaddr(addr)), options)
      .catch(err => {
        log.error('failed to connect to delegates - %e', err)
      })

    while (options.signal?.aborted !== true) {
      const getResult = await this.remotePinningClient.pinsRequestidGet({
        requestid: createResult.requestid
      })

      if (getResult.status === Status.Failed) {
        throw new PinningFailedError(`Pinning ${cid} failed`)
      }

      if (getResult.status === Status.Pinned) {
        break
      }

      await raceSignal(delay(this.pollInterval), options.signal, {
        errorName: 'TimeoutError'
      })
    }

    options.onProgress?.(new CustomProgressEvent<CID>('helia:pin:add', cid))
    yield cid
  }

  async * rm (cid: CID, options: RmOptions = {}): AsyncGenerator<CID, void, undefined> {
    // find the requestid for the pinned CID
    const result = await this.remotePinningClient.pinsGet({
      cid: [cid.toString()]
    }, options)

    // delete all requestids for the pinned CID
    await Promise.all(
      [...result.results].map(async result => {
        return this.remotePinningClient.pinsRequestidDelete({
          requestid: result.requestid
        }, options)
      })
    )

    yield cid
  }

  async * ls (options: RemoteLsOptions = {}): AsyncGenerator<RemotePin, void, undefined> {
    const request: PinsGetRequest = {
      ...options,
      cid: undefined,
      limit: 1000
    }

    if (options.cid != null) {
      request.cid = [options.cid.toString()]
    }

    try {
      while (options?.signal?.aborted !== true) {
        const page = await this.remotePinningClient.pinsGet(request, options)

        if (page.results.length === 0) {
          return
        }

        yield * page.results.map(result => {
          return {
            cid: CID.parse(result.pin.cid),
            depth: Infinity,
            metadata: result.pin.meta ?? {},
            name: result.pin.name,
            status: result.status
          }
        })

        request.after = page.results[page.results.length - 1].created
      }
    } catch (err: any) {
      throw translateError(err)
    }
  }

  async get (cid: CID<unknown, number, number, Version>, options?: AbortOptions): Promise<RemotePin> {
    const request: PinsGetRequest = {
      ...options,
      cid: [
        cid.toString()
      ],
      limit: 1
    }

    const page = await this.remotePinningClient.pinsGet(request, options)

    if (page.results.length === 0) {
      throw new NotFoundError()
    }

    const result = page.results[0]

    return {
      cid: CID.parse(result.pin.cid),
      depth: Infinity,
      metadata: result.pin.meta ?? {},
      status: result.status
    }
  }

  async setMetadata (cid: CID<unknown, number, number, Version>, metadata: Record<string, string> | undefined, options?: AbortOptions): Promise<void> {
    const request: PinsGetRequest = {
      ...options,
      cid: [
        cid.toString()
      ],
      limit: 1
    }

    const page = await this.remotePinningClient.pinsGet(request, options)

    if (page.results.length === 0) {
      throw new NotFoundError()
    }

    const result = page.results[0]

    const updateRequest: PinsRequestidPostRequest = {
      requestid: result.requestid,
      pin: {
        ...result.pin,
        meta: metadata ?? {}
      }
    }

    await this.remotePinningClient.pinsRequestidPost(updateRequest, options)
  }

  async isPinned (cid: CID, options?: RemoteIsPinnedOptions): Promise<boolean> {
    try {
      const page = await this.remotePinningClient.pinsGet({
        ...options,
        cid: [cid.toString()],
        limit: 1
      }, options)

      if (page.count === 0) {
        return false
      }

      return true
    } catch (err: any) {
      throw translateError(err)
    }
  }
}

/**
 * The pinning service api client throws "Response" objects instead of "Error"s
 * so translate them into a more palatable throwable
 */
function translateError (err: Error | Response): Error {
  if (err instanceof Error) {
    return err
  }

  if (err.status === 404) {
    return new NotFoundError()
  }

  if (err.status === 400) {
    return new InvalidParametersError()
  }

  return new Error('Operation failed')
}
