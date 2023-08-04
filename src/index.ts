import type { Helia } from '@helia/interface'
import type { Configuration, RemotePinningServiceClient, Status, PinsPostRequest, Pin } from '@ipfs-shipyard/pinning-service-client'
import type { CID } from 'multiformats/cid'

export interface AddPinArgs extends Omit<Pin, 'cid'> {
  cid: CID
}

export interface ReplacePinArgs extends Omit<PinsPostRequest, 'pin'>, Omit<Pin, 'cid'> {
  cid: CID
}

class HeliaRemotePinner {
  constructor (private readonly heliaInstance: Helia, private readonly remotePinningClient: RemotePinningServiceClient) {
  }

  private async connectToDelegates (delegates: string[]): Promise<void> {
  }

  private async waitForPinStatus (requestid: string): Promise<Status> {

  }

  async addPin ({ cid, ...otherArgs }: AddPinArgs): Promise<PinStatus> {
    const pinStatus = await this.remotePinningClient.pinsPost({
      pin: {
        cid: cid.toString(),
        ...otherArgs
      }
    })
  }

  async replacePin ({ cid, requestid, ...otherArgs }: ReplacePinArgs): Promise<PinStatus> {
    const pinStatus = await this.remotePinningClient.pinsRequestidPost({
      requestid,
      pin: {
        cid: cid.toString(),
        ...otherArgs
      }
    })
  }
}

export function createRemotePinner (heliaInstance: Helia, remotePinningClient: RemotePinningServiceClient): HeliaRemotePinner {
  return new HeliaRemotePinner(heliaInstance, remotePinningClient)
}
