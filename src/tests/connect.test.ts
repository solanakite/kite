import { describe, test } from "node:test";
import assert from "node:assert";
import {
  generateKeyPairSigner,
  lamports,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  createDefaultRpcTransport,
} from "@solana/kit";

import { SOL } from "../lib/constants";
import { connect, getWebsocketUrlFromHTTPUrl } from "../lib/connect";

describe("connect", () => {
  test("connect returns a connection object", () => {
    const connection = connect();
    assert.ok(connection);
  });

  test("connect throws an error connecting to a cluster that requires an API key when the API key is not set", () => {
    assert.throws(() => connect("helius-mainnet"), Error);
  });

  test("connect returns a connection object with the correct URLs when two custom URLs are provided", () => {
    const connection = connect("https://mainnet.helius-rpc.com/", "wss://mainnet.helius-rpc.com/");
    assert.ok(connection);
  });

  test("connect returns a connection object when connecting to a cluster that requires an API key when the API key is set", () => {
    process.env.HELIUS_API_KEY = "fake-api-key";
    const connection = connect("helius-mainnet");
    assert.ok(connection);
  });

  test("connect returns a connection object with the correct URLs when a cluster name is provided", () => {
    const connection = connect("mainnet-beta");
  });

  test("connect throws an error when an invalid cluster name is provided", () => {
    assert.throws(() => connect("invalid-cluster-name"), Error);
  });

  test("connect throws an error when Quicknode cluster is used without environment variable", () => {
    assert.throws(() => connect("QuickNode-mainnet"), Error);
  });

  test("connect works with Quicknode when environment variable is set", () => {
    // Set up a test endpoint that will be used for both HTTP and WebSocket
    const testEndpoint = "https://example.quiknode.pro/123";
    process.env.QUICKNODE_SOLANA_MAINNET_ENDPOINT = testEndpoint;

    // Create the connection
    const connection = connect("quicknode-mainnet");

    // Verify the connection was created successfully
    assert.ok(connection);

    // Clean up
    delete process.env.QUICKNODE_SOLANA_MAINNET_ENDPOINT;
  });

  describe("with RPC and RPC subscriptions clients", () => {
    test("connect accepts RPC and RPC subscriptions clients directly", () => {
      const transport = createDefaultRpcTransport({
        url: "https://api.mainnet-beta.solana.com",
      });
      const rpc = createSolanaRpcFromTransport(transport);
      const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.mainnet-beta.solana.com");
      const connection = connect(rpc, rpcSubscriptions);
      assert.ok(connection);
      assert.equal(connection.rpc, rpc);
      assert.equal(connection.rpcSubscriptions, rpcSubscriptions);
    });

    test("connect throws error when RPC client is provided without RPC subscriptions client", () => {
      const transport = createDefaultRpcTransport({
        url: "https://api.mainnet-beta.solana.com",
      });
      const rpc = createSolanaRpcFromTransport(transport);
      assert.throws(() => connect(rpc), Error);
    });

    test("connect throws error when RPC client is provided with string as second argument", () => {
      const transport = createDefaultRpcTransport({
        url: "https://api.mainnet-beta.solana.com",
      });
      const rpc = createSolanaRpcFromTransport(transport);
      assert.throws(() => connect(rpc, "wss://api.mainnet-beta.solana.com"), Error);
    });

    test("connection with custom RPC clients can perform basic operations", async () => {
      const transport = createDefaultRpcTransport({
        url: "https://api.mainnet-beta.solana.com",
      });
      const rpc = createSolanaRpcFromTransport(transport);
      const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.mainnet-beta.solana.com");
      const connection = connect(rpc, rpcSubscriptions);

      // Test that we can get the latest blockhash
      const { value } = await connection.rpc.getLatestBlockhash().send();
      assert.ok(value.blockhash);
    });
  });
});

describe("getLogs", () => {
  test("getLogs works", async () => {
    const connection = connect();
    const keyPairSigner = await generateKeyPairSigner();

    const signature = await connection.airdropIfRequired(keyPairSigner.address, lamports(2n * SOL), lamports(1n * SOL));

    // Signature should never be null as we always need an airdrop
    assert.ok(signature);

    const logs = await connection.getLogs(signature);
    assert.deepEqual(logs, [
      "Program 11111111111111111111111111111111 invoke [1]",
      "Program 11111111111111111111111111111111 success",
    ]);
  });
});

describe("getWebsocketUrlFromHTTPUrl", () => {
  test("converts http to ws", () => {
    const wsUrl = getWebsocketUrlFromHTTPUrl("http://example.com:8899");
    assert.equal(wsUrl, "ws://example.com:8899/");
  });
  test("converts https to wss", () => {
    const wsUrl = getWebsocketUrlFromHTTPUrl("https://example.com:8899");
    assert.equal(wsUrl, "wss://example.com:8899/");
  });
  test("throws on non-http(s) url", () => {
    assert.throws(
      () => getWebsocketUrlFromHTTPUrl("ftp://example.com:8899"),
      /Invalid HTTP URL: ftp:\/\/example.com:8899/,
    );
  });
  test("throws on invalid url", () => {
    assert.throws(() => getWebsocketUrlFromHTTPUrl("not-a-url"), /Invalid HTTP URL/);
  });
});
