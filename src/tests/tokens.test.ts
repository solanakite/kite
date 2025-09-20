import { before, describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "..";
import { KeyPairSigner, lamports, Address, address as toAddress } from "@solana/kit";
import { SOL } from "../lib/constants";
import { Connection } from "../lib/connect";

describe("tokens", () => {
  let connection: Connection;
  let sender: KeyPairSigner;
  let mintAddress: Address;
  let recipient: KeyPairSigner;
  const decimals = 9;
  before(async () => {
    connection = connect();
    [sender, recipient] = await connection.createWallets(2, {
      airdropAmount: lamports(1n * SOL),
      commitment: "processed",
    });
  });

  test("We can make a new token mint with one additional metadata field", async () => {
    mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      name: "Unit test token",
      symbol: "TEST",
      uri: "https://example.com",
      additionalMetadata: {
        keyOne: "valueOne",
      },
    });
    assert.ok(mintAddress);
  });

  test("We can make a new token mint with two additional metadata fields", async () => {
    mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      name: "Unit test token",
      symbol: "TEST",
      uri: "https://example.com",
      additionalMetadata: {
        keyOne: "valueOne",
        keyTwo: "valueTwo",
      },
    });
    assert.ok(mintAddress);
  });

  test("We can make a new token mint without additional metadata", async () => {
    mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      name: "Unit test token",
      symbol: "TEST",
      uri: "https://example.com",
    });
    assert.ok(mintAddress);
  });

  test("The mint authority can mintTokens", async () => {
    // Have the mint authority mint to their own account
    const mintTokensTransactionSignature = await connection.mintTokens(mintAddress, sender, 1n, sender.address);
    assert.ok(mintTokensTransactionSignature);
  });

  test("We can get the mint", async () => {
    const mint = await connection.getMint(mintAddress);
    assert.ok(mint);
  });

  test("transferTokens transfers tokens from one account to another", async () => {
    // Transfer 1 token from the mint authority to the recipient
    const transferTokensTransactionSignature = await connection.transferTokens({
      sender,
      destination: recipient.address,
      mintAddress,
      amount: 1n,
    });

    assert.ok(transferTokensTransactionSignature);
  });

  test("getTokenAccountBalance returns the correct balance using wallet and mint", async () => {
    const balance = await connection.getTokenAccountBalance({
      wallet: recipient.address,
      mint: mintAddress,
      useTokenExtensions: true,
    });
    assert(balance.amount);
    assert(balance.decimals);
    assert(balance.uiAmount);
    assert(balance.uiAmountString);
  });

  test("getTokenAccountBalance returns the correct balance using direct token account", async () => {
    const tokenAccount = await connection.getTokenAccountAddress(recipient.address, mintAddress, true);
    const balance = await connection.getTokenAccountBalance({
      tokenAccount,
    });
    assert(balance.amount);
    assert(balance.decimals);
    assert(balance.uiAmount);
    assert(balance.uiAmountString);
  });

  test("getTokenAccountBalance throws error when neither tokenAccount nor wallet+mint provided", async () => {
    await assert.rejects(() => connection.getTokenAccountBalance({}), {
      message: "wallet and mint are required when tokenAccount is not provided",
    });
  });

  test("checkTokenAccountIsClosed returns false for an open token account", async () => {
    const tokenAccount = await connection.getTokenAccountAddress(recipient.address, mintAddress, true);
    const isClosed = await connection.checkTokenAccountIsClosed({
      tokenAccount,
    });
    assert.equal(isClosed, false);
  });

  test("checkTokenAccountIsClosed returns false when using wallet and mint for an open account", async () => {
    const isClosed = await connection.checkTokenAccountIsClosed({
      wallet: recipient.address,
      mint: mintAddress,
      useTokenExtensions: true,
    });
    assert.equal(isClosed, false);
  });

  test("checkTokenAccountIsClosed returns true for a non-existent token account", async () => {
    // Generate a random address that won't have a token account
    const nonExistentWallet = await connection.createWallet();
    const isClosed = await connection.checkTokenAccountIsClosed({
      wallet: nonExistentWallet.address,
      mint: mintAddress,
      useTokenExtensions: true,
    });
    assert.equal(isClosed, true);
  });

  test("checkTokenAccountIsClosed throws error when neither tokenAccount nor wallet+mint provided", async () => {
    await assert.rejects(() => connection.checkTokenAccountIsClosed({}), {
      message: "wallet and mint are required when tokenAccount is not provided",
    });
  });
});

describe("createTokenMint", () => {
  test("createTokenMint makes a new mint with the specified metadata", async () => {
    const connection = connect();

    const mintAuthority = await connection.createWallet({
      airdropAmount: lamports(1n * SOL),
    });

    const name = "Unit test token";
    const symbol = "TEST";
    const decimals = 9;
    const uri = "https://example.com";
    const additionalMetadata = {
      keyOne: "valueOne",
      keyTwo: "valueTwo",
    };
    const mintAddress = await connection.createTokenMint({
      mintAuthority,
      decimals,
      name,
      symbol,
      uri,
      additionalMetadata,
    });

    assert.ok(mintAddress);
  });
});

describe("getTokenAccountAddress", () => {
  const connection = connect();
  const USDC_MINT = toAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const MIKEMACCANA_DOT_SOL_USDC_ACCOUNT = toAddress("4MD31b2GFAWVDYQT8KG7E5GcZiFyy4MpDUt4BcyEdJRP");
  const MIKEMACCANA_DOT_SOL = toAddress("dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");
  const MIKEMACCANA_DOT_SOL_PYUSD_ACCOUNT = toAddress("ENGDgkjc6Pr8ceS2z4KiKnZU68LoLhHGbQoW6tRARsNk");
  const PYUSD_MINT = toAddress("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");

  test("getTokenAccountAddress returns the correct token account address for a classic Token program token", async () => {
    const usdcTokenAccountAddress = await connection.getTokenAccountAddress(MIKEMACCANA_DOT_SOL, USDC_MINT);
    assert.equal(usdcTokenAccountAddress, MIKEMACCANA_DOT_SOL_USDC_ACCOUNT);
  });

  test("getTokenAccountAddress returns the correct token account address for a Token Extensions token", async () => {
    const pyusdTokenAccountAddress = await connection.getTokenAccountAddress(MIKEMACCANA_DOT_SOL, PYUSD_MINT, true);
    assert.equal(pyusdTokenAccountAddress, MIKEMACCANA_DOT_SOL_PYUSD_ACCOUNT);
  });
});

describe("getTokenMetadata", () => {
  test("getTokenMetadata retrieves metadata for a token with metadata pointer extension", async () => {
    const connection = connect();
    const [sender] = await connection.createWallets(1, {
      airdropAmount: lamports(1n * SOL),
    });

    // Create a token with metadata
    const mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals: 9,
      name: "Unit test token",
      symbol: "TEST",
      uri: "https://example.com",
      additionalMetadata: {
        keyOne: "valueOne",
        keyTwo: "valueTwo",
      },
    });

    // Now test getting the metadata
    const metadata = await connection.getTokenMetadata(mintAddress);

    assert.ok(metadata);
    assert.ok(metadata.name);
    assert.ok(metadata.symbol);
    assert.ok(metadata.uri);
    assert.ok(metadata.updateAuthority);
    assert.ok(metadata.mint);
    assert.ok(metadata.additionalMetadata);

    // Verify the metadata contains expected information
    assert.equal(metadata.symbol, "TEST");
    assert.equal(metadata.name, "Unit test token");
    assert.equal(metadata.uri, "https://example.com");
  });
});
