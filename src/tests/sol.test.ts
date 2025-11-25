import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "..";
import { generateKeyPairSigner, lamports, Address } from "@solana/kit";
import { SOL } from "../lib/constants";
import { createServer } from "node:http";
import { airdropIfRequiredFactory } from "../lib/sol";
import {
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  createDefaultRpcTransport,
} from "@solana/kit";

describe("getLamportBalance", () => {
  test("getLamportBalance returns 0 for a new account", async () => {
    const keypairSigner = await generateKeyPairSigner();
    const connection = connect();
    const balance = await connection.getLamportBalance(keypairSigner.address, "finalized");
    assert.equal(balance, 0n);
  });

  test("getLamportBalance returns 1 SOL after 1 SOL is airdropped", async () => {
    const keypairSigner = await generateKeyPairSigner();
    const connection = connect();
    await connection.airdropIfRequired(keypairSigner.address, lamports(1n * SOL), lamports(1n * SOL));
    const balance = await connection.getLamportBalance(keypairSigner.address, "finalized");
    assert.equal(balance, lamports(1n * SOL));
  });
});

describe("transferLamports", () => {
  test("Transferring SOL / lamports between wallets", async () => {
    const connection = connect();
    const [sender, recipient] = await connection.createWallets(2, {
      airdropAmount: lamports(1n * SOL),
    });

    const transferSignature = await connection.transferLamports({
      source: sender,
      destination: recipient.address,
      amount: lamports(1_000_000n),
    });

    assert.ok(transferSignature);
  });
});

describe("airdropIfRequired error handling", () => {
  test("airdropIfRequired throws helpful error when HTTP server returns 429 Too Many Requests", async () => {
    const keypairSigner = await generateKeyPairSigner();
    const testAddress = keypairSigner.address;

    // Create a mock HTTP server that returns 429 error
    const server = createServer((req, res) => {
      // Return 429 Too Many Requests with the error message
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "HTTP error (429): Too Many Requests" } }));
    });

    // Start the server on a random port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        resolve();
      });
    });

    const serverAddress = server.address();
    if (!serverAddress || typeof serverAddress === "string") {
      throw new Error("Failed to get server address");
    }

    const httpUrl = `http://localhost:${serverAddress.port}`;
    const wsUrl = `ws://localhost:${serverAddress.port}`;

    try {
      // Create RPC connection to the mock server
      const transport = createDefaultRpcTransport({ url: httpUrl });
      const rpc = createSolanaRpcFromTransport(transport);
      const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

      // Create airdropIfRequired using the factory
      const airdropIfRequired = airdropIfRequiredFactory(rpc, rpcSubscriptions);

      // Test that the error is thrown with the expected message
      await assert.rejects(
        async () => {
          await airdropIfRequired(testAddress, lamports(1n * SOL), lamports(0n));
        },
        (error: Error) => {
          assert.equal(
            error.message,
            `You have requested too many airdrops for ${testAddress}. See https://solanakite.org/docs/sol/airdrop-if-required for help.`,
          );
          return true;
        },
      );
    } finally {
      // Clean up the server
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });
});

describe("watchLamportBalance", () => {
  test("watchLamportBalance calls callback with initial balance", async () => {
    const keypairSigner = await generateKeyPairSigner();
    const connection = connect();

    // Airdrop some SOL to have a non-zero balance
    await connection.airdropIfRequired(keypairSigner.address, lamports(1n * SOL), lamports(1n * SOL));

    await new Promise<void>((resolve) => {
      const unsubscribe = connection.watchLamportBalance(keypairSigner.address, (error, balance) => {
        if (error) {
          throw error;
        }

        // Should get the initial balance
        assert.equal(balance, lamports(1n * SOL));
        unsubscribe();
        resolve();
      });
    });
  });

  test("watchLamportBalance calls callback when balance changes", async () => {
    const connection = connect();
    const [sender, recipient] = await connection.createWallets(2, {
      airdropAmount: lamports(1n * SOL),
    });

    let callCount = 0;
    let initialBalance: bigint | null = null;
    let updatedBalance: bigint | null = null;

    await new Promise<void>((resolve) => {
      const unsubscribe = connection.watchLamportBalance(recipient.address, (error, balance) => {
        if (error) {
          throw error;
        }

        callCount++;

        if (callCount === 1) {
          // Initial balance should be 1 SOL
          initialBalance = balance;
          assert.equal(balance, lamports(1n * SOL));

          // Now transfer some SOL to change the balance
          connection.transferLamports({
            source: sender,
            destination: recipient.address,
            amount: lamports(500_000n),
          }).catch(() => { }); // Ignore transfer errors for this test
        } else if (callCount === 2) {
          // Balance should have increased
          updatedBalance = balance;
          assert.equal(balance, lamports(1n * SOL + 500_000n));
          unsubscribe();
          resolve();
        }
      });
    });

    assert.equal(callCount, 2);
    assert.equal(initialBalance, lamports(1n * SOL));
    assert.equal(updatedBalance, lamports(1n * SOL + 500_000n));
  });

  test("watchLamportBalance cleanup prevents further callbacks", async () => {
    const keypairSigner = await generateKeyPairSigner();
    const connection = connect();

    await connection.airdropIfRequired(keypairSigner.address, lamports(1n * SOL), lamports(1n * SOL));

    let callCount = 0;

    await new Promise<void>((resolve) => {
      const unsubscribe = connection.watchLamportBalance(keypairSigner.address, (error, balance) => {
        if (error) {
          throw error;
        }

        callCount++;

        if (callCount === 1) {
          // Got initial balance, now unsubscribe
          unsubscribe();

          // Wait a bit and check that no more callbacks are called
          setTimeout(() => {
            assert.equal(callCount, 1); // Should still be 1
            resolve();
          }, 100);
        }
      });
    });
  });

  test("watchLamportBalance handles errors appropriately", async () => {
    const connection = connect();

    // Use an invalid address to trigger an error
    const invalidAddress = "invalid" as Address;

    await new Promise<void>((resolve) => {
      const unsubscribe = connection.watchLamportBalance(invalidAddress, (error, balance) => {
        if (error) {
          // Should get an error for invalid address
          assert(error instanceof Error);
          assert.equal(balance, null);
          unsubscribe();
          resolve();
        } else {
          // Should not get here
          throw new Error("Expected an error for invalid address");
        }
      });
    });
  });
});
