/* eslint-env mocha */

import { createPinningServiceAPIServer } from '@helia/pinning-service-api-server'
import { heliaWithRemotePins } from '@helia/remote-pinning'
import { expect } from 'aegir/chai'
import all from 'it-all'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { nanoid } from 'nanoid'
import { createHelia } from './fixtures/create-helia.js'
import type { HeliaWithRemotePins } from '@helia/remote-pinning'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

describe('pinning-service-api interop', () => {
  let server: FastifyInstance
  let localHelia: HeliaWithRemotePins
  let pinningServiceHelia: HeliaLibp2p
  let cid: CID
  let block: Uint8Array

  beforeEach(async () => {
    pinningServiceHelia = await createHelia()

    const accessToken = nanoid()

    server = await createPinningServiceAPIServer(pinningServiceHelia, {
      validateAccessToken: (token) => {
        if (token === accessToken) {
          return {
            id: accessToken
          }
        }

        throw new Error('Invalid access token')
      }
    })

    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port

    localHelia = heliaWithRemotePins(await createHelia(), {
      endpointUrl: `http://127.0.0.1:${port}`,
      accessToken
    })

    block = Uint8Array.from([0, 1, 2, 3, 4, 5])
    const digest = await sha256.digest(block)
    cid = CID.createV1(raw.code, digest)
  })

  afterEach(async () => {
    server?.server.closeAllConnections()
    await server?.close()
    await pinningServiceHelia?.stop()
    await localHelia?.stop()
  })

  it('should pin a block', async () => {
    await localHelia.blockstore.put(cid, block)

    await drain(localHelia.pins.add(cid, {
      name: `pinned-test-${Math.random()}`
    }))

    await expect(pinningServiceHelia.pins.isPinned(cid)).to.eventually.be.true()
  })

  it('should get a pin', async () => {
    await localHelia.blockstore.put(cid, block)

    const name = `pinned-test-${Math.random()}`

    await drain(localHelia.pins.add(cid, {
      name
    }))

    const pins = await all(localHelia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins[0].cid.toString()).to.equal(cid.toString())
    expect(pins[0].name).to.equal(name)
  })

  it('should remove a pin', async () => {
    await localHelia.blockstore.put(cid, block)

    const name = `pinned-test-${Math.random()}`

    await drain(localHelia.pins.add(cid, {
      name
    }))

    await expect(all(localHelia.pins.ls())).to.eventually.have.lengthOf(1)
    await expect(pinningServiceHelia.pins.isPinned(cid)).to.eventually.be.true()

    await drain(localHelia.pins.rm(cid))

    await expect(all(localHelia.pins.ls())).to.eventually.have.lengthOf(0)
    await expect(pinningServiceHelia.pins.isPinned(cid)).to.eventually.be.false()
  })

  it('should update a pin', async () => {
    await localHelia.blockstore.put(cid, block)
    const name = `a-pin-${Math.random()}`

    await drain(localHelia.pins.add(cid, {
      name
    }))

    const pin = await localHelia.pins.get(cid)

    expect(pin).to.have.property('metadata').that.is.empty()

    const updatedMeta = {
      foo: 'bar'
    }

    await localHelia.pins.setMetadata(cid, updatedMeta)

    const updatedPin = await localHelia.pins.get(cid)
    expect(updatedPin).to.have.property('metadata').that.deep.equals(updatedMeta)
  })

  it('should list a pin', async () => {
    await localHelia.blockstore.put(cid, block)
    const name = `a-pin-${Math.random()}`

    await drain(localHelia.pins.add(cid, {
      name
    }))

    const pins = await all(localHelia.pins.ls())
    expect(pins.map(pin => pin.cid.toString())).to.include(cid.toString())
  })
})
