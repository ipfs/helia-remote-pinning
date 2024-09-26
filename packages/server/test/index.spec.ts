/* eslint-env mocha */

import { RemotePinningServiceClient, Configuration } from '@ipfs-shipyard/pinning-service-client'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { identity } from 'multiformats/hashes/identity'
import { createPinningServiceAPIServer } from '../src/index.js'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'

describe('pinning-api-server', () => {
  let helia: HeliaLibp2p
  let server: FastifyInstance
  let endpointUrl: string
  const accessToken = 'my-token'
  let client: RemotePinningServiceClient

  beforeEach(async () => {
    helia = await createHelia()
    server = await createPinningServiceAPIServer(helia, {
      validateAccessToken: (token) => {
        if (token === accessToken) {
          return {
            id: 'test-user'
          }
        }

        throw new Error('Unauthorized')
      },
      listen: {
        host: '127.0.0.1',
        port: 0
      }
    })

    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port

    expect(port).to.be.a('number')

    endpointUrl = `http://127.0.0.1:${port}`

    client = new RemotePinningServiceClient(new Configuration({
      accessToken,
      endpointUrl
    }))
  })

  afterEach(async () => {
    await server?.close()
    await helia?.stop()
  })

  describe('OPTIONS /pins', () => {
    it('supports CORS', async () => {
      const res = await fetch(`${endpointUrl}/pins`, {
        method: 'OPTIONS'
      })

      expect(res.headers.get('access-control-allow-origin')).to.equal('*')
      expect(res.headers.get('access-control-allow-methods')).to.equal('GET, POST, DELETE, OPTIONS')
    })
  })

  describe('GET /pins', () => {
    it('returns pins', async () => {
      const result = await client.pinsGet()

      expect(result).to.have.property('count', 0)
      expect(result).to.have.property('results').that.is.empty()
    })
  })

  describe('POST /pins', () => {
    it('creates a pin', async () => {
      const multihash = identity.digest(Uint8Array.from([0, 1, 2, 3]))
      const cid = CID.createV1(raw.code, multihash)

      const result = await client.pinsPost({
        pin: {
          cid: cid.toString(),
          name: 'my-pin'
        }
      })

      expect(result).to.have.property('requestid').that.is.a('string')
      expect(result).to.have.property('status').that.is.a('string')
      expect(result).to.have.property('created').that.is.a('Date')
      expect(result).to.have.property('delegates').that.is.an('array')
      expect(result).to.have.nested.property('pin.name', 'my-pin')
      expect(result).to.have.nested.property('pin.cid', cid.toString())
    })
  })
})
