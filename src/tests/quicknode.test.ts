import { describe, test } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { getQuickNodePriorityFeesFactory, getAssetsByOwnerFactory, getAssetFactory } from "../lib/quicknode";

const QN_ENDPOINT = process.env.QN_ENDPOINT_URL ?? "";
const hasEndpoint  = QN_ENDPOINT.length > 0;

// ─────────────────────────────────────────────────────────────
// getQuickNodePriorityFeesFactory
// ─────────────────────────────────────────────────────────────

describe("getQuickNodePriorityFeesFactory", () => {
  test("factory returns a function", () => {
    const getPriorityFees = getQuickNodePriorityFeesFactory("https://example.quiknode.pro/token/");
    assert.equal(typeof getPriorityFees, "function");
  });

  test("returns all fee levels when endpoint is live", async () => {
    if (!hasEndpoint) {
      console.log("Skipping live test — set QN_ENDPOINT_URL to run");
      return;
    }
    const getPriorityFees = getQuickNodePriorityFeesFactory(QN_ENDPOINT);
    const fees = await getPriorityFees();

    // Verify the result has the expected shape
    assert.ok(typeof fees === "object" && fees !== null, "result must be an object");

    // These four are always present in the API response
    assert.ok(typeof fees.low     === "number" && fees.low     >= 0, "low must be a non-negative number");
    assert.ok(typeof fees.medium  === "number" && fees.medium  >= 0, "medium must be a non-negative number");
    assert.ok(typeof fees.high    === "number" && fees.high    >= 0, "high must be a non-negative number");
    assert.ok(typeof fees.extreme === "number" && fees.extreme >= 0, "extreme must be a non-negative number");

    // recommended can be 0 or undefined on some endpoints — just check type
    assert.ok(
      fees.recommended === undefined || typeof fees.recommended === "number",
      "recommended must be a number or undefined"
    );

    // networkCongestion must be a number
    assert.ok(
      typeof fees.networkCongestion === "number",
      "networkCongestion must be a number"
    );
  });

  test("accepts account filter and lastNBlocks options", async () => {
    if (!hasEndpoint) {
      console.log("Skipping live test — set QN_ENDPOINT_URL to run");
      return;
    }
    const getPriorityFees = getQuickNodePriorityFeesFactory(QN_ENDPOINT);
    const fees = await getPriorityFees({
      account:     "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      lastNBlocks: 50,
    });
    assert.ok(typeof fees.low     === "number", "low must be a number");
    assert.ok(typeof fees.high    === "number", "high must be a number");
    assert.ok(typeof fees.extreme === "number", "extreme must be a number");
  });

  test("throws on HTTP error from endpoint", async () => {
    const server = createServer((_, res) => {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Failed to get server address");
    const url = `http://localhost:${addr.port}`;
    const getPriorityFees = getQuickNodePriorityFeesFactory(url);
    try {
      await assert.rejects(
        async () => { await getPriorityFees(); },
        (error: Error) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes("403"), `Expected 403, got: ${error.message}`);
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("throws on RPC method error", async () => {
    const server = createServer((_, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0", id: 1,
        error: { code: -32601, message: "Method not found" },
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Failed to get server address");
    const url = `http://localhost:${addr.port}`;
    const getPriorityFees = getQuickNodePriorityFeesFactory(url);
    try {
      await assert.rejects(
        async () => { await getPriorityFees(); },
        (error: Error) => {
          assert.ok(error instanceof Error);
          assert.ok(
            error.message.includes("-32601") || error.message.includes("Method not found"),
            `Expected method error, got: ${error.message}`
          );
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// getAssetsByOwnerFactory
// ─────────────────────────────────────────────────────────────

describe("getAssetsByOwnerFactory", () => {
  test("factory returns a function", () => {
    const getAssetsByOwner = getAssetsByOwnerFactory("https://example.quiknode.pro/token/");
    assert.equal(typeof getAssetsByOwner, "function");
  });

  test("returns assets result shape when endpoint is live", async () => {
    if (!hasEndpoint) {
      console.log("Skipping live test — set QN_ENDPOINT_URL to run");
      return;
    }
    const getAssetsByOwner = getAssetsByOwnerFactory(QN_ENDPOINT);
    const result = await getAssetsByOwner({
      ownerAddress: "E645TckHQnDcavVv92Etc6xSWQaq8zzPtPRGBheviRAk",
      limit:        5,
    });
    assert.ok(typeof result.total === "number" && result.total >= 0, "total must be >= 0");
    assert.ok(typeof result.limit === "number",                       "limit must be a number");
    assert.ok(typeof result.page  === "number" && result.page  >= 1,  "page must be >= 1");
    assert.ok(Array.isArray(result.items),                            "items must be an array");
    for (const asset of result.items) {
      assert.ok(typeof asset.id        === "string",  "asset.id must be a string");
      assert.ok(typeof asset.interface === "string",  "asset.interface must be a string");
      assert.ok(typeof asset.mutable   === "boolean", "asset.mutable must be a boolean");
      assert.ok(typeof asset.burnt     === "boolean", "asset.burnt must be a boolean");
    }
  });

  test("respects limit option", async () => {
    if (!hasEndpoint) {
      console.log("Skipping live test — set QN_ENDPOINT_URL to run");
      return;
    }
    const getAssetsByOwner = getAssetsByOwnerFactory(QN_ENDPOINT);
    const result = await getAssetsByOwner({
      ownerAddress: "E645TckHQnDcavVv92Etc6xSWQaq8zzPtPRGBheviRAk",
      limit:        1,
    });
    assert.ok(result.items.length <= 1, "items.length must be <= limit");
  });

  test("returns an array for any wallet address", async () => {
    if (!hasEndpoint) {
      console.log("Skipping live test — set QN_ENDPOINT_URL to run");
      return;
    }
    const getAssetsByOwner = getAssetsByOwnerFactory(QN_ENDPOINT);
    // Use a known address with a very low chance of owning NFTs
    const result = await getAssetsByOwner({
      ownerAddress: "Vote111111111111111111111111111111111111111",
      limit:        1,
    });
    // Regardless of whether it has NFTs or not, shape must be correct
    assert.ok(typeof result.total === "number" && result.total >= 0, "total must be >= 0");
    assert.ok(Array.isArray(result.items), "items must always be an array");
  });

  test("throws on HTTP error from endpoint", async () => {
    const server = createServer((_, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Failed to get server address");
    const url = `http://localhost:${addr.port}`;
    const getAssetsByOwner = getAssetsByOwnerFactory(url);
    try {
      await assert.rejects(
        async () => {
          await getAssetsByOwner({ ownerAddress: "E645TckHQnDcavVv92Etc6xSWQaq8zzPtPRGBheviRAk" });
        },
        (error: Error) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes("500"), `Expected 500, got: ${error.message}`);
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// getAssetFactory
// ─────────────────────────────────────────────────────────────

describe("getAssetFactory", () => {
  test("factory returns a function", () => {
    const getAsset = getAssetFactory("https://example.quiknode.pro/token/");
    assert.equal(typeof getAsset, "function");
  });

  test("returns full asset details for a known mint", async () => {
    if (!hasEndpoint) {
      console.log("Skipping live test — set QN_ENDPOINT_URL to run");
      return;
    }
    const getAsset = getAssetFactory(QN_ENDPOINT);
    const asset = await getAsset("JDv5J89tKZCbsZ1wRSynNdBQZU72wPsuj1uhDGf85pDn");
    assert.ok(typeof asset.id        === "string",  "asset.id must be a string");
    assert.ok(typeof asset.interface === "string",  "asset.interface must be a string");
    assert.ok(typeof asset.mutable   === "boolean", "asset.mutable must be a boolean");
    assert.ok(typeof asset.burnt     === "boolean", "asset.burnt must be a boolean");
    assert.ok(asset.content?.metadata?.name !== undefined, "must have metadata.name");
    assert.ok(typeof asset.ownership?.owner === "string",  "must have ownership.owner");
  });

  test("asset has compression fields when compressed", async () => {
    if (!hasEndpoint) {
      console.log("Skipping live test — set QN_ENDPOINT_URL to run");
      return;
    }
    const getAsset = getAssetFactory(QN_ENDPOINT);
    const asset = await getAsset("JDv5J89tKZCbsZ1wRSynNdBQZU72wPsuj1uhDGf85pDn");
    if (asset.compression?.compressed) {
      assert.ok(typeof asset.compression.tree    === "string", "must have compression.tree");
      assert.ok(typeof asset.compression.leaf_id === "number", "must have compression.leaf_id");
      assert.ok(typeof asset.compression.seq     === "number", "must have compression.seq");
    }
  });

  test("throws on HTTP error from endpoint", async () => {
    const server = createServer((_, res) => {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Failed to get server address");
    const url = `http://localhost:${addr.port}`;
    const getAsset = getAssetFactory(url);
    try {
      await assert.rejects(
        async () => { await getAsset("SomeMintAddress"); },
        (error: Error) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes("403"), `Expected 403, got: ${error.message}`);
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("throws on RPC error response", async () => {
    const server = createServer((_, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0", id: 1,
        error: { code: -32602, message: "Invalid params" },
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Failed to get server address");
    const url = `http://localhost:${addr.port}`;
    const getAsset = getAssetFactory(url);
    try {
      await assert.rejects(
        async () => { await getAsset("InvalidMintAddress"); },
        (error: Error) => {
          assert.ok(error instanceof Error);
          assert.ok(
            error.message.includes("-32602") || error.message.includes("Invalid params"),
            `Expected param error, got: ${error.message}`
          );
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});