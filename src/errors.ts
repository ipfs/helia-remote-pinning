/**
 * when remote pinning service returns delegates, if we can't connect to any, we won't be able to provide our CID's
 * content to the service, and must abort.
 */
export class FailedToConnectToDelegates extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'ERR_FAILED_TO_CONNECT_TO_DELEGATES'
  }
}
