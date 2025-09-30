# Kite Changelog

## Upcoming release

No new featured for the next release yet, but dd them here when you make them!

## Kite version 1.7.0

A big thanks to @amilz for all of these!

### Changes

- Update Solana Kit to V3 (thanks @amilz)
- Added commitment param to `airdropIfRequired()` (and `createWallet()`) for quicker airdrop processing
- Adds @solana/promises to dependencies (thanks @amilz)
- Improve timeout logic for smart transactions based on commitment with ability to override default timeout value (thanks @amilz)

### Bug fixes

- Fix bug when when using finalized commitment, retry would attempt before the transaction had been confirmed even though the transaction has landed
- Fix creating token mints without Metadata

## Kite version 1.6.0

### Additions

- Add getTokenMetadata() function to retrieve token metadata using metadata pointer extensions. Supports both metadata stored directly in mint accounts and in separate metadata accounts. Returns name, symbol, URI, update authority, mint address, and additional metadata. Works with Token-Extension mints that have metadata pointer extension enabled.

## Kite version 1.5.5

### Additions

- Add `useBigEndian` option to `getPDAAndBump()`

### Bug fixes

- Fix 'Please set either httpUrl or requiredParam for cluster quicknode-devnet in clusters.ts' to `getExplorerLink()`. Getting Explorer URLs now uses the same logic as `connect()`.

## Kite version 1.5.4

### Changes

- Fix URLs in docs

## Kite version 1.5.3

### Changes

- Allow `Uint8Array` to be specified for `getPDAAndBump` for situations where people have their own encoding strategies.
- Bump solana kit to 2.3.0

## Kite version 1.5.2

### Bug fixes

- Fix issue with explorer URLs when using Helius clusters

## Kite version 1.5.1

### Changes

- Replace bs58 library with Solana Kit's native Base58 codec reduced dependencies

## Kite version 1.5.0

### Additions

- Add `checkIfAddressIsPublicKey()` function to validate if an address is a valid Ed25519 public key
- Add `checkAddressMatchesPrivateKey()` function to verify if a private key matches a given address
- Add QuickNode cluster support with "quicknode-mainnet", "quicknode-devnet", and "quicknode-testnet" options in `connect()`

### Changes

- Improve browser compatibility by using Uint8Array instead of Buffer throughout the codebase
- Documentation improvements and typo fixes

## Kite version 1.4.0

### Changes

- Use Uint8Array rather than Buffer for improved browser compatibility

## Kite version 1.3.4

### Changes

- You no longer need to specify any options when using `createWallets()` with just a number parameter.

## Kite version 1.3.3

### Additions

- Add `signMessageFromWalletApp()` for signing messages using a wallet app

## Kite version 1.3.2

### Additions

- Add `signatureBytesToBase58String()` and `signatureBase58StringToBytes()` utility functions for converting between signature formats
- Add `sendTransactionFromInstructionsWithWalletApp()` for wallet app integration

### Changes

- Removed using `TransactionSendingSigner` from `sendTransactionFromInstructions()`. This wasn't the right approach, browser apps should use `sendTransactionFromInstructionsWithWalletApp()`

## Kite version 1.3.1

### Additions

- `sendTransactionFromInstructions()` now supports both `KeyPairSigner` and `TransactionSendingSigner` for wallet integration.

## Kite version 1.3.0

### Additions

- `connect()` now accepts RPC and RPC subscription clients directly as arguments. This allows you to re-use existing connections in browser environments and use Kite with custom RPC transports.

## Kite version 1.2.5

### Bug fixes

- Docs: use 'Token Extensions' consistently

## Kite version 1.2.4

### Bug fixes

- Update `connection.rpc` type to better reflect Solana Kit.

## Kite version 1.2.3

### Additions

- Add `getAccountsFactory()`

## Kite version 1.2.2

### Additions

- More error messages are now shown in the new, friendly format.

## Kite version 1.2.1

### Additions

- Error messages from Anchor are also now shown in the new, friendly format. No more custom program errors!

## Kite version 1.2.0

### Additions

- Errors from transactions will now include:
  - a better `message`, featuring
    - the name of the program
    - the instruction handler
    - the error text from the program's instruction handler
      Rather than 'custom program error'
  - a `transaction` property, so you can inspect the transaction (including its logs) from the error.

### Bug fixes

- Fix accidental nested array on getLogs return type
- Add missing maxSupportedTransactionVersion param to `getLogs()`

## Kite version 1.1.1

- Update to latest @solana/kit

## Kite version 1.1.0

### Additions

- Main package is now `solana-kite`.
- Add `getPDAAndBump()` - calculates a Program Derived Address (PDA) and its bump seed from a program address and seeds, automatically encoding different seed types (strings, addresses, and bigints).
- `getTokenAccountBalance()` - can now take either a wallet and token mint (it will find the token account and then get the balance), or a token account address.
- Add `checkTokenAccountIsClosed()` - checks if a token account is closed or doesn't exist, supporting both direct token account address and wallet+mint lookup.
- Add TSDoc comments for all functions, so VSCode and other editors can display parameters nicely.
- Solana `@solana/kit` has been renamed to `@solana/kit`, and dependencies have been updated accordingly.

### Bug fixes

- Fix bug where types were generated but not shown to consuming apps.
- Fix bug where `mintTokens()` was minting to the mint authority rather than the destination.

## Kite version 1.0.1

- Add `getTokenAccountBalance()`
- Minor docs updates

## Kite version 1.0

- New name: `@helius-dev/kite`
- Use @solana/web3.js version 2
- A new `connect()` method is provided, which returns an object with `rpc`, `rpcSubscriptions`, `sendAndConfirmTransaction()`, `getExplorerLink()` and the other functions in this library.
- Most functions are now a property of `connection`. For example, `connection.getLamportBalance()` instead of `getBalance()`.
- Added support for Helius RPCs - just specify the name and as long as the Helius API key is set in the environment, it will be used.
- We've tried to match the coding style of web3.js v2
  - `xToY()` becomes `createXFromY`. `create` is now the preferred nomenclature, so `initializeKeypair` is now `createWallet`,
  - Functions that return a `doThing()` function are called `doThingFactory()`
  - We do not use web3.js Hungarian notation - this library uses `getFoo()` rather than `getFooPromise()` since TS rarely uses Hungarian.
- `initializeKeypair` is now `createKeyPairSigner`
- Since web3.js uses Promises in more places, nearly every helper function returns a `Promise<>` now, so you'll use `await` more often.
- localhost links on `getExplorerLink()` no longer add an unnecessary customUrl parameter
- `confirmTransaction` is now `getRecentSignatureConfirmation`
- We no longer support base58 encoded private keys - instead we use the 'Array of numbers' format exclusively. If you have base58 encoded private keys you can convert them with the previous version of this library.
- Use `tsx` over `esrun`. While `tsx` needs a `tsconfig.json` file, `tsx` has many more users and is more actively maintained.
- Remove CommonJS support.

# Previous changelog as @solana/helpers

## 2.5

- Add `makeTokenMint()`
- 2.5.4 includes a few fixes to build system and TS types that were missing in earlier 2.5.x releases
- 2.5.6 includes a fix for esm module post-build script

## 2.4

- Add `createAccountsMintsAndTokenAccounts()`

## 2.3

Improved browser support by only loading node-specific modules when they are needed. Thanks @piotr-layerzero!

## 2.2

- Add `getSimulationComputeUnits()`

## 2.1

- Add `initializeKeypair()`
- Change documentation to be task based.

## 2.0

- **Breaking**: Replace both `requestAndConfirmAirdropIfRequired()` and `requestAndConfirmAirdrop()` with a single function, `airdropIfRequired()`. See [README.md]!
- Fix error handling in `confirmTransaction()` to throw errors correctly.
- Added `getLogs()` function

## 1.5

- Added `getExplorerLink()`

## 1.4

- Added `requestAndConfirmAirdropIfRequired()`

## 1.3

- Now just `helpers`. The old `node-helpers` package is marked as deprecated.
- Added `requestAndConfirmAirdrop()`
- Added `getCustomErrorMessage()`

## 1.2

- Added `addKeypairToEnvFile()`

## 1.0

Original release.
