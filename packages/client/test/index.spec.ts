import { unixfs } from '@helia/unixfs'
import { Configuration, RemotePinningServiceClient } from '@ipfs-shipyard/pinning-service-client'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import all from 'it-all'
import drain from 'it-drain'
import { heliaWithRemotePins } from '../src/index.js'
import type { HeliaWithRemotePins } from '../src/index.js'
import type { UnixFS } from '@helia/unixfs'
import type { PinsGetRequest } from '@ipfs-shipyard/pinning-service-client'

const encoder = new TextEncoder()

describe('@helia/remote-pinning', () => {
  let helia: HeliaWithRemotePins
  let remotePinningClient: RemotePinningServiceClient
  let heliaFs: UnixFS

  beforeEach(async () => {
    const node = await createHelia() as any
    const pinServiceConfig = {
      endpointUrl: `http://localhost:${process.env.PINNING_SERVER_PORT}`, // the URI for your pinning provider, e.g. `http://localhost:3000`
      accessToken: process.env.PINNING_SERVICE_TOKEN // the secret token/key given to you by your pinning provider
    }
    remotePinningClient = new RemotePinningServiceClient(new Configuration(pinServiceConfig))
    helia = heliaWithRemotePins(node, pinServiceConfig)
    heliaFs = unixfs(helia)
  })

  afterEach(async () => {
    await helia.stop()

    const request: PinsGetRequest = {
      limit: 1000
    }

    while (true) {
      const pins = await remotePinningClient.pinsGet(request)

      if (pins.results.length === 0) {
        break
      }

      // doing this in parallel overwhelms the mock pinning server :/
      for (const pin of pins.results) {
        await remotePinningClient.pinsRequestidDelete({ requestid: pin.requestid })
      }

      request.after = pins.results[pins.results.length - 1].created
    }
  })

  describe('add', function () {
    it('should pin a block', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await drain(helia.pins.add(cid, {
        name: `pinned-test-${Math.random()}`
      }))

      const results = await remotePinningClient.pinsGet({
        cid: [cid.toString()]
      })

      expect(results).to.have.nested.property('results[0].status', 'pinned')
    })

    it('should pin a block with metadata', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await drain(helia.pins.add(cid, {
        name: `pinned-test-${Math.random()}`,
        metadata: {
          foo: 'bar'
        }
      }))

      const results = await remotePinningClient.pinsGet({
        cid: [cid.toString()]
      })

      expect(results).to.have.nested.property('results[0].status', 'pinned')
      expect(results).to.have.deep.nested.property('results[0].pin.meta', {
        foo: 'bar'
      })
    })

    it('should throw when pinning fails', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await expect(drain(helia.pins.add(cid, {
        name: `failed-test-${Math.random()}`
      }))).to.eventually.be.rejected
        .with.property('name', 'PinningFailedError')
    })

    it('should time out when pinning', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const dir = await heliaFs.addDirectory()
      const finalCid = await heliaFs.cp(cid, dir, 'hello.txt')

      // delete the block contained within the directory
      await helia.blockstore.delete(cid)

      // pin the directory - should never complete as we no longer have the file
      // block
      await expect(drain(helia.pins.add(finalCid, {
        name: `queued-test-${Math.random()}`,
        signal: AbortSignal.timeout(100)
      }))).to.eventually.be.rejected
        .with.property('name', 'TimeoutError')
    })

    it('should not pin if given an already aborted signal', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const controller = new AbortController()
      controller.abort()

      await expect(drain(helia.pins.add(cid, {
        name: `queued-test-${Math.random()}`,
        signal: controller.signal
      }))).to.eventually.be.rejected
        .with.property('name', 'AbortError')
    })

    it('should send libp2p addresses as origins', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await drain(helia.pins.add(cid, {
        name: `pinned-test-${Math.random()}`
      }))

      const results = await remotePinningClient.pinsGet({
        cid: [cid.toString()]
      })

      expect(results).to.have.nested.property('results[0].pin.origins')
        .to.have.lengthOf(helia.libp2p.getMultiaddrs().length)
    })
  })

  describe('rm', () => {
    it('should remove a pin', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await drain(helia.pins.add(cid, {
        name: `pinned-test-${Math.random()}`
      }))

      const results = await remotePinningClient.pinsGet({
        cid: [cid.toString()]
      })

      expect(results).to.have.nested.property('results[0].status', 'pinned')

      await drain(helia.pins.rm(cid))

      const resultsAfterDelete = await remotePinningClient.pinsGet({
        cid: [cid.toString()]
      })

      expect(resultsAfterDelete).to.have.property('results').that.is.empty()
    })

    it('should remove a pin that does not exist', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await drain(helia.pins.rm(cid))

      const resultsAfterDelete = await remotePinningClient.pinsGet({
        cid: [cid.toString()]
      })

      expect(resultsAfterDelete).to.have.property('results').that.is.empty()
    })
  })

  describe('ls', () => {
    it('should list no pins', async () => {
      await expect(all(helia.pins.ls())).to.eventually.be.empty()
    })

    it('should list created pins', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await drain(helia.pins.add(cid, {
        name: `pinned-test-${Math.random()}`
      }))

      const pins = await all(helia.pins.ls())

      expect(pins).to.have.lengthOf(1)
      expect(pins[0].cid.toString()).to.equal(cid.toString())
    })

    it('should list multiple pages of created pins', async () => {
      // pagination limit is 1000
      const pinCount = 1100
      const cids = []

      for (let i = 0; i < pinCount; i++) {
        const cid = await heliaFs.addBytes(encoder.encode(`hello world ${i}`))

        await drain(helia.pins.add(cid, {
          name: `pinned-test-${i}`
        }))

        cids.push(cid)
      }

      const pins = await all(helia.pins.ls())

      expect(pins).to.have.lengthOf(pinCount)

      for (let i = 0; i < pinCount; i++) {
        expect(pins[i].cid.toString()).to.equal(cids[i].toString())
      }
    })
  })

  describe('isPinned', () => {
    it('should report that a pin is pinned', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await drain(helia.pins.add(cid, {
        name: `pinned-test-${Math.random()}`
      }))

      await expect(helia.pins.isPinned(cid)).to.eventually.be.true()
    })

    it('should report that a pin is not pinned', async () => {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      await expect(helia.pins.isPinned(cid)).to.eventually.be.false()
    })
  })
})
