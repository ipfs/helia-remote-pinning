<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/remote-pinning

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-remote-pinning.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-remote-pinning)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-remote-pinning/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-remote-pinning/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> Add remote pinning capabilities to Helia

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

Remote pinning allows you to delegate the hosting of content to another,
perhaps better connected, node or service on the IPFS network.

Instead of pinning blocks locally, we can use a Remote Pinning Service API
server to pin the blocks, ensuring they are persisted beyond the scope of the
current Helia node.

This is ideal for when creating content in short-lived environments, such as
browsers, for example.

This module exports two functions to help you do this - `createRemotePins`
and `heliaWithRemotePins`.

## createRemotePins

The `createRemotePins` function returns an object that implements the Helia
`Pins` interface.

The returned object can be used to replace the `.pins` property of your Helia
node so you can transparently ensure the longevity of pinned content, or you
can use it directly.

## heliaWithRemotePins

This function takes a Helia instance and some remote pinning config and
returns a Helia node that has been augmented with remote pinning.

You can then use the `.pins` API as normal, and pinned blocks will be pulled
up by the remote pinning service.

## Example

```TypeScript
import { createHelia } from 'helia'
import { heliaWithRemotePins } from '@helia/remote-pinning'
import { unixfs } from '@helia/unixfs'

// this node uses only remote pinning
const helia = heliaWithRemotePins(await createHelia(), {
  endpointUrl: `http://localhost:${process.env.PINNING_SERVER_PORT}`, // the URI for your pinning provider, e.g. `http://localhost:3000`
  accessToken: process.env.PINNING_SERVICE_TOKEN // the secret token/key given to you by your pinning provider
})

// add a block to Helia
const fs = unixfs(helia)
const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))

// pin the block
for await(const cid of helia.pins.add(cid, { signal: AbortSignal.timeout(5000) })) {
  console.info('pinned', cid)
}

// the block can now be retrieved from the remote pinning service
```

## API differences

The mapping between the Helia pinning API and the remote pinning API is not
perfect. The differences are:

1. The remote pinning API does not give detailed progress information, consequently the only CID yielded from `pins.add` will be the root CID
2. Helia's metadata support is richer than that of the remote pinning API - metadata values can only be strings
3. The remote pinning API accepts several extra arguments to several operations - these can be sent in a type-safe way using the `HeliaWithRemotePins` interface, which is the return type of the exported `heliaWithRemotePins` function

# Install

```console
$ npm i @helia/remote-pinning
```

## Browser `<script>` tag

Loading this module through a script tag will make its exports available as `HeliaRemotePinning` in the global namespace.

```html
<script src="https://unpkg.com/@helia/remote-pinning/dist/index.min.js"></script>
```

# API Docs

- <https://ipfs.github.io/helia-remote-pinning/modules/_helia_remote_pinning.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/ipfs/helia-remote-pinning/blob/main/packages/client/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/ipfs/helia-remote-pinning/blob/main/packages/client/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia-remote-pinning/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
