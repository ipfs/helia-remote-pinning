<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/pinning-service-api-server

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-remote-pinning.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-remote-pinning)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-remote-pinning/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-remote-pinning/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> An IPFS Pinning Service API server powered by Helia

# About

<!--

!IMPORTANT!

Everything in this README between "# About" and "# Install" is automatically
generated and will be overwritten the next time the doc generator is run.

To make changes to this section, please update the @packageDocumentation section
of src/index.js or src/index.ts

To experiment with formatting, please run "npm run docs" from the root of this
repo and examine the changes made.

-->

Implements HTTP routes for a Fastify server that conform to the [IPFS Pinning Service API](https://ipfs.github.io/pinning-services-api-spec/).

## Example

```typescript
import { createHelia } from 'helia'
import { createPinningServiceAPIServer} from '@helia/pinning-service-api-server'

const helia = await createHelia()
const server = await createRemotePinningServer(helia, {
  validateAccessToken: async (accessToken, options) => {
    // validate the user passed a valid token
    return true
  },
  listen: {
    // fastify listen options
  }
})

// now make http requests
```

Alternatively if you have a Fastify instance already you can add routes to it.

## Example

```typescript
import fastify from 'fastify'
import cors from '@fastify/cors'
import { createHelia } from 'helia'
import routes from '@helia/pinning-service-api-server/routes'

const server = fastify({
 // fastify options
})
await server.register(cors, {
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  strictPreflight: false
})

const helia = await createHelia()

// configure Routing V1 HTTP API routes
routes(server, helia)

await server.listen({
  // fastify listen options
})

// now make http requests
```

# Install

```console
$ npm i @helia/pinning-service-api-server
```

# API Docs

- <https://ipfs.github.io/helia-remote-pinning/modules/_helia_pinning_service_api_server.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/ipfs/helia-remote-pinning/blob/main/packages/server/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/ipfs/helia-remote-pinning/blob/main/packages/server/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia-remote-pinning/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
