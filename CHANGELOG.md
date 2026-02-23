# Kite Changelog

## Upcoming release

No new features for the next release yet, but add them here when you make them!

## Kite version 3.2.1

### Fixes

- Updated all functions that accept signers (`sendTransactionFromInstructions`, `createTokenMint`, `mintTokens`, `transferTokens`, `transferLamports`, `updateTokenMetadata`, `createWallet`, `createWallets`, `loadWalletFromFile`, `loadWalletFromEnvironment`) to accept `TransactionSigner` instead of `TransactionSendingSigner`, allowing a broader range of signer types
- Updated `@isaacs/brace-expansion` and `minimatch` dependencies to fix security issues.

## Kite version 3.2.0

### Additions

- Added `updateTokenMetadata()` function to update Token-2022 metadata fields including name, symbol, uri, and additionalMetadata

### Fixes

- Fixed `sendTransactionFromInstructions` feePayer parameter to correctly accept `TransactionSigner` instead of `TransactionSendingSigner` for better type compatibility

## Kite version 3.1.0

### Additions

- Added `getTokenAccounts()` function to retrieve all token accounts owned by a wallet address. Queries both the classic SPL Token program and Token Extensions program. Includes optional `excludeZeroBalance` parameter to filter out empty accounts
- Added Triton RPC provider support with `triton-mainnet`, `triton-devnet`, and `triton-testnet` cluster names.
- Exported all factory functions for better tree shaking support for advanced users.

## Kite version 3.0.0

### Major Changes

- **Kite is now a Solana Kit plugin** - Internally rewritten to use the Solana Kit plugin pattern, making it composable with other plugins
- New `createKitePlugin()` function allows using Kite as a plugin: `rpc.use(createKitePlugin({ clusterNameOrURL: 'devnet' }))`
- The existing `connect()` convenience function remains unchanged and is 100% backwards compatible

### Backwards Compatibility

This release maintains full API compatibility with Kite 2.x. Projects can upgrade from 2.x to 3.0.0 without any code changes. The major version bump reflects the significant internal refactoring to use the plugin architecture, but all existing functionality works identically.

### Technical Details

- `connect()` now internally uses the plugin pattern but maintains the same synchronous API
- Both plugin usage and the convenience function provide identical functionality
- All 141 tests pass with no changes required

## Kite version 2.3.0

### Additions

- Add `burnTokens()` function to burn tokens from a token account. Supports both Token Extensions and Classic Tokens with proper decimal handling
- Add `closeTokenAccount()` function to close token accounts and reclaim rent. Supports both direct token account address and wallet+mint lookup
- Add `getLatestBlockhash()` function to get the latest blockhash from the network
- Add `checkHealth()` function to check the health status of the cluster node
- Add `getCurrentSlot()` function to get the current slot the node is processing
- Add `getMinimumBalance()` function to calculate the minimum balance required for rent exemption for a given data size
- Add `getTransaction()` function to get transaction details by signature

### Changes

- Add optional `commitment` parameter to `transferLamports()` (defaults to "confirmed") to ensure transactions reach desired commitment level before returning

## Kite version 2.2.0

### Changes

- Updated `sendTransactionFromInstructionsWithWalletApp()` to accept `TransactionModifyingSigner` instead of `TransactionSigner` to properly support browser wallets via Wallet Standard
- Updated all token transfer functions (`transferLamports()`, `transferTokens()`, `createTokenMint()`, `mintTokens()`) to accept `TransactionSendingSigner` instead of just `KeyPairSigner`, enabling broader signer compatibility
- Updated JSDoc comments and type definitions throughout to reflect new signer types

## Kite version 2.1.0

### Changes

- **Upgraded @solana/kit from 5.0.0 to 5.1.0** - Updates to the latest stable release of the underlying Solana Web3.js 2.0 library

## Kite version 2.0.0

### Breaking Changes

- **Upgraded @solana/kit from 3.0.3 to 5.0.0** - This is a major version upgrade of the underlying Solana Web3.js 2.0 library
- Upgraded all @solana-program packages to their latest versions:
  - `@solana-program/compute-budget`: 0.9.0 → 0.11.0
  - `@solana-program/memo`: 0.8.0 → 0.10.0
  - `@solana-program/system`: 0.8.0 → 0.10.0
  - `@solana-program/token`: 0.6.0 → 0.9.0
  - `@solana-program/token-2022`: 0.5.0 → 0.6.1
- Upgraded `@solana/transaction-confirmation` from 3.0.3 to 5.0.0

### Bug Fixes

- Fixed test environment variable cleanup to prevent test interference in connect tests

## Kite version 1.8.0

### Additions

- Add `watchLamportBalance()` function to watch for real-time changes to SOL balances using WebSocket subscriptions. Returns a cleanup function to stop watching.
- Add `watchTokenBalance()` function to watch for real-time changes to token balances using WebSocket subscriptions. Supports both Token Extensions and Classic Tokens. Returns a cleanup function to stop watching.

## Kite version 1.7.4

### Additions

- Add `fileName` option to `createWallet()` to save the private key to a JSON file using the 'array of numbers' format used by Solana CLI tools.

## Kite version 1.7.3

### Changes

- Add better error messages for Airdrop request limits
- Re-export `RpcTransport` type to fix build error where tsup reported it as unused
- Add npm override for `glob@^12.0.0` to fix sucrase compatibility issue (see https://github.com/alangpierce/sucrase/pull/846)

## Kite version 1.7.1

### Bug fixes

- Expose `checkIfAddressIsPublicKey()` via connection to match the documentation

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
