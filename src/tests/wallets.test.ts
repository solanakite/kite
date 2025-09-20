import { before, describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "..";
import { generateKeyPairSigner, lamports } from "@solana/kit";
import { DEFAULT_AIRDROP_AMOUNT, SOL } from "../lib/constants";
import { unlink as deleteFile } from "node:fs/promises";
import dotenv from "dotenv";

describe("createWallet", () => {
  const connection = connect();
  const keyPairVariableName = "INITIALIZE_KEYPAIR_TEST";

  test("createWallet generates a new keyPair with a SOL balance", async () => {
    const envFileName = "../.env-unittest-create-wallet";

    const walletBefore = await connection.createWallet({
      envFileName,
      envVariableName: keyPairVariableName,
      airdropAmount: DEFAULT_AIRDROP_AMOUNT,
    });

    // Check balance
    const balanceBefore = await connection.getLamportBalance(walletBefore.address);
    assert.equal(balanceBefore, DEFAULT_AIRDROP_AMOUNT);

    // Check that the environment variable was created
    dotenv.config({ path: envFileName });
    const privateKeyString = process.env[keyPairVariableName];
    if (!privateKeyString) {
      throw new Error(`${privateKeyString} not found in environment`);
    }

    // Now reload the environment and check it matches our test keyPair
    const walletAfter = await connection.loadWalletFromEnvironment(keyPairVariableName);

    // Check the keyPair is the same
    assert(walletBefore.address === walletAfter.address);

    // Check balance has not changed
    const balanceAfter = await connection.getLamportBalance(walletAfter.address);

    assert.equal(balanceBefore, balanceAfter);

    // Check there is a private key
    assert.ok(walletAfter.keyPair.privateKey);

    await deleteFile(envFileName);
  });

  test("createWallet generates a new keyPair with a SOL balance with a commitment", async () => {

    const walletBefore = await connection.createWallet({
      airdropAmount: DEFAULT_AIRDROP_AMOUNT,
      commitment: "processed",
    });

    // Check balance
    const balance = await connection.getLamportBalance(walletBefore.address, "processed");
    assert.equal(balance, DEFAULT_AIRDROP_AMOUNT);
  });

  describe("with prefix and suffix", () => {
    test("creates a wallet with a prefix", async () => {
      const prefix = "BE";
      const wallet = await connection.createWallet({ prefix });

      assert.match(wallet.address, new RegExp(`^${prefix}`));
      assert.ok(wallet.keyPair.privateKey);
      assert.ok(wallet.address);
    });

    test("creates a wallet with a suffix", async () => {
      const suffix = "EN";
      const wallet = await connection.createWallet({ suffix });

      assert.match(wallet.address, new RegExp(`${suffix}$`));
      assert.ok(wallet.keyPair.privateKey);
      assert.ok(wallet.address);
    });

    test("creates a wallet with both prefix and suffix", async () => {
      const prefix = "B";
      const suffix = "E";
      const wallet = await connection.createWallet({ prefix, suffix });

      assert.match(wallet.address, new RegExp(`^${prefix}`));
      assert.match(wallet.address, new RegExp(`${suffix}$`));
      assert.ok(wallet.keyPair.privateKey);
    });

    test("throws error for invalid prefix characters", async () => {
      const prefix = "TEST!";

      await assert.rejects(async () => await connection.createWallet({ prefix }), {
        message: "Prefix must contain only base58 characters.",
      });
    });

    test("throws error for invalid suffix characters", async () => {
      const suffix = "@END";

      await assert.rejects(async () => await connection.createWallet({ suffix }), {
        message: "Suffix must contain only base58 characters.",
      });
    });
  });
});

describe("airdropIfRequired", () => {
  test("Checking the balance after airdropIfRequired", async () => {
    const connection = connect();
    const user = await generateKeyPairSigner();

    const originalBalance = await connection.getLamportBalance(user.address, "finalized");

    assert.equal(originalBalance, 0);
    const lamportsToAirdrop = lamports(1n * SOL);

    const minimumBalance = lamports(1n * SOL);

    const signature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, minimumBalance);
    assert.ok(signature, "Expected airdrop signature when balance is 0");

    const newBalance = await connection.getLamportBalance(user.address, "finalized");

    assert.equal(newBalance, lamportsToAirdrop);

    const recipient = await generateKeyPairSigner();

    // Spend our SOL now to ensure we can use the airdrop immediately
    const transferSignature = await connection.transferLamports({
      source: user,
      destination: recipient.address,
      amount: lamports(1_000_000n),
    });

    assert.ok(transferSignature);
  });
  test("Checking the balance after airdropIfRequired with a commitment", async () => {
    const connection = connect();
    const user = await generateKeyPairSigner();

    const originalBalance = await connection.getLamportBalance(user.address, "processed");

    assert.equal(originalBalance, 0);
    const lamportsToAirdrop = lamports(1n * SOL);

    const minimumBalance = lamports(1n * SOL);

    const signature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, minimumBalance, "processed");
    assert.ok(signature, "Expected airdrop signature when balance is 0");

    const newBalance = await connection.getLamportBalance(user.address, "processed");

    assert.equal(newBalance, lamportsToAirdrop);
  });

  test("airdropIfRequired doesn't request unnecessary airdrops", async () => {
    const user = await generateKeyPairSigner();
    const connection = connect();
    const balance = await connection.getLamportBalance(user.address);
    assert.equal(balance, 0n);
    const lamportsToAirdrop = lamports(1n * SOL);

    // First airdrop asks for 500_000 lamports
    const firstSignature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, lamports(500_000n));
    assert.ok(firstSignature, "Expected signature from first airdrop");

    // Try a second airdrop if the balance is less than 1 SOL
    // Check second airdrop didn't happen (since we already had 1 SOL from first airdrop)
    const minimumBalance = lamports(1n * SOL);
    const secondSignature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, minimumBalance);
    assert.equal(secondSignature, null, "Expected no signature when balance is sufficient");

    const finalBalance = await connection.getLamportBalance(user.address);
    assert.equal(finalBalance, lamportsToAirdrop);
  });

  test("airdropIfRequired does airdrop when necessary", async () => {
    const user = await generateKeyPairSigner();

    const connection = connect();
    const originalBalance = await connection.getLamportBalance(user.address, "finalized");
    assert.equal(originalBalance, 0);
    // Get 999_999_999 lamports if we have less than 500_000 lamports
    const lamportsToAirdrop = lamports(1n * SOL - 1n);
    const firstSignature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, lamports(500_000n));
    assert.ok(firstSignature, "Expected signature from first airdrop");

    const balanceAfterFirstAirdrop = await connection.getLamportBalance(user.address);
    assert.equal(balanceAfterFirstAirdrop, lamportsToAirdrop);

    // We only have 999_999_999 lamports, so we should need another airdrop
    // Check second airdrop happened
    const secondSignature = await connection.airdropIfRequired(user.address, lamports(1n * SOL), lamports(1n * SOL));
    assert.ok(secondSignature, "Expected signature from second airdrop");

    const finalBalance = await connection.getLamportBalance(user.address);
    assert.equal(finalBalance, lamports(2n * SOL - 1n));
  });
});

describe("createWallets", () => {
  test("creates multiple wallets with the same options", async () => {
    const connection = connect();
    const numberOfWallets = 3;
    const airdropAmount = lamports(1n * SOL);

    const walletPromises = await connection.createWallets(numberOfWallets, {
      airdropAmount,
    });

    assert.equal(walletPromises.length, numberOfWallets, "Should return correct number of wallet promises");

    const wallets = await Promise.all(walletPromises);

    // Check each wallet was created correctly
    for (const wallet of wallets) {
      assert.ok(wallet.address, "Wallet should have an address");
      assert.ok(wallet.keyPair.privateKey, "Wallet should have a private key");

      // Check balance
      const balance = await connection.getLamportBalance(wallet.address);
      assert.equal(balance, airdropAmount, "Wallet should have correct airdrop amount");
    }

    // Verify all addresses are unique
    const addresses = wallets.map((wallet) => wallet.address);
    const uniqueAddresses = new Set(addresses);
    assert.equal(uniqueAddresses.size, numberOfWallets, "All wallet addresses should be unique");
  });

  test("creates multiple wallets with just a number parameter", async () => {
    const connection = connect();
    const numberOfWallets = 3;

    const walletPromises = await connection.createWallets(numberOfWallets);

    assert.equal(walletPromises.length, numberOfWallets, "Should return correct number of wallet promises");

    const wallets = await Promise.all(walletPromises);

    // Check each wallet was created correctly
    for (const wallet of wallets) {
      assert.ok(wallet.address, "Wallet should have an address");
      assert.ok(wallet.keyPair.privateKey, "Wallet should have a private key");
    }

    // Verify all addresses are unique
    const addresses = wallets.map((wallet) => wallet.address);
    const uniqueAddresses = new Set(addresses);
    assert.equal(uniqueAddresses.size, numberOfWallets, "All wallet addresses should be unique");
  });
});
