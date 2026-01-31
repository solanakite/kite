import { describe, test, before } from "node:test";
import assert from "node:assert";
import { connect } from "..";
import { Connection } from "../lib/connect";
import { KeyPairSigner, lamports, TransactionSendingSigner } from "@solana/kit";
import { SOL } from "../lib/constants";

describe("rpc", () => {
  let connection: Connection;
  let wallet: KeyPairSigner & TransactionSendingSigner;

  before(async () => {
    connection = connect();
    wallet = await connection.createWallet({
      airdropAmount: lamports(1n * SOL),
      commitment: "processed",
    });
  });

  test("getLatestBlockhash returns a valid blockhash", async () => {
    const result = await connection.getLatestBlockhash();
    assert.ok(result.value);
    assert.ok(result.value.blockhash);
    assert.ok(result.value.lastValidBlockHeight);
    assert.ok(result.context);
  });

  test("checkHealth returns cluster health", async () => {
    const isHealthy = await connection.checkHealth();
    assert.ok(typeof isHealthy === "boolean");
  });

  test("getCurrentSlot returns a valid slot number", async () => {
    const slot = await connection.getCurrentSlot();
    assert.ok(typeof slot === "bigint");
    assert.ok(slot >= 0n);
  });

  test("getMinimumBalance calculates rent for given data size", async () => {
    const dataSize = 100n;
    const rent = await connection.getMinimumBalance(dataSize);
    assert.ok(typeof rent === "bigint");
    assert.ok(rent > 0n);
  });

  test("getMinimumBalance calculates higher rent for larger data sizes", async () => {
    const smallSize = 100n;
    const largeSize = 1000n;
    const smallRent = await connection.getMinimumBalance(smallSize);
    const largeRent = await connection.getMinimumBalance(largeSize);
    assert.ok(largeRent > smallRent);
  });

  test("getTransaction returns transaction details for valid signature", async () => {
    const transferSignature = await connection.transferLamports({
      source: wallet,
      destination: wallet.address,
      amount: lamports(1000n),
      commitment: "finalized",
    });

    const transaction = await connection.getTransaction(transferSignature);
    assert.ok(transaction);
  });

  test("getTransaction returns null for invalid signature", async () => {
    const fakeSignature = "1111111111111111111111111111111111111111111111111111111111111111";
    const transaction = await connection.getTransaction(fakeSignature);
    assert.equal(transaction, null);
  });
});
