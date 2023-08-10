import { unixfs, type UnixFS } from '@helia/unixfs'
import { Configuration, RemotePinningServiceClient, Status } from '@ipfs-shipyard/pinning-service-client'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import sinon, { type SinonSandbox, type SinonStub } from 'sinon'
import { FailedToConnectToDelegates } from '../src/errors.js'
import { type HeliaRemotePinner, createRemotePinner } from '../src/index.js'
import type { Helia } from '@helia/interface'

const encoder = new TextEncoder()

describe('@helia/remote-pinning', function () {
  let sinonSandbox: SinonSandbox
  let remotePinner: HeliaRemotePinner
  let helia: Helia
  let remotePinningClient
  let heliaFs: UnixFS
  let dialStub: SinonStub
  beforeEach(async function () {
    sinonSandbox = sinon.createSandbox()
    helia = await createHelia()
    heliaFs = unixfs(helia)
    dialStub = sinonSandbox.stub(helia.libp2p, 'dial')
    const pinServiceConfig = new Configuration({
      endpointUrl: `http://localhost:${process.env.PINNING_SERVER_PORT}`, // the URI for your pinning provider, e.g. `http://localhost:3000`
      accessToken: process.env.PINNING_SERVICE_TOKEN // the secret token/key given to you by your pinning provider
    })

    remotePinningClient = new RemotePinningServiceClient(pinServiceConfig)
    remotePinner = createRemotePinner(helia, remotePinningClient)
  })
  afterEach(async function () {
    sinonSandbox.restore()
    await helia.stop()
  })
  describe('addPin', function () {
    it('Returns pinned status when pinning succeeds', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      dialStub.returns(Promise.resolve({} as any))
      const addPinResult = await remotePinner.addPin({
        cid,
        name: 'pinned-test1'
      })
      expect(addPinResult.status).to.equal(Status.Pinned)
    })

    it('Returns failed status when pinning fails', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      dialStub.returns(Promise.resolve({} as any))
      const addPinResult = await remotePinner.addPin({
        cid,
        name: 'failed-test1'
      })
      expect(addPinResult.status).to.equal(Status.Failed)
    })

    it('will await a queued pin until a signal times out', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const abortController = new AbortController()
      const thenSpy = sinonSandbox.spy()
      const catchSpy = sinonSandbox.spy()
      const finallySpy = sinonSandbox.spy()
      dialStub.returns(Promise.resolve({} as any))
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

    // it('Stops listening when provided signal times out', async function () {
    //   const cid = await heliaFs.addBytes(encoder.encode('hello world'))
    //   dialStub.returns(Promise.resolve({} as any))
    //   const addPinResult = await remotePinner.addPin({
    //     cid,
    //     name: 'queued-test2',
    //     signal: AbortSignal.timeout(100)
    //   })
    //   expect(addPinResult.status).to.equal(Status.Queued)
    // })

    it('Will not pin if provided an aborted signal', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const abortController = new AbortController()
      abortController.abort()
      dialStub.returns(Promise.resolve({} as any))
      const preAbortedRequest = remotePinner.addPin({
        cid,
        name: 'queued-test3',
        signal: abortController.signal
      })
      await expect(preAbortedRequest).to.eventually.be.rejectedWith('Signal was aborted prior to pinning')
    })

    it('Returns FailedToConnectToDelegates when unable to connect to delegates', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      dialStub.throws(new Error('Stubbed dial failure'))
      const addPinResult = remotePinner.addPin({
        cid,
        name: 'pinned-test2'
      })
      // stub heliaInstance.libp2p.dial to throw an error
      await expect(addPinResult).to.eventually.be.rejectedWith(FailedToConnectToDelegates)
    })

    it('Does not return FailedToConnectToDelegates when unable to connect to a single delegate', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      dialStub.onCall(0).returns(Promise.resolve({} as any))
      dialStub.onCall(1).throws(new Error('Stubbed dial failure'))
      const addPinResult = remotePinner.addPin({
        cid,
        name: 'pinned-test2'
      })

      await expect(addPinResult).to.eventually.have.property('status', Status.Pinned)
    })
  })
  describe('replacePin', function () {
    it('Returns failed status', async function () {})
  })
})
