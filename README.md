> [!NOTE]  
> The Kite repo has been moved to https://github.com/mikemaccana/kite

# The modern TypeScript framework for Solana 🪁

[![Tests](https://github.com/helius-labs/kite/actions/workflows/tests.yaml/badge.svg)](https://github.com/helius-labs/kite/actions/workflows/tests.yaml)

Kite leverages the speed and elegance of [`@solana/kit`](https://github.com/anza-xyz/kit) (previously known as `@solana/web3.js` version 2) but allows you to **complete most Solana tasks in a single step**. Since Kite uses `@solana/kit` for the heavy lifting, Kite is fully compatible with `@solana/kit`. If you decide you no longer need Kite, you can easily remove it and use plain `@solana/kit`.

Users of VSCode and other popular editors will see TSDoc comments with parameters, return types, and usage examples right in their editor.

> [!TIP]
> Kite is the `@solana/kit` update of `@solana-developers/helpers`, the [most popular high-level library for @solana/web3.js version 1](https://www.npmjs.com/package/@solana-developers/helpers), by the original author. The `kite` package includes updated versions of most of the original helpers, including contributions from [Helius](https://helius.xyz), [the Solana Foundation](https://solana.org/), [Anza](https://anza.xyz), [Turbin3](https://turbin3.com/), [Unboxed Software](https://beunboxed.com/), and [StarAtlas](https://staratlas.com). The ones we haven't added yet should be there soon.

Kite is for everyone! You don't need to use Helius RPCs to use Kite. However if you do use Helius RPCs, Kite will take advantage of Helius features like priority fee estimates and low-latency transaction confirmation.

Kite works both in the browser and node.js, is small, and has [minimal dependencies](https://github.com/helius-labs/kite/blob/main/package.json#L48). It also works with **Anchor**.

## What can I do with Kite?

Kite includes functions for:

### Connecting

- [Connect to a Solana cluster](#starting-kite--connecting-to-an-rpc)

### Wallets

- [Create a new wallet](#createwallet---create-a-new-wallet)
- [Create multiple wallets](#createwallets---create-multiple-wallets)
- [Load a wallet from a file](#loadwalletfromfile---load-a-wallet-from-file)
- [Load a wallet from an environment variable](#loadwalletfromenvironment---load-a-wallet-from-environment)

### SOL

- [Airdrop SOL if balance is low](#airdropifrequired---airdrop-sol-if-balance-is-low)
- [Get a SOL balance](#getlamportbalance---get-the-sol-balance-of-an-account)
- [Transfer SOL between wallets](#transferlamports---transfer-sol-between-wallets)

### Tokens

- [Create a new token](#createtokenmint---create-a-new-token)
- [Get token account address](#gettokenaccountaddress---get-token-account-address)
- [Get token mint information](#getmint---get-token-mint-information)
- [Get token account balance](#gettokenaccountbalance---get-token-account-balance)
- 🆕 [Check if token account is closed](#checktokenaccountisclosed---check-if-token-account-is-closed)
- [Mint tokens to a wallet](#minttokens---mint-tokens-to-an-account)
- [Transfer tokens between wallets](#transfertokens---transfer-tokens-between-accounts)

### Transactions

- [Send a transaction from multiple instructions](#sendtransactionfrominstructions---send-a-transaction-with-multiple-instructions)
- [Send and confirm a transaction you're already created](#sendandconfirmtransaction---send-and-confirm-a-transaction)
- [Check if a transaction is confirmed](#getrecentsignatureconfirmation---get-transaction-confirmation-status)
- [Get transaction logs](#getlogs---get-transaction-logs)
- 🆕 [Get a PDA from seeds](#getpdaandbump---get-a-program-derived-address-and-bump-seed)

### Explorer

- [Get a Solana Explorer link](#getexplorerlink---get-solana-explorer-link)

We'll be adding more functions over time. You're welcome to [suggest a new function](https://github.com/helius-dev/kite/issues) or read the [CONTRIBUTING guidelines](https://github.com/helius-labs/kite/blob/main/CONTRIBUTING.md) and [send a PR](https://github.com/helius-dev/kite/pulls).

## Why the name 'Kite'?

Solana itself is named after [a beach](https://en.wikipedia.org/wiki/Solana_Beach,_California). Kite is a high-level framework, so what is high above a beach? Kites! 🪁😃

Coincidentally, a couple of weeks after Kite's release, Solana web3.js version 2 was renamed `kit`. So **Kite now flies on top of Kit**.

## Can I use Kite with Anchor?

**Yes.** Here's a [full Anchor demo token Swap app using Kite, Kit and Codama](https://github.com/mikemaccana/anchor-escrow-2025).

## Installation

```bash
npm i @helius-dev/kite
```

## Starting Kite & connecting to an RPC

To start Kite, you need to connect to an RPC.

To use the local cluster (ie, `solana-test-validator` running on your machine):

```typescript
import { connect } from "@helius-dev/kite";

const connection = connect();
```

You can also specify a cluster name. The connection object defaults to `localnet` but any of the following cluster names are supported: `mainnet-beta` (or `mainnet`), `testnet`, `devnet`, `helius-mainnet`, `helius-testnet`, or `helius-devnet`.

```typescript
const connection = connect("helius-devnet");
```

The Helius names require the environment variable `HELIUS_API_KEY` to be set in your environment.

You can also specify an arbitrary RPC URL and RPC subscription URL:

```typescript
const connection = connect("https://mainnet.example.com/", "wss://mainnet.example.com/");
```

After you've made a connection Kite is ready to use. **You don't need to set up any factories, they're already configured.** A `connection` has the following functions ready out of the box:

## createWallet - Create a new wallet

> Like `initializeKeypair` from `@solana/helpers`

Creates a new Solana wallet (more specifically a `KeyPairSigner`).

If you like, the wallet will have a prefix/suffix of your choice, the wallet will have a SOL balance ready to spend, and the keypair will be saved to a file for you to use later.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.createWallet({
  prefix, // optional: prefix for wallet address
  suffix, // optional: suffix for wallet address
  envFileName, // optional: path to .env file to save keypair
  envVariableName, // optional: name of environment variable to store keypair
  airdropAmount, // optional: amount of SOL to airdrop
});
```

### Options

All options are optional:

- `prefix`: `string | null` - Prefix for wallet address
- `suffix`: `string | null` - Suffix for wallet address
- `envFileName`: `string | null` - Path to .env file to save keypair
- `envVariableName`: `string` - Name of environment variable to store keypair (default: "PRIVATE_KEY")
- `airdropAmount`: `Lamports | null` - Amount of SOL to airdrop (default: 1 SOL)

### Examples

Create a basic wallet:

```typescript
const wallet = await connection.createWallet();
```

Create a wallet with a specific prefix and suffix:

```typescript
const wallet = await connection.createWallet({
  prefix: "COOL",
  suffix: "WALLET",
});
```

Create a wallet and save it to an environment file:

```typescript
const wallet = await connection.createWallet({
  envFileName: ".env",
  envVariableName: "MY_WALLET_KEY",
});
```

Create a wallet with a custom airdrop amount:

```typescript
const wallet = await connection.createWallet({
  airdropAmount: lamports(2n * SOL),
});
```

## loadWalletFromFile - Load a wallet from file

> Like `getKeypairFromFile` from `@solana/helpers`

Loads a wallet (more specifically a `KeyPairSigner`) from a file. The file should be in the same format as files created by the `solana-keygen` command.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.loadWalletFromFile(keyPairPath);
```

### Options

- `keyPairPath`: `string` - Path to load keypair from file

## loadWalletFromEnvironment - Load a wallet from environment

> Like `getKeypairFromEnvironment` from `@solana/helpers`

Loads a wallet (more specifically a `KeyPairSigner`) from an environment variable. The keypair should be in the same 'array of numbers' format as used by `solana-keygen`.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.loadWalletFromEnvironment(envVariableName);
```

### Options

- `envVariableName`: `string` - Name of environment variable containing the keypair (default: "PRIVATE_KEY")

## sendAndConfirmTransaction - Send and confirm a transaction

> Like `sendTransaction` from `@solana/helpers`

Sends a transaction and waits for confirmation.

Returns: `Promise<void>`

```typescript
await connection.sendAndConfirmTransaction(transaction, options);
```

### Options

- `transaction`: `VersionedTransaction` - Transaction to send
- `options`: `Object` (optional)
  - `commitment`: `Commitment` - Desired confirmation level
  - `skipPreflight`: `boolean` - Whether to skip preflight transaction checks

## getLamportBalance - Get the SOL balance of an account

Gets the SOL balance of an account, in lamports.

Returns: `Promise<Lamports>`

```typescript
const balance = await connection.getLamportBalance(address, commitment);
```

### Options

- `address`: `string` - Address to check balance for
- `commitment`: `Commitment` (optional) - Desired confirmation level (default: "finalized")

## getExplorerLink - Get Solana Explorer link

Get a link to view an address, transaction, or token on Solana Explorer. The link will automatically use your RPC.

Returns: `string` - Explorer URL

Get a link to view an address:

```typescript
const addressLink = connection.getExplorerLink("address", "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn");
```

Get a link to view a transaction:

```typescript
const transactionLink = connection.getExplorerLink(
  "transaction",
  "5rUQ2tX8bRzB2qJWnrBhHYgHsafpqVZwGwxVrtyYFZXJZs6yBVwerZHGbwsrDHKbRtKpxnWoHKmBgqYXVbU5TrHe",
);
```

Or if you like abbrieviations:

```typescript
const transactionLink = connection.getExplorerLink(
  "tx",
  "5rUQ2tX8bRzB2qJWnrBhHYgHsafpqVZwGwxVrtyYFZXJZs6yBVwerZHGbwsrDHKbRtKpxnWoHKmBgqYXVbU5TrHe",
);
```

Get a link to view a block:

```typescript
const blockLink = connection.getExplorerLink("block", "180392470");
```

### Options

- `linkType`: `"transaction" | "tx" | "address" | "block"` - Type of entity to link to
- `id`: `string` - The address, signature, or block to link to

## getRecentSignatureConfirmation - Get transaction confirmation status

Checks the confirmation status of a recent transaction.

Returns: `Promise<boolean>`

```typescript
const confirmed = await connection.getRecentSignatureConfirmation(signature);
```

### Options

- `signature`: `string` - The signature of the transaction to check

## airdropIfRequired - Airdrop SOL if balance is low

> Like `airdropIfRequired` from `@solana/helpers`

Airdrops SOL to an address if its balance is below the specified threshold.

Returns: `Promise<string | null>` - Transaction signature if airdrop occurred, null if no airdrop was needed

```typescript
const signature = await connection.airdropIfRequired(address, airdropAmount, minimumBalance);
```

### Options

- `address`: `Address` - Address to check balance and potentially airdrop to
- `airdropAmount`: `Lamports` - Amount of lamports to airdrop if needed
- `minimumBalance`: `Lamports` - Minimum balance threshold that triggers airdrop

## getLogs - Get transaction logs

Retrieves logs for a transaction.

Returns: `Promise<Array<string>>`

```typescript
const logs = await connection.getLogs(signature);
```

### Options

- `signature`: `string` - Transaction signature to get logs for

## transferLamports - Transfer SOL between wallets

Transfers SOL from one wallet to another.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.transferLamports({
  source,
  destination,
  amount,
  skipPreflight,
  maximumClientSideRetries,
  abortSignal,
});
```

### Options

- `source`: `KeyPairSigner` - The wallet to send SOL from
- `destination`: `Address` - The wallet to send SOL to
- `amount`: `Lamports` - Amount of lamports to send
- `skipPreflight`: `boolean` (optional) - Whether to skip preflight checks (default: true)
- `maximumClientSideRetries`: `number` (optional) - Maximum number of times to retry sending the transaction (default: 0)
- `abortSignal`: `AbortSignal | null` (optional) - Signal to abort the transaction (default: null)

## createTokenMint - Create a new token with metadata

Creates a new SPL token mint with specified parameters.

Returns: `Promise<Address>`

### Options

- `mintAuthority`: `KeyPairSigner` - Authority that can mint new tokens
- `decimals`: `number` - Number of decimal places for the token
- `name`: `string` - Name of the token
- `symbol`: `string` - Symbol of the token
- `uri`: `string` - URI pointing to the token's metadata (eg: "https://arweave.net/abc123")
- `additionalMetadata`: `Record<string, string> | Map<string, string>` (optional) - Additional metadata fields

### Examples

Create a token with additional metadata:

```typescript
const mintAddress = await connection.createTokenMint({
  mintAuthority: wallet,
  decimals: 9,
  name: "My Token",
  symbol: "MYTKN",
  uri: "https://example.com/token-metadata.json",
  additionalMetadata: {
    description: "My custom token",
  },
});
```

A `metadata.json` file, and any images inside, should be hosted at an [decentralized storage service](https://solana.com/developers/guides/getstarted/how-to-create-a-token#create-and-upload-image-and-offchain-metadata). The file itself is at minimum:

```json
{
  "image": "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/image.png"
}
```

Images should be square, and either 512x512 or 1024x1024 pixels, and less than 100kb if possible.

## getTokenAccountAddress - Get token account address

Gets the associated token account address for a given wallet and token mint.

Returns: `Promise<Address>`

```typescript
const tokenAccountAddress = await connection.getTokenAccountAddress(wallet, mint, useTokenExtensions);
```

### Options

- `wallet`: `Address` - The wallet address to get the token account for
- `mint`: `Address` - The token mint address
- `useTokenExtensions`: `boolean` (optional) - Whether to use Token Extensions program (default: false)

### Example

Get a token account address for a token made with the classic token program:

```typescript
const tokenAccountAddress = await connection.getTokenAccountAddress(
  "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
```

Get a token account address for a Token Extensions token:

```typescript
const tokenAccountAddress = await connection.getTokenAccountAddress(
  "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  true,
);
```

## mintTokens - Mint tokens to an account

Mints tokens from a token mint to a destination account. The mint authority must sign the transaction.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.mintTokens(
  mintAddress, // address of the token mint
  mintAuthority, // signer with authority to mint tokens
  amount, // amount of tokens to mint
  destination, // address to receive the tokens
);
```

### Options

- `mintAddress`: `Address` - Address of the token mint
- `mintAuthority`: `KeyPairSigner` - Signer with authority to mint tokens
- `amount`: `bigint` - Amount of tokens to mint (in base units)
- `destination`: `Address` - Address to receive the minted tokens

### Example

```typescript
// Create a new token mint
const mintAuthority = await connection.createWallet({
  airdropAmount: lamports(1n * SOL),
});

const mintAddress = await connection.createTokenMint(
  mintAuthority,
  9, // decimals
  "My Token",
  "TKN",
  "https://example.com/token.json",
);

// Mint 100 tokens to the mint authority's account
const signature = await connection.mintTokens(mintAddress, mintAuthority, 100n, mintAuthority.address);
```

## transferTokens - Transfer tokens between accounts

Transfers tokens from one account to another. The sender must sign the transaction.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.transferTokens({
  sender,
  destination,
  mintAddress,
  amount,
  maximumClientSideRetries,
  abortSignal,
});
```

### Options

- `sender`: `KeyPairSigner` - Signer that owns the tokens and will sign the transaction
- `destination`: `Address` - Address to receive the tokens
- `mintAddress`: `Address` - Address of the token mint
- `amount`: `bigint` - Amount of tokens to transfer (in base units)
- `maximumClientSideRetries`: `number` (optional) - Maximum number of times to retry sending the transaction (default: 0)
- `abortSignal`: `AbortSignal | null` (optional) - Signal to abort the transaction (default: null)

### Example

```typescript
// Create wallets for sender and recipient
const [sender, recipient] = await Promise.all([
  connection.createWallet({
    airdropAmount: lamports(1n * SOL),
  }),
  connection.createWallet({
    airdropAmount: lamports(1n * SOL),
  }),
]);

// Create a new token mint
const mintAddress = await connection.createTokenMint(
  sender, // sender will be the mint authority
  9, // decimals
  "My Token",
  "TKN",
  "https://example.com/token.json",
);

// Mint some tokens to the sender's account
await connection.mintTokens(mintAddress, sender, 100n, sender.address);

// Transfer 50 tokens from sender to recipient with retries
const signature = await connection.transferTokens({
  sender,
  destination: recipient.address,
  mintAddress,
  amount: 50n,
  maximumClientSideRetries: 3,
});
```

## sendTransactionFromInstructions - Send a transaction with multiple instructions

> Like `sendTransactionWithSigners` from `@solana/helpers`

Sends a transaction containing one or more instructions. The transaction will be signed by the fee payer.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.sendTransactionFromInstructions({
  feePayer,
  instructions,
  commitment,
  skipPreflight,
  maximumClientSideRetries,
  abortSignal,
});
```

### Options

- `feePayer`: `KeyPairSigner` - The account that will pay for the transaction
- `instructions`: `Array<IInstruction>` - Array of instructions to include in the transaction
- `commitment`: `"confirmed" | "finalized"` (optional) - Desired confirmation level (default: "confirmed")
- `skipPreflight`: `boolean` (optional) - Whether to skip preflight transaction checks (default: true)
- `maximumClientSideRetries`: `number` (optional) - Maximum number of times to retry sending the transaction (default: 0)
- `abortSignal`: `AbortSignal | null` (optional) - Signal to abort the transaction (default: null)

### Example

Here's an example of sending a transaction with a SOL transfer instruction:

```typescript
const feePayer = await connection.createWallet({
  airdropAmount: lamports(1n * SOL)
});

const recipient = await generateKeyPairSigner();

// Create an instruction to transfer SOL
const transferInstruction = getTransferSolInstruction({
  amount: lamports(0.1n * SOL),
  destination: recipient.address,
  source: feePayer
});

// Send the transaction with the transfer instruction
const signature = await connection.sendTransactionFromInstructions({
  feePayer,
  instructions: [transferInstruction],
  maximumClientSideRetries: 3 // retry up to 3 times if the transaction fails
});
```

You can also send multiple instructions in a single transaction:

```typescript
// Create instructions to transfer SOL to multiple recipients
const transferInstructions = recipients.map(recipient =>
  getTransferSolInstruction({
    amount: lamports(0.1n * SOL),
    destination: recipient.address,
    source: feePayer
  })
);

// Send all transfers in one transaction
const signature = await connection.sendTransactionFromInstructions({
  feePayer,
  instructions: transferInstructions,
  commitment: "confirmed",
  skipPreflight: true
});
```

The function will automatically:

- Get a recent blockhash
- Set the fee payer
- Add compute budget instructions if needed
- Sign the transaction with the fee payer
- Send and confirm the transaction
- Retry the transaction if requested and needed

## getMint - Get token mint information

Gets information about a token mint, including its decimals, authority, and supply.

Returns: `Promise<Mint | null>`

```typescript
const mint = await connection.getMint(mintAddress, commitment);
```

### Options

- `mintAddress`: `Address` - Address of the token mint to get information for
- `commitment`: `Commitment` (optional) - Desired confirmation level (default: "confirmed")

### Example

```typescript
// Get information about the USDC mint
const usdcMint = await connection.getMint("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

if (usdcMint) {
  console.log(`Decimals: ${usdcMint.data.decimals}`);
  console.log(`Mint authority: ${usdcMint.data.mintAuthority}`);
  console.log(`Supply: ${usdcMint.data.supply}`);
}
```

The mint information includes:

- `decimals`: Number of decimal places for the token
- `mintAuthority`: Public key of the account allowed to mint new tokens
- `supply`: Current total supply of the token
- Other metadata if the token uses Token Extensions

## createWallets - Create multiple wallets

> Like `makeWallets` from `@solana/helpers`

Creates multiple Solana wallets with the same options. Returns an array of wallet promises that can be awaited in parallel.

Returns: `Array<Promise<KeyPairSigner>>`

```typescript
const wallets = await connection.createWallets(amount, options);
```

### Options (same as `createWallet`)

- `amount`: `number` - Number of wallets to create
- `options`: Same options as `createWallet`:
  - `prefix`: `string | null` - Prefix for wallet addresses
  - `suffix`: `string | null` - Suffix for wallet addresses
  - `envFileName`: `string | null` - Path to .env file to save keypairs
  - `envVariableName`: `string` - Name of environment variable to store keypairs
  - `airdropAmount`: `Lamports | null` - Amount of SOL to airdrop to each wallet

### Example

Create 3 wallets with airdrops:

```typescript
const [wallet1, wallet2, wallet3] = await connection.createWallets(3, {
  airdropAmount: lamports(1n * SOL),
});
```

If you need to create multiple wallets with different options, you can do this with:

```typescript
const [sender, recipient] = await Promise.all([
  connection.createWallet({
    airdropAmount: lamports(1n * SOL),
  }),
  connection.createWallet({
    airdropAmount: lamports(1n * SOL),
  }),
]);
```

## getTokenAccountBalance - Get token account balance

Gets the balance of tokens in a token account for a given wallet and mint.

Returns: `Promise<TokenAmount>`

```typescript
const balance = await connection.getTokenAccountBalance(wallet, mint, useTokenExtensions);
```

### Options

- `wallet`: `Address` - The wallet address to check the token balance for
- `mint`: `Address` - The token mint address
- `useTokenExtensions`: `boolean` (optional) - Whether to use Token Extensions program (default: false)

### Example

Get a token balance for a classic SPL token:

```typescript
// Get USDC balance
const balance = await connection.getTokenAccountBalance(
  "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn", // wallet
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC mint
);

console.log(`Balance: ${balance.uiAmount} ${balance.symbol}`);
```

Get a token balance for a Token Extensions token:

```typescript
const balance = await connection.getTokenAccountBalance(
  "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  true, // use Token Extensions program
);
```

The balance includes:

- `amount`: Raw token amount (in base units)
- `decimals`: Number of decimal places for the token
- `uiAmount`: Formatted amount with decimals
- `uiAmountString`: String representation of the UI amount

## checkTokenAccountIsClosed - Check if token account is closed

Checks if a token account is closed or doesn't exist. A token account can be specified directly or derived from a wallet and mint address.

Returns: `Promise<boolean>`

```typescript
const isClosed = await connection.checkTokenAccountIsClosed(params);
```

### Options

- `params`: `Object` - Parameters for checking token account
  - `tokenAccount`: `Address` (optional) - Direct token account address to check
  - `wallet`: `Address` (optional) - Wallet address (required if tokenAccount not provided)
  - `mint`: `Address` (optional) - Token mint address (required if tokenAccount not provided)
  - `useTokenExtensions`: `boolean` (optional) - Use Token-2022 program instead of Token program (default: false)

### Example

Check if a token account is closed using direct token account address:

```typescript
const tokenAccount = "4MD31b2GFAWVDYQT8KG7E5GcZiFyy4MpDUt4BcyEdJRP";
const isClosed = await connection.checkTokenAccountIsClosed({
  tokenAccount,
});
console.log(`Token account is ${isClosed ? "closed" : "open"}`);
```

Check if a token account is closed using wallet and mint:

```typescript
const isClosed = await connection.checkTokenAccountIsClosed({
  wallet: "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn",
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  useTokenExtensions: true,
});
console.log(`Token account is ${isClosed ? "closed" : "open"}`);
```

## getPDAAndBump - Get a Program Derived Address and bump seed

Gets a Program Derived Address (PDA) and its bump seed from a program address and seeds. Automatically handles encoding of different seed types.

Returns: `Promise<{pda: Address, bump: number}>`

```typescript
const { pda, bump } = await connection.getPDAAndBump(programAddress, seeds);
```

### Options

- `programAddress`: `Address` - The program address to derive the PDA from
- `seeds`: `Array<String | Address | BigInt>` - Array of seeds to derive the PDA. Can include:
  - Strings (encoded as UTF-8)
  - Addresses (encoded as base58)
  - BigInts (encoded as 8-byte little-endian)

### Example

```typescript
const programAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
const seeds = [
  "offer", // string seed
  aliceAddress, // address seed
  420n, // bigint seed
];

const { pda, bump } = await connection.getPDAAndBump(programAddress, seeds);
console.log("PDA:", pda.toString());
console.log("Bump seed:", bump);
```

## Development and testing

Since this is a library, all functions in the codebase must include TSDoc comments that describe their purpose, parameters, and return types. I appreciate TSDoc can be annoying and reptitive, but we use TSdoc because VSCode and other IDEs show these comments when the function is hovered. See existing functions for examples of the required documentation format.

> Make the TSDoc comments actually useful. Eg, don't tell people that `mintAuthority` is 'the mint authority'. Tell them that `mintAuthority` is 'the account that is allowed to use the token mint'.

To run tests, open a terminal tab, and run:

```bash
solana-test-validator
```

Then in a different tab, run:

```bash
npm run test
```

The tests use the [node native test runner](https://blog.logrocket.com/exploring-node-js-native-test-runner/).

If you'd like to run a single test, use:

```bash
npx tsx --test --no-warnings src/tests/keypair.test.ts
```

We use `--no-warnings` to avoid `ExperimentalWarning: The Ed25519 Web Crypto API algorithm is an experimental feature` which is pretty boring once you've read it for the 50th time.

To just run tests matching the name `connect`:

```bash
npx tsx --test --no-warnings --test-name-pattern="connect"
```
