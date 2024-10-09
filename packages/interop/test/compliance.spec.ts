import { createPinningServiceAPIServer } from '@helia/pinning-service-api-server'
import { execa } from 'execa'
import { createHelia } from 'helia'
import { nanoid } from 'nanoid'
import type { FastifyInstance } from 'fastify'
import type { HeliaLibp2p } from 'helia'
import { expect } from 'aegir/chai'

describe('pinning service compliance', function () {
  this.timeout(540 * 1000)

  let server: FastifyInstance
  let helia: HeliaLibp2p
  let authtoken: string

  beforeEach(async () => {
    authtoken = nanoid()

    helia = await createHelia()
    server = await createPinningServiceAPIServer(helia, {
      validateAccessToken: (token) => {
        if (token === authtoken) {
          return {
            id: 'test-user'
          }
        }

        throw new Error('Invalid access token')
      },
      listen: {
        host: '0.0.0.0',
        port: 0
      }
    })
  })

  afterEach(async () => {
    server?.server.closeAllConnections()
    await server?.close()
    await helia?.stop()
  })

  it('should comply', async () => {
    const addresses = server.addresses()

    // eslint-disable-next-line no-console
    console.info('npx', '@ipfs-shipyard/pinning-service-compliance', '-s', `http://localhost:${addresses[0]?.port}`, authtoken)
    const tests = execa('npx', ['@ipfs-shipyard/pinning-service-compliance', '-s', `http://localhost:${addresses[0]?.port}`, authtoken])
    tests.stdout?.on('data', buf => {
      process.stdout.write(buf)

      if (buf.toString().includes('❌') === true) {
        tests.kill()
        expect.fail('compliance tests failed')
      }
    })
    tests.stderr?.on('data', buf => {
      process.stderr.write(buf)

      if (buf.toString().includes('❌') === true) {
        tests.kill()
        expect.fail('compliance tests failed')
      }
    })
    await tests
  })
})
