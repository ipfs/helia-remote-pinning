/**
 * @packageDocumentation
 *
 * Remote pinning allows you to delegate the hosting of content to another,
 * perhaps better connected, node or service on the IPFS network.
 *
 * Instead of pinning blocks locally, we can use a Remote Pinning Service API
 * server to pin the blocks, ensuring they are persisted beyond the scope of the
 * current Helia node.
 *
 * This is ideal for when creating content in short-lived environments, such as
 * browsers, for example.
 *
 * This module exports two functions to help you do this - `createRemotePins`
 * and `heliaWithRemotePins`.
 *
 * ## createRemotePins
 *
 * The `createRemotePins` function returns an object that implements the Helia
 * `Pins` interface.
 *
 * The returned object can be used to replace the `.pins` property of your Helia
 * node so you can transparently ensure the longevity of pinned content, or you
 * can use it directly.
 *
 * ## heliaWithRemotePins
 *
 * This function takes a Helia instance and some remote pinning config and
 * returns a Helia node that has been augmented with remote pinning.
 *
 * You can then use the `.pins` API as normal, and pinned blocks will be pulled
 * up by the remote pinning service.
 *
 * @example
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { heliaWithRemotePins } from '@helia/remote-pinning'
 * import { unixfs } from '@helia/unixfs'
 *
 * // this node uses only remote pinning
 * const helia = heliaWithRemotePins(await createHelia(), {
 *   endpointUrl: `http://localhost:${process.env.PINNING_SERVER_PORT}`, // the URI for your pinning provider, e.g. `http://localhost:3000`
 *   accessToken: process.env.PINNING_SERVICE_TOKEN // the secret token/key given to you by your pinning provider
 * })
 *
 * // add a block to Helia
 * const fs = unixfs(helia)
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
 *
 * // pin the block
 * for await(const cid of helia.pins.add(cid, { signal: AbortSignal.timeout(5000) })) {
 *   console.info('pinned', cid)
 * }
 *
 * // the block can now be retrieved from the remote pinning service
 * ```
 *
 * ## API differences
 *
 * The mapping between the Helia pinning API and the remote pinning API is not
 * perfect. The differences are:
 *
 * 1. The remote pinning API does not give detailed progress information, consequently the only CID yielded from `pins.add` will be the root CID
 * 2. Helia's metadata support is richer than that of the remote pinning API - metadata values can only be strings
 * 3. The remote pinning API accepts several extra arguments to several operations - these can be sent in a type-safe way using the `HeliaWithRemotePins` interface, which is the return type of the exported `heliaWithRemotePins` function
 */
import { Configuration, RemotePinningServiceClient } from '@ipfs-shipyard/pinning-service-client'
import { HeliaRemotePins } from './helia-remote-pins.js'
import type { ConfigurationParameters, Status, TextMatchingStrategy } from '@ipfs-shipyard/pinning-service-client'
import type { Libp2p } from '@libp2p/interface'
import type { AbortOptions, Multiaddr } from '@multiformats/multiaddr'
import type { AddOptions, HeliaLibp2p, IsPinnedOptions, LsOptions, Pin, Pins } from 'helia'
import type { CID } from 'multiformats/cid'

/**
 * A function that takes and returns a list of multiaddrs
 */
export interface MulitaddrFilter {
  (origins: Multiaddr[]): Multiaddr[]
}

export interface HeliaRemotePinnerInit extends ConfigurationParameters {
  /**
   * A function to filter the origins that the pinning provider can use to
   * retrieve the content.
   *
   * You can use this to filter out multiaddrs that aren't dialable by the
   * pinning provider.
   *
   * @default (origins) => origins
   */
  originFilter?: MulitaddrFilter

  /**
   * A function to filter the delegates that the pinning provider expects us to
   * connect to, before we connect to them.
   *
   * @default (delegates) => delegates
   */
  delegateFilter?: MulitaddrFilter

  /**
   * When adding a pin we poll the pinning service for status updates. This
   * setting controls how often that polling occurs in ms.
   *
   * @default 1000
   */
  pollInterval?: number
}

/**
 * Allows passing extra options accepted by the remote pinning service
 */
export interface RemoteAddOptions extends Omit<AddOptions, 'metadata'> {
  name?: string
  metadata?: Record<string, string>
}

/**
 * Allows passing extra options accepted by the remote pinning service
 */
export interface RemoteLsOptions extends LsOptions {
  name?: string
  match?: TextMatchingStrategy
  status?: Status[]
  before?: Date
  after?: Date
}

/**
 * Includes extra metadata supported by the remote pinning service
 */
export interface RemotePin extends Pin {
  name?: string
  status: Status
}

export interface RemoteIsPinnedOptions extends IsPinnedOptions {

}

/**
 * Extends the Pins interface with remote pinning-specific arguments and return
 * types (e.g. metadata as `Record<string, string>` and pins with an added
 * `.status` property)
 */
export interface RemotePins extends Pins {
  /**
   * Pin a block in the blockstore. It will not be deleted
   * when garbage collection is run.
   */
  add(cid: CID, options?: RemoteAddOptions): AsyncGenerator<CID, void, undefined>

  /**
   * List all blocks that have been pinned.
   */
  ls(options?: RemoteLsOptions): AsyncGenerator<RemotePin, void, undefined>

  /**
   * Return true if the passed CID is pinned
   */
  isPinned(cid: CID, options?: RemoteIsPinnedOptions): Promise<boolean>

  /**
   * Return pin details
   */
  get(cid: CID, options?: AbortOptions): Promise<RemotePin>

  /**
   * Update pin metadata
   */
  setMetadata(cid: CID, metadata: Record<string, string> | undefined, options?: AbortOptions): Promise<void>
}

export type HeliaWithRemotePins<T extends Libp2p = Libp2p> = Omit<HeliaLibp2p<T>, 'pins'> & { pins: RemotePins }

/**
 * Create a remote pins instance powered by the passed Helia node
 */
export function createRemotePins <T extends Libp2p = Libp2p> (helia: HeliaLibp2p<T>, init: HeliaRemotePinnerInit = {}): RemotePins {
  return new HeliaRemotePins(helia, new RemotePinningServiceClient(new Configuration(init)), init)
}

/**
 * Patches the passed Helia node with the remote pins instance, this function
 * makes dealing with the types a little easier
 */
export function heliaWithRemotePins <T extends Libp2p = Libp2p> (helia: HeliaLibp2p<T>, init: HeliaRemotePinnerInit = {}): HeliaWithRemotePins<T> {
  helia.pins = createRemotePins(helia, init)

  return helia as any
}
