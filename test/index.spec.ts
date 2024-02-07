import { unixfs, type UnixFS } from '@helia/unixfs'
import { Configuration, RemotePinningServiceClient, Status } from '@ipfs-shipyard/pinning-service-client'
import { expect } from 'aegir/chai'
import { createHelia, type Helia } from 'helia'
import sinon, { type SinonSandbox, type SinonStub } from 'sinon'
import { type HeliaRemotePinner, createRemotePinner } from '../src/index.js'

const encoder = new TextEncoder()

describe('@helia/remote-pinning', function () {
  let sinonSandbox: SinonSandbox
  let remotePinner: HeliaRemotePinner
  let helia: Helia
  let remotePinningClient: RemotePinningServiceClient
  let heliaFs: UnixFS
  let dialStub: SinonStub

  const validatePinResults = async (name: string, count: number): Promise<void> => {
    const pinResults = await remotePinningClient.pinsGet({ name })
    expect(pinResults.results).to.have.lengthOf(count)
    expect(pinResults.count).to.equal(count)
  }

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
    const pins = await remotePinningClient.pinsGet()
    await Promise.all([...pins.results].map(async pin => remotePinningClient.pinsRequestidDelete({ requestid: pin.requestid })))
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

      // we need to wait for X time and then confirm the promise hasn't settled
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

    it('Stops listening when signal is aborted', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      dialStub.returns(Promise.resolve({} as any))
      const finallySpy = sinonSandbox.spy()
      const addPinResult = remotePinner.addPin({
        cid,
        name: 'queued-test2',
        signal: AbortSignal.timeout(100)
      })
      addPinResult.finally(finallySpy)
      expect(finallySpy.called).to.equal(false)
      await expect(addPinResult).to.eventually.have.property('status', Status.Queued)
      expect(finallySpy.called).to.equal(true)
    })

    it('Will not pin if provided an already aborted signal', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      const abortController = new AbortController()
      abortController.abort()
      dialStub.returns(Promise.resolve({} as any))
      const preAbortedRequest = remotePinner.addPin({
        cid,
        name: 'queued-test3',
        signal: abortController.signal
      })
      await expect(preAbortedRequest).to.eventually.be.rejected()
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

    it('can receive additional remote origins', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      dialStub.returns(Promise.resolve({} as any))
      const addPinResult = await remotePinner.addPin({
        cid,
        name: 'pinned-test4',
        origins: new Set(['http://localhost:4444'])
      })
      expect(addPinResult.status).to.equal(Status.Pinned)
    })
  })

  describe('replacePin', function () {
    it('will replace a previously added pin', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))
      dialStub.returns(Promise.resolve({} as any))
      const addPinResult = await remotePinner.addPin({
        cid,
        name: 'pinned-test3'
      })
      expect(addPinResult.status).to.equal(Status.Pinned)
      expect(addPinResult.requestid).to.be.a('string')
      await validatePinResults('pinned-test3', 1)
      await validatePinResults('pinned-test3-replaced', 0)

      const replacePinResult = await remotePinner.replacePin({
        cid,
        name: 'pinned-test3-replaced',
        requestid: addPinResult.requestid
      })

      expect(replacePinResult.status).to.equal(Status.Pinned)
      expect(replacePinResult.requestid).not.to.equal(addPinResult.requestid)

      await validatePinResults('pinned-test3', 0)
      await validatePinResults('pinned-test3-replaced', 1)
    })

    it('Will not replace the pin if provided an already aborted signal', async function () {
      const cid = await heliaFs.addBytes(encoder.encode('hello world'))

      const addPinResult = await remotePinner.addPin({
        cid,
        name: 'pinned-test5'
      })
      const abortController = new AbortController()
      abortController.abort()
      dialStub.returns(Promise.resolve({} as any))
      const preAbortedRequest = remotePinner.replacePin({
        cid,
        requestid: addPinResult.requestid,
        name: 'queued-test5-replaced',
        signal: abortController.signal
      })
      await expect(preAbortedRequest).to.eventually.be.rejected()
    })
  })
})
