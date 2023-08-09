import { unixfs, type UnixFS } from '@helia/unixfs'
import { Configuration, RemotePinningServiceClient, Status } from '@ipfs-shipyard/pinning-service-client'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import sinon from 'sinon'
import { type HeliaRemotePinner, createRemotePinner } from '../src/index.js'
import type { Helia } from '@helia/interface'

const encoder = new TextEncoder()

describe('@helia/remote-pinning', function () {
  let remotePinner: HeliaRemotePinner
  let helia: Helia
  let remotePinningClient
  let heliaFs: UnixFS
  beforeEach(async function () {
    helia = await createHelia({ start: false })
    heliaFs = unixfs(helia)
    const pinServiceConfig = new Configuration({
      endpointUrl: `http://localhost:${process.env.PINNING_SERVER_PORT}`, // the URI for your pinning provider, e.g. `http://localhost:3000`
      accessToken: process.env.PINNING_SERVICE_TOKEN // the secret token/key given to you by your pinning provider
    })

    remotePinningClient = new RemotePinningServiceClient(pinServiceConfig)
    remotePinner = createRemotePinner(helia, remotePinningClient)
  })
  afterEach(async function () {
    await helia.stop()
  })
  describe('addPin', function () {
    it('Returns failed status when pinning fails', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const addPinResult = await remotePinner.addPin({
        cid,
        name: 'failed-test1'
      })
      expect(addPinResult.status).to.equal(Status.Failed)
    })

    it('will await a queued pin until a signal times out', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const abortController = new AbortController()
      const thenSpy = sinon.spy()
      const catchSpy = sinon.spy()
      const finallySpy = sinon.spy()
      const addPinResult = remotePinner.addPin({
        cid,
        name: 'queued-test1',
        signal: abortController.signal
      })
      addPinResult.then(thenSpy).catch(catchSpy).finally(finallySpy)

      expect(thenSpy.called).to.equal(false)
      expect(catchSpy.called).to.equal(false)
      expect(finallySpy.called).to.equal(false)

      // we need to wait for X seconds and then confirm the promise hasn't settled
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(thenSpy.called).to.equal(false)
      expect(catchSpy.called).to.equal(false)
      expect(finallySpy.called).to.equal(false)

      // note that mock-pinning-service will indefinitely hang on pins with names that start with "queued-"
      abortController.abort()
      await expect(addPinResult).to.eventually.have.property('status', Status.Queued)

      expect(thenSpy.called).to.equal(true)
      expect(catchSpy.called).to.equal(false)
      expect(finallySpy.called).to.equal(true)
      expect(abortController.signal.aborted).to.equal(true)
    })

    it('Stops listening when provided signal times out', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const addPinResult = await remotePinner.addPin({
        cid,
        name: 'queued-test1',
        signal: AbortSignal.timeout(10)
      })
      expect(addPinResult.status).to.equal(Status.Queued)
    })

    it('Will not pin if provided an aborted signal', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const abortController = new AbortController()
      abortController.abort()
      const preAbortedRequest = remotePinner.addPin({
        cid,
        name: 'queued-test1',
        signal: abortController.signal
      })
      await expect(preAbortedRequest).to.eventually.be.rejectedWith('Signal was aborted prior to pinning')
    })

    it('Returns FailedToConnectToDelegates when unable to connect to delegates', async function () {})
    it('Returns NoMultiaddrsForOrigins when Helia has no multiaddrs', async function () {})
  })
  describe('replacePin', function () {
    it('Returns failed status', async function () {})
  })
})
