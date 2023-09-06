## [1.1.1](https://github.com/ipfs/helia-remote-pinning/compare/v1.1.0...v1.1.1) (2023-09-06)


### Bug Fixes

* allow handlePinStatus to continue if delegate dials fail ([784b763](https://github.com/ipfs/helia-remote-pinning/commit/784b7630054a69549184e3218feea32f835c86fe))

## [1.1.0](https://github.com/ipfs/helia-remote-pinning/compare/v1.0.0...v1.1.0) (2023-09-06)


### Features

* filter multiaddrs for origins ([caffdbf](https://github.com/ipfs/helia-remote-pinning/commit/caffdbf759fac3e36ad3700f9093b05eeaca09ea))


### Bug Fixes

* origins when using web3.storage ([654ddfa](https://github.com/ipfs/helia-remote-pinning/commit/654ddfa0e8187f9d682e7219e6d9cca8710120f9))


### Trivial Changes

* configure publishConfig and aegir check-project ([156539d](https://github.com/ipfs/helia-remote-pinning/commit/156539d129ca1b81f7fe5f86c23c7f14db52080a))
* configure publishConfig and aegir check-project ([1fb7c39](https://github.com/ipfs/helia-remote-pinning/commit/1fb7c392f00c9b525d69a7d6d40b45b9161d7b9b))
* update .github/workflows/js-test-and-release.yml ([#11](https://github.com/ipfs/helia-remote-pinning/issues/11)) ([a9888e3](https://github.com/ipfs/helia-remote-pinning/commit/a9888e3012692181e71b0ff92308ef04ce08e412))

## 1.0.0 (2023-08-31)


### Features

* create @helia/remote-pinner implementation ([1b8e29e](https://github.com/ipfs/helia-remote-pinning/commit/1b8e29e4ce397fcb40b958a2dcfb156d4fe29045))
* create @helia/remote-pinner library ([7ee93a7](https://github.com/ipfs/helia-remote-pinning/commit/7ee93a7eba92bd257a787f113fb7dad7f15b7f23))
* initial project setup ([24d3103](https://github.com/ipfs/helia-remote-pinning/commit/24d3103cccafb19ec2bd6d81a50ee0aeeef895bf))
* pRetry logic can be overridden with config ([6c2fb6e](https://github.com/ipfs/helia-remote-pinning/commit/6c2fb6eb3701e0172fbcfb61bc9dea22d14a4685))


### Bug Fixes

* add error name to custom err ([5fe0bd9](https://github.com/ipfs/helia-remote-pinning/commit/5fe0bd98cbb3471e1e29bc1e756dd4a7a39845c2))
* add release script and fix semantic-release ([d2003dd](https://github.com/ipfs/helia-remote-pinning/commit/d2003dd6ea1a2b9747729ae17a618c52da451dbd))
* dial delegates in parallel ([25855da](https://github.com/ipfs/helia-remote-pinning/commit/25855da6dc95df2acfd157ced1d65dd007723dd4))
* don't export HeliaRemotePinner class ([52d998b](https://github.com/ipfs/helia-remote-pinning/commit/52d998b4f3da5856f3eaced8474f547a368222fb))
* fwd signal to remote pinner ([b85767a](https://github.com/ipfs/helia-remote-pinning/commit/b85767a1a69db3669cce2dd054062fbdac5e0d49))
* use @libp2p/logger ([ebffb67](https://github.com/ipfs/helia-remote-pinning/commit/ebffb674af55af78bc7c867c561bf479251c7a86))


### Trivial Changes

* add lint script ([1c7dd85](https://github.com/ipfs/helia-remote-pinning/commit/1c7dd8567eed4f24bf0c5b55bc4d784664e3bd8f))
* don't export HeliaRemotePinningOptions ([637ebc2](https://github.com/ipfs/helia-remote-pinning/commit/637ebc2c0c57110bd4f0a3a94f9038222403a055))
* remove debugging code ([07fc527](https://github.com/ipfs/helia-remote-pinning/commit/07fc52757af901d757424ec5aa2189a89de8f782))
* remove unused options ([7abd44a](https://github.com/ipfs/helia-remote-pinning/commit/7abd44a02547a911a77fede5105eb2d85e9c8aed))
* removing implementation prior to team PR ([0d22511](https://github.com/ipfs/helia-remote-pinning/commit/0d225112e60e8487fe11cc0ccd2f48c49f88eac3))
* update .github/workflows/js-test-and-release.yml ([#6](https://github.com/ipfs/helia-remote-pinning/issues/6)) ([735d848](https://github.com/ipfs/helia-remote-pinning/commit/735d84880c0ce0eae9252370cf27ee0891922d50))
* Update .github/workflows/stale.yml [skip ci] ([300b222](https://github.com/ipfs/helia-remote-pinning/commit/300b2226b8fdc3768ed11acd4b67372f36351455))


### Documentation

* add usage documentation ([83ebc05](https://github.com/ipfs/helia-remote-pinning/commit/83ebc05ed8ecb1b18049dd2ff63b5456e080daf8))
* **readme:** import actual library in example code ([12820e3](https://github.com/ipfs/helia-remote-pinning/commit/12820e350c695ec543394f896297b112eeab2456))
* **readme:** whitespace cleanup ([ebd1eb2](https://github.com/ipfs/helia-remote-pinning/commit/ebd1eb2228bc748032edf1a96bbc39d77ed1f404))
* **readme:** whitespace cleanup ([34a62c9](https://github.com/ipfs/helia-remote-pinning/commit/34a62c98da64589deae9ab95b64ed3a433b0528b))


### Dependencies

* bump p-retry from 5.1.2 to 6.0.0 ([08c2654](https://github.com/ipfs/helia-remote-pinning/commit/08c265495a9feb58b1788f1bfb627fd8f6ffe01e))
* bump p-retry from 5.1.2 to 6.0.0 ([ba12302](https://github.com/ipfs/helia-remote-pinning/commit/ba123023da2c457414e2619753dc10ea8c6d6c92))


### Tests

* 100% test coverage and update deps ([44e40e4](https://github.com/ipfs/helia-remote-pinning/commit/44e40e430ecbe2d2fc20b9daa6a6a331646ed4d0))
* add initial tests ([2bba417](https://github.com/ipfs/helia-remote-pinning/commit/2bba417ef1c71938fff55cac74710c1154bc00ba))
* minor changes to address CI failure ([909be6e](https://github.com/ipfs/helia-remote-pinning/commit/909be6e1ecfc67af19667c3afd9509209d7e958a))
* shore up tests ([3c197a2](https://github.com/ipfs/helia-remote-pinning/commit/3c197a2163557a04e17c1cb935a2bcff319bf778))
