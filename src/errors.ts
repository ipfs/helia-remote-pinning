// when remote pinning service returns delegates, if we can't connect to any, we won't be able to provide our CID's
// content to the service, and must abort.
export class FailedToConnectToDelegates extends Error {}
