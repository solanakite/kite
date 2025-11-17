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
          await airdropIfRequired(testAddress, lamports(1n * SOL), 0n);
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
