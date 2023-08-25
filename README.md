# @helia/remote-pinning <!-- omit in toc -->

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-remote-pinning.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-remote-pinning)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-remote-pinning/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-remote-pinning/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> A library that helps Helia users pin content via the IPFS pinning-services-api-spec

## Table of contents <!-- omit in toc -->

- [Install](#install)
- [Documentation](#documentation)
- [Lead Maintainer](#lead-maintainer)
- [Contributing](#contributing)
- [License](#license)
- [Contribute](#contribute)

## Install

```console
$ npm i @helia/remote-pinning
```

## Documentation

### Create remote pinner

```typescript
import { unixfs } from '@helia/unixfs'
import { Configuration, RemotePinningServiceClient } from '@ipfs-shipyard/pinning-service-client'
import { createHelia } from 'helia'
import { createRemotePinner } from '@helia/remote-pinning'

const helia = await createHelia()
const pinServiceConfig = new Configuration({
  endpointUrl: `${endpointUrl}`, // the URI for your pinning provider, e.g. `http://localhost:3000`
  accessToken: `${accessToken}` // the secret token/key given to you by your pinning provider
})

const remotePinningClient = new RemotePinningServiceClient(pinServiceConfig)
const remotePinner = createRemotePinner(helia, remotePinningClient)
```

### Add a pin

```typescript
const heliaFs = unixfs(helia)
const cid = await heliaFs.addBytes(encoder.encode('hello world'))
const addPinResult = await remotePinner.addPin({
  cid,
  name: 'helloWorld'
})
```


### Replace a pin

```typescript

const newCid = await heliaFs.addBytes(encoder.encode('hi galaxy'))
const replacePinResult = await remotePinner.replacePin({
  newCid,
  name: 'hiGalaxy',
  requestid: addPinResult.requestid
})

```

## Lead Maintainer

[SgtPooki](https://github.com/sgtpooki)

## Contributing

Contributions are welcome! This repository is part of the IPFS project and therefore governed by our [contributing guidelines](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md).

## License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

## Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia-remote-pinning/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
