import { before, describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "..";
import { lamports, Address, address as toAddress, TransactionSigner } from "@solana/kit";
import { SOL, TOKEN_PROGRAM } from "../lib/constants";
import { Connection } from "../lib/connect";
import { fetchMint } from "@solana-program/token";

describe("tokens", () => {
  let connection: Connection;
  let sender: TransactionSigner;
  let mintAddress: Address;
  let recipient: TransactionSigner;
  const decimals = 9;
  before(async () => {
    connection = connect();
    [sender, recipient] = await connection.createWallets(2, {
      airdropAmount: lamports(1n * SOL),
      commitment: "processed",
    });

    // Create a basic mint without metadata for tests that need a mint
    // Token-2022 metadata tests are skipped due to test validator issue
    mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      useTokenExtensions: false,
    });
  });

  // TODO: https://github.com/anza-xyz/agave/issues/9799
  test.skip("We can make a new token mint with one additional metadata field", async () => {
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

  // TODO: https://github.com/anza-xyz/agave/issues/9799
  test.skip("We can make a new token mint with two additional metadata fields", async () => {
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

  // TODO: https://github.com/anza-xyz/agave/issues/9799
  test.skip("We can make a new token mint without additional metadata", async () => {
    mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      name: "Unit test token",
      symbol: "TEST",
      uri: "https://example.com",
    });
    assert.ok(mintAddress);
  });

  test("We cannot use Token Extensions without providing a name", async () => {
    await assert.rejects(
      () =>
        connection.createTokenMint({
          mintAuthority: sender,
          decimals,
          symbol: "TEST",
          uri: "https://example.com",
          useTokenExtensions: true,
        }),
      { message: "name, symbol, and uri are required when useTokenExtensions is true" },
    );
  });

  test("We cannot use Token Extensions without providing a symbol", async () => {
    await assert.rejects(
      () =>
        connection.createTokenMint({
          mintAuthority: sender,
          decimals,
          name: "Unit test token",
          uri: "https://example.com",
          useTokenExtensions: true,
        }),
      { message: "name, symbol, and uri are required when useTokenExtensions is true" },
    );
  });

  test("We cannot use Token Extensions without providing a uri", async () => {
    await assert.rejects(
      () =>
        connection.createTokenMint({
          mintAuthority: sender,
          decimals,
          name: "Unit test token",
          symbol: "TEST",
          useTokenExtensions: true,
        }),
      { message: "name, symbol, and uri are required when useTokenExtensions is true" },
    );
  });

  test("The mint authority can mintTokens", async () => {
    // update the token to use token 2022 for compatibility with remaining tests
    mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      name: "Unit test token",
      symbol: "TEST",
      uri: "https://example.com",
    });
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

  test("burnTokens burns tokens from an account", async () => {
    const burnTestMint = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      name: "Burn test token",
      symbol: "BURN",
      uri: "https://example.com",
    });

    await connection.mintTokens(burnTestMint, sender, 1000n, sender.address);

    const balanceBefore = await connection.getTokenAccountBalance({
      wallet: sender.address,
      mint: burnTestMint,
      useTokenExtensions: true,
    });

    assert.equal(balanceBefore.amount, 1000n);

    const burnSignature = await connection.burnTokens({
      mintAddress: burnTestMint,
      owner: sender,
      amount: 500n,
      useTokenExtensions: true,
    });

    assert.ok(burnSignature);

    const balanceAfter = await connection.getTokenAccountBalance({
      wallet: sender.address,
      mint: burnTestMint,
      useTokenExtensions: true,
    });

    assert.equal(balanceAfter.amount, 500n);
  });

  test("burnTokens throws error when mint not found", async () => {
    const fakeMintAddress = toAddress("11111111111111111111111111111111");
    await assert.rejects(
      () =>
        connection.burnTokens({
          mintAddress: fakeMintAddress,
          owner: sender,
          amount: 1n,
        }),
      /Failed to decode account data/,
    );
  });

  test("closeTokenAccount closes an account with zero balance", async () => {
    const closeTestMint = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      name: "Close test token",
      symbol: "CLOSE",
      uri: "https://example.com",
    });

    await connection.mintTokens(closeTestMint, sender, 100n, recipient.address);

    await connection.burnTokens({
      mintAddress: closeTestMint,
      owner: recipient,
      amount: 100n,
      useTokenExtensions: true,
    });

    const balanceBeforeClose = await connection.getTokenAccountBalance({
      wallet: recipient.address,
      mint: closeTestMint,
      useTokenExtensions: true,
    });
    assert.equal(balanceBeforeClose.amount, 0n);

    const closeSignature = await connection.closeTokenAccount({
      owner: recipient,
      wallet: recipient.address,
      mint: closeTestMint,
      useTokenExtensions: true,
    });

    assert.ok(closeSignature);

    const isClosed = await connection.checkTokenAccountIsClosed({
      wallet: recipient.address,
      mint: closeTestMint,
      useTokenExtensions: true,
    });

    assert.equal(isClosed, true);
  });

  test("closeTokenAccount throws error when neither tokenAccount nor wallet+mint provided", async () => {
    await assert.rejects(
      () =>
        connection.closeTokenAccount({
          owner: sender,
        }),
      { message: "Either tokenAccount or both wallet and mint must be provided" },
    );
  });

  test("getTokenAccounts returns token accounts from both classic and token extensions programs", async () => {
    const tokenAccounts = await connection.getTokenAccounts(sender.address);

    assert.ok(Array.isArray(tokenAccounts));
    assert.ok(tokenAccounts.length >= 0);
  });

  test("getTokenAccounts returns accounts after minting tokens", async () => {
    const testMintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals: 9,
      name: "Get Accounts Test Token",
      symbol: "GATT",
      uri: "https://example.com/gatt",
    });

    await connection.mintTokens(testMintAddress, sender, 1000000000n, sender.address, true);

    const tokenAccounts = await connection.getTokenAccounts(sender.address);

    assert.ok(Array.isArray(tokenAccounts));
    assert.ok(tokenAccounts.length > 0);

    const hasTestToken = tokenAccounts.some((account) => {
      const parsedInfo = account.account.data.parsed?.info;
      return parsedInfo && parsedInfo.mint === testMintAddress;
    });

    assert.ok(hasTestToken, "Should find the test token in the accounts");
  });

  test("getTokenAccounts with excludeZeroBalance filters out empty accounts", async () => {
    const emptyMintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals: 9,
      name: "Empty Token",
      symbol: "EMPTY",
      uri: "https://example.com/empty",
    });

    await connection.mintTokens(emptyMintAddress, sender, 0n, sender.address, true);

    const fullMintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals: 9,
      name: "Full Token",
      symbol: "FULL",
      uri: "https://example.com/full",
    });

    await connection.mintTokens(fullMintAddress, sender, 1000000000n, sender.address, true);

    const allAccounts = await connection.getTokenAccounts(sender.address, false);
    const nonZeroAccounts = await connection.getTokenAccounts(sender.address, true);

    assert.ok(allAccounts.length > nonZeroAccounts.length, "All accounts should include more accounts than filtered");

    const hasEmptyInAll = allAccounts.some((account) => {
      const parsedInfo = account.account.data.parsed?.info;
      return parsedInfo && parsedInfo.mint === emptyMintAddress;
    });

    const hasEmptyInFiltered = nonZeroAccounts.some((account) => {
      const parsedInfo = account.account.data.parsed?.info;
      return parsedInfo && parsedInfo.mint === emptyMintAddress;
    });

    const hasFullInFiltered = nonZeroAccounts.some((account) => {
      const parsedInfo = account.account.data.parsed?.info;
      return parsedInfo && parsedInfo.mint === fullMintAddress;
    });

    assert.ok(hasEmptyInAll, "Empty account should be in all accounts");
    assert.ok(!hasEmptyInFiltered, "Empty account should not be in filtered accounts");
    assert.ok(hasFullInFiltered, "Full account should be in filtered accounts");
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

describe("classic token program", () => {
  let connection: Connection;
  let sender: TransactionSigner;
  let mintAddress: Address;
  let recipient: TransactionSigner;
  const decimals = 9;
  before(async () => {
    connection = connect();
    [sender, recipient] = await connection.createWallets(2, {
      airdropAmount: lamports(1n * SOL),
      commitment: "processed",
    });
  });
  test("We can make tokens using the classic token program", async () => {
    mintAddress = await connection.createTokenMint({
      mintAuthority: sender,
      decimals,
      useTokenExtensions: false,
    });
    assert.ok(mintAddress);
    const mint = await connection.rpc.getAccountInfo(mintAddress, { encoding: "base64" }).send();
    assert.ok(mint);
    assert.equal(mint.value?.owner, TOKEN_PROGRAM);
  });
  test("The mint authority can mintTokens using the classic token program", async () => {
    const mintTokensTransactionSignature = await connection.mintTokens(mintAddress, sender, 1n, sender.address, false);
    assert.ok(mintTokensTransactionSignature);
  });
  test("We can get the mint using (for a mint using the classic token program)", async () => {
    const mint = await connection.getMint(mintAddress);
    assert.ok(mint);
  });

  test("transferTokens transfers tokens from one account to another using the classic token program", async () => {
    const transferTokensTransactionSignature = await connection.transferTokens({
      sender,
      destination: recipient.address,
      mintAddress,
      amount: 1n,
      useTokenExtensions: false,
    });

    assert.ok(transferTokensTransactionSignature);
  });

  test("getTokenAccountBalance returns the correct balance using wallet and mint", async () => {
    const balance = await connection.getTokenAccountBalance({
      wallet: recipient.address,
      mint: mintAddress,
      useTokenExtensions: false,
    });
    assert(balance.amount);
    assert(balance.decimals);
    assert(balance.uiAmount);
    assert(balance.uiAmountString);
  });

  test("getTokenAccountBalance returns the correct balance using direct token account", async () => {
    const tokenAccount = await connection.getTokenAccountAddress(recipient.address, mintAddress, false);
    const balance = await connection.getTokenAccountBalance({
      tokenAccount,
      useTokenExtensions: false,
    });
    assert(balance.amount);
    assert(balance.decimals);
    assert(balance.uiAmount);
    assert(balance.uiAmountString);
  });

  test("checkTokenAccountIsClosed returns false for an open token account", async () => {
    const tokenAccount = await connection.getTokenAccountAddress(recipient.address, mintAddress, false);
    const isClosed = await connection.checkTokenAccountIsClosed({
      tokenAccount,
    });
    assert.equal(isClosed, false);
  });

  test("checkTokenAccountIsClosed returns false when using wallet and mint for an open account", async () => {
    const isClosed = await connection.checkTokenAccountIsClosed({
      wallet: recipient.address,
      mint: mintAddress,
      useTokenExtensions: false,
    });
    assert.equal(isClosed, false);
  });

  test("checkTokenAccountIsClosed returns true for a non-existent token account", async () => {
    const nonExistentWallet = await connection.createWallet();
    const isClosed = await connection.checkTokenAccountIsClosed({
      wallet: nonExistentWallet.address,
      mint: mintAddress,
      useTokenExtensions: false,
    });
    assert.equal(isClosed, true);
  });

  test("cannot get metadata for a mint using the classic token program", async () => {
    await assert.rejects(() => connection.getTokenMetadata(mintAddress));
  });
});

describe("watchTokenBalance", () => {
  test("watchTokenBalance calls callback with initial balance", async () => {
    const connection = connect();
    const wallet = await connection.createWallet();

    const tokenMint = await connection.createTokenMint({
      mintAuthority: wallet,
      decimals: 9,
      name: "Test Token",
      symbol: "TEST",
      uri: "https://example.com",
    });

    // Mint some tokens to the wallet
    await connection.mintTokens(tokenMint, wallet, 1000n, wallet.address);

    // Now call watchTokenBalance and check we get the correct balance
    await new Promise<void>((resolve) => {
      const cleanup = connection.watchTokenBalance(wallet.address, tokenMint, (error, balance) => {
        if (error) {
          cleanup();
          throw error;
        }

        // Should get the initial balance
        assert.equal(balance?.amount, 1000n);
        assert.equal(balance?.decimals, 9);
        cleanup();
        resolve();
      });
    });
  });

  test("watchTokenBalance calls callback when balance changes", async () => {
    const connection = connect();
    const [sender, recipient] = await connection.createWallets(2);
    const tokenMint = await connection.createTokenMint({
      mintAuthority: sender,
      decimals: 9,
      name: "Test Token",
      symbol: "TEST",
      uri: "https://example.com",
    });

    // Mint tokens to sender
    await connection.mintTokens(tokenMint, sender, 2000n, sender.address);

    let callCount = 0;
    let initialBalance: bigint | null = null;
    let updatedBalance: bigint | null = null;

    await new Promise<void>((resolve) => {
      const cleanup = connection.watchTokenBalance(recipient.address, tokenMint, (error, balance) => {
        if (error) {
          cleanup();
          throw error;
        }

        callCount++;

        if (callCount === 1) {
          // Initial balance should be 0
          initialBalance = balance?.amount || 0n;
          assert.equal(balance?.amount, 0n);

          // Now transfer some tokens to change the balance
          void connection.transferTokens({
            sender,
            destination: recipient.address,
            mintAddress: tokenMint,
            amount: 500n,
          });
        } else if (callCount === 2) {
          // Balance should have increased
          updatedBalance = balance?.amount || 0n;
          assert.equal(balance?.amount, 500n);
          cleanup();
          resolve();
        }
      });
    });

    assert.equal(callCount, 2);
    assert.equal(initialBalance, 0n);
    assert.equal(updatedBalance, 500n);
  });

  test("watchTokenBalance cleanup prevents further callbacks", async () => {
    const connection = connect();
    const wallet = await connection.createWallet();

    const tokenMint = await connection.createTokenMint({
      mintAuthority: wallet,
      decimals: 9,
      name: "Test Token",
      symbol: "TEST",
      uri: "https://example.com",
    });

    // Mint some tokens
    await connection.mintTokens(tokenMint, wallet, 1000n, wallet.address);

    let callCount = 0;

    await new Promise<void>((resolve) => {
      const cleanup = connection.watchTokenBalance(wallet.address, tokenMint, (error, balance) => {
        if (error) {
          cleanup();
          throw error;
        }

        callCount++;

        if (callCount === 1) {
          // Got initial balance, now cleanup immediately
          cleanup();
          // Wait a bit to ensure no more callbacks are called
          setTimeout(() => {
            assert.equal(callCount, 1); // Should still be 1
            resolve();
          }, 100);
        }
      });
    });
  });

  test("watchTokenBalance handles errors appropriately", async () => {
    const connection = connect();

    // Use an invalid mint address
    const invalidMint = "invalid" as Address;

    await new Promise<void>((resolve, reject) => {
      // Track if callback has been called to prevent race condition where
      // callback might be invoked multiple times (initial fetch + subscription)
      let called = false;
      const cleanup = connection.watchTokenBalance("11111111111111111111111111111112" as Address, invalidMint, (error, balance) => {
        if (called) return; // Ignore subsequent callbacks
        called = true;

        if (error) {
          // Should get an error for invalid mint
          assert(error instanceof Error);
          assert.equal(balance, null);
          cleanup();
          resolve();
        } else {
          // Should not get here
          cleanup();
          reject(new Error("Expected an error for invalid mint"));
        }
      });
    });
  });
});

// TODO: https://github.com/anza-xyz/agave/issues/9799
describe.skip("updateTokenMetadata", () => {
  let connection: Connection;
  let updateAuthority: TransactionSigner;
  let mintAddress: Address;

  before(async () => {
    connection = connect();
    updateAuthority = await connection.createWallet({
      airdropAmount: lamports(2n * SOL),
      commitment: "processed",
    });

    mintAddress = await connection.createTokenMint({
      mintAuthority: updateAuthority,
      decimals: 9,
      name: "Original Name",
      symbol: "ORIG",
      uri: "https://original.com",
      additionalMetadata: {
        originalKey: "originalValue",
      },
    });
  });

  test("updates token name", async () => {
    const signature = await connection.updateTokenMetadata({
      mintAddress,
      updateAuthority,
      name: "Updated Name",
    });

    assert.ok(signature);

    const metadata = await connection.getTokenMetadata(mintAddress);
    assert.strictEqual(metadata.name, "Updated Name");
  });

  test("updates token symbol", async () => {
    const signature = await connection.updateTokenMetadata({
      mintAddress,
      updateAuthority,
      symbol: "UPDT",
    });

    assert.ok(signature);

    const metadata = await connection.getTokenMetadata(mintAddress);
    assert.strictEqual(metadata.symbol, "UPDT");
  });

  test("updates token URI", async () => {
    const signature = await connection.updateTokenMetadata({
      mintAddress,
      updateAuthority,
      uri: "https://updated.com",
    });

    assert.ok(signature);

    const metadata = await connection.getTokenMetadata(mintAddress);
    assert.strictEqual(metadata.uri, "https://updated.com");
  });

  test("updates multiple fields at once", async () => {
    const signature = await connection.updateTokenMetadata({
      mintAddress,
      updateAuthority,
      name: "Multi Update Name",
      symbol: "MULTI",
      uri: "https://multi.com",
    });

    assert.ok(signature);

    const metadata = await connection.getTokenMetadata(mintAddress);
    assert.strictEqual(metadata.name, "Multi Update Name");
    assert.strictEqual(metadata.symbol, "MULTI");
    assert.strictEqual(metadata.uri, "https://multi.com");
  });

  test("updates additional metadata field", async () => {
    const signature = await connection.updateTokenMetadata({
      mintAddress,
      updateAuthority,
      additionalMetadata: {
        newKey: "newValue",
      },
    });

    assert.ok(signature);

    const metadata = await connection.getTokenMetadata(mintAddress);
    assert.ok(metadata.additionalMetadata);
    assert.strictEqual(metadata.additionalMetadata.newKey, "newValue");
  });

  test("throws error when no fields provided", async () => {
    await assert.rejects(
      async () => {
        await connection.updateTokenMetadata({
          mintAddress,
          updateAuthority,
        });
      },
      {
        message: /No metadata fields provided to update/,
      },
    );
  });

  test("throws error when mint not found", async () => {
    const nonExistentMint = toAddress("11111111111111111111111111111112");

    await assert.rejects(
      async () => {
        await connection.updateTokenMetadata({
          mintAddress: nonExistentMint,
          updateAuthority,
          name: "Test",
        });
      },
      {
        message: /Mint not found/,
      },
    );
  });

  test("throws error when mint has no metadata pointer extension", async () => {
    const classicMint = await connection.createTokenMint({
      mintAuthority: updateAuthority,
      decimals: 9,
      useTokenExtensions: false,
    });

    await assert.rejects(
      async () => {
        await connection.updateTokenMetadata({
          mintAddress: classicMint,
          updateAuthority,
          name: "Test",
        });
      },
      {
        message: /No metadata pointer extension found/,
      },
    );
  });
});
