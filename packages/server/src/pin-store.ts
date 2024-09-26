import { AbortError } from '@libp2p/interface'
import { Queue } from '@libp2p/utils/queue'
import * as cborg from 'cborg'
import { Key } from 'interface-datastore'
import all from 'it-all'
import drain from 'it-drain'
import length from 'it-length'
import map from 'it-map'
import { CID } from 'multiformats/cid'
import { nanoid } from 'nanoid'
import { calculateDials } from './utils/calculate-dials.js'
import type { Pin, PinningServiceUser, PinStatus } from './index.js'
import type { AbortOptions, Libp2p, Logger } from '@libp2p/interface'
import type { HeliaLibp2p } from 'helia'
import type { Query } from 'interface-datastore'

export interface StoredPinStatus {
  id: string
  status: 'queued' | 'pinning' | 'pinned' | 'failed'
  created: number
  pin: Pin
  info?: Record<string, string>
}

export interface PinStoreInit {
  /**
   * How many pinning operations to do in parallel
   *
   * @default 10
   */
  concurrency?: number

  /**
   * The datastore prefix to use for pinning data
   *
   * @default 'pinning-service'
   */
  datastorePrefix?: string

  /**
   * To prevent unpinning of CIDs pinned by more than one user we store a
   * reference count in the pin metadata. This setting controls the key we use.
   *
   * @default 'remotePinningRefCount'
   */
  pinRefCountKey?: string
}

interface ListQuery {
  cid?: string
  name?: string
  match?: string
  status?: string
  before?: string
  after?: string
  limit?: number
  meta?: string
}

const DEFAULT_PINNING_CONCURRENCY = 50
const DEFAULT_DATASTORE_PREFIX = 'pinning-service'
const DEFAULT_REFCOUNT_KEY = 'remotePinningRefCount'

export interface PinOptions {
  name?: string
  origins?: string[]
  meta?: Record<string, string>
}

interface JobOptions extends AbortOptions {
  id: string
  cid: CID
  controller: AbortController
}

interface Matcher {
  (a: string, b?: string): boolean
}
const matchers: Record<string, Matcher> = {
  exact: (a, b) => {
    return a === b
  },
  iexact: (a, b) => {
    if (b == null) {
      return false
    }

    return a.toLowerCase() === b.toLowerCase()
  },
  partial: (a, b) => {
    if (b == null) {
      return false
    }

    return b.includes(a)
  },
  ipartial: (a, b) => {
    if (b == null) {
      return false
    }

    return b.toLowerCase().includes(a.toLowerCase())
  }
}

/**
 * Stores pinning information in the Helia datastore and manages a queue of
 * current pinning operations
 */
export class PinStore <T extends Libp2p = Libp2p> {
  private readonly helia: HeliaLibp2p<T>
  private readonly queue: Queue<void, JobOptions>
  private readonly log: Logger
  private readonly datastorePrefix: string
  private readonly pinRefCountKey: string

  constructor (helia: HeliaLibp2p<T>, init: PinStoreInit = {}) {
    this.helia = helia
    this.log = this.helia.logger.forComponent('helia:pinning-service:pin-operations')
    this.queue = new Queue({
      concurrency: init.concurrency ?? DEFAULT_PINNING_CONCURRENCY
    })
    this.datastorePrefix = init.datastorePrefix ?? DEFAULT_DATASTORE_PREFIX
    this.pinRefCountKey = init.pinRefCountKey ?? DEFAULT_REFCOUNT_KEY
  }

  async start (): Promise<void> {
    // resume any queued or in progress pinning operations
    const params: Query = {
      prefix: `/${this.datastorePrefix}`,
      filters: [({ value }) => {
        const status: StoredPinStatus = cborg.decode(value)

        return ['queued', 'pinning'].includes(status.status)
      }]
    }

    for await (const { key, value } of this.helia.datastore.query(params)) {
      const status = cborg.decode(value)
      this._queue(key, status)
    }
  }

  async stop (): Promise<void> {
    // cancel all running jobs and empty the queue
    this.queue.abort()
  }

  public async pin (user: PinningServiceUser, cid: CID, options: PinOptions): Promise<StoredPinStatus> {
    const id = nanoid()
    const dsKey = new Key(`/${this.datastorePrefix}/${user.id}/${id}`)

    const status: StoredPinStatus = {
      id,
      status: 'queued',
      created: Date.now(),
      pin: {
        cid: cid.toString(),
        name: options.name,
        origins: options.origins,
        meta: options.meta
      }
    }

    await this.helia.datastore.put(dsKey, cborg.encode(status))

    this._queue(dsKey, status)

    return status
  }

  private _queue (dsKey: Key, status: StoredPinStatus): void {
    const controller = new AbortController()

    // perform the pinning asynchronously
    void this.queue.add(async (opts) => {
      if (opts == null) {
        return
      }

      try {
        controller.signal.throwIfAborted()
        opts?.signal?.throwIfAborted()

        try {
          const pin = await this.helia.pins.get(opts.cid, opts)

          // CID is already pinned
          const refCount = Number(pin.metadata[this.pinRefCountKey]) ?? 0

          await this.helia.pins.setMetadata(opts.cid, {
            [this.pinRefCountKey]: refCount + 1
          })

          return
        } catch (err: any) {
          if (err.name !== 'NotFoundError') {
            throw err
          }
        }

        await Promise.all(
          calculateDials(status.pin.origins).map(async addrs => this.helia.libp2p.dial(addrs))
        )

        status.status = 'pinning'
        await this.helia.datastore.put(dsKey, cborg.encode(status))

        for await (const pin of this.helia.pins.add(opts.cid, {
          ...opts,
          metadata: {
            [this.pinRefCountKey]: 1
          }
        })) {
          this.log.trace('pinned %c as part of %s %c', pin, status.id, opts.cid)
          opts?.signal?.throwIfAborted()
        }

        status.status = 'pinned'
        await this.helia.datastore.put(dsKey, cborg.encode(status))

        opts?.signal?.throwIfAborted()
      } catch (err: any) {
        this.log.error('failed to pin %c - %e', opts.cid, err)

        try {
          if (opts?.signal?.aborted === true) {
            await this.helia.datastore.delete(dsKey)
          } else {
            status.status = 'failed'
            await this.helia.datastore.put(dsKey, cborg.encode(status))
          }
        } catch (err) {
          this.log.error('could not update status for %s after pin failure - %e', dsKey, err)
        }
      }
    }, {
      id: status.id,
      cid: CID.parse(status.pin.cid),
      controller,
      signal: controller.signal
    })
      .catch(err => {
        this.log.error('failed to pin %s - %e', status.pin.cid, err)
      })
  }

  public async update (user: PinningServiceUser, id: string, options: PinOptions & { cid?: string }): Promise<StoredPinStatus | undefined> {
    try {
      const dsKey = new Key(`/${this.datastorePrefix}/${user.id}/${id}`)
      const buf = await this.helia.datastore.get(dsKey)
      const status: StoredPinStatus = cborg.decode(buf)

      // passed a new CID - cancel/delete the existing pinning operation and
      // start a new one
      if (options.cid != null && options.cid !== status.pin.cid) {
        const cid = CID.parse(options.cid)
        await this.cancel(user, id)
        return await this.pin(user, cid, options)
      }

      status.pin = {
        ...status.pin,
        name: options.name ?? status.pin.name,
        origins: options.origins ?? status.pin.origins,
        meta: options.meta ?? status.pin.meta
      }

      // update the pin in the datastore
      await this.helia.datastore.put(dsKey, cborg.encode(status))

      return status
    } catch (err: any) {
      this.log.error('could not update pin for %s - %e', id, err)
    }
  }

  public async get (user: PinningServiceUser, id: string): Promise<StoredPinStatus | undefined> {
    try {
      const dsKey = new Key(`/${this.datastorePrefix}/${user.id}/${id}`)
      const buf = await this.helia.datastore.get(dsKey)

      return cborg.decode(buf)
    } catch (err: any) {
      this.log.error('could not load pin status for %s - %e', id, err)
    }
  }

  public async cancel (user: PinningServiceUser, id: string): Promise<void> {
    const dsKey = new Key(`/${this.datastorePrefix}/${user.id}/${id}`)
    let status: PinStatus
    let cid: CID

    try {
      const buf = await this.helia.datastore.get(dsKey)
      status = cborg.decode(buf)
      cid = CID.parse(status.pin.cid)
    } catch (err) {
      this.log.error('could not find key %s - %e', dsKey, err)
      return
    }

    // cancel the job if it's queued or in-progress
    if (status.status === 'pinning' || status.status === 'queued') {
      const jobs: Array<Promise<any>> = []

      this.queue.queue.forEach(job => {
        if (job.options.id === id) {
          jobs.push(job.join())
          job.options.controller.abort(new AbortError('Pinning job was cancelled'))
          job.abort(new AbortError('Pinning job was cancelled'))
        }
      })

      // wait for jobs to resolve or reject
      await Promise.allSettled(jobs)
        .catch(err => {
          this.log.error('error joining jobs', err)
        })
    }

    if (status.status === 'pinned') {
      // if the job has finished, unpin the blocks
      try {
        const pin = await this.helia.pins.get(cid)
        const refCount = Number(pin.metadata[this.pinRefCountKey]) ?? 0

        // find the number of listeners for this job and use it as the ref count
        const recipients = this.queue.queue.find(job => job.options.id === id)?.recipients.length ?? 1

        if (refCount < 2) {
          // only one pinner, remove the pin
          await drain(this.helia.pins.rm(cid))
        } else {
          // this CID is pinned by more than one user so decrease the refcount
          await this.helia.pins.setMetadata(cid, {
            [this.pinRefCountKey]: recipients
          })
        }
      } catch (err: any) {
        this.log.error('could not unpin %s - %e', id, err)
      }
    }

    try {
      // remove the pin from the datastore
      await this.helia.datastore.delete(dsKey)
    } catch (err) {
      this.log.error('could not remove stored pin for %s - %e', id, err)
    }
  }

  public async list (user: PinningServiceUser, query: ListQuery = {}): Promise<{ count: number, results: StoredPinStatus[] }> {
    const limit = query.limit
    const matcher = matchers[query.match ?? 'exact']
    let before: number | undefined

    if (query.before != null) {
      before = Date.parse(query.before)
    }

    let after: number | undefined

    if (query.after != null) {
      after = Date.parse(query.after)
    }

    const params: Query = {
      prefix: `/${this.datastorePrefix}/${user.id}`,
      filters: [({ value }) => {
        const status: StoredPinStatus = cborg.decode(value)

        if (before != null && status.created >= before) {
          return false
        }

        if (after != null && status.created <= after) {
          return false
        }

        if (query.name != null && !matcher(query.name, status.pin.name)) {
          return false
        }

        if (query.status?.split(',').includes(status.status) === false) {
          return false
        }

        return true
      }]
    }

    const count = await length(this.helia.datastore.query(params))

    if (count === 0) {
      return {
        count,
        results: []
      }
    }

    // results, newest first
    const results = await all(map(this.helia.datastore.query({
      ...params,
      orders: [
        (a, b) => {
          const statusA: StoredPinStatus = cborg.decode(a.value)
          const statusB: StoredPinStatus = cborg.decode(b.value)

          if (statusA.created > statusB.created) {
            return -1
          }

          if (statusA.created < statusB.created) {
            return 1
          }

          return 0
        }
      ],
      limit
    }), ({ value }) => cborg.decode(value)))

    return {
      count,
      results
    }
  }
}
