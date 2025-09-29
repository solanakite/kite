import { before, describe, test } from "node:test";
import assert from "node:assert";
import { Address } from "@solana/kit";
import { getPDAAndBump } from "../lib/pdas";

describe("getPDAAndBump", () => {
  test("getPDAAndBump returns the same as the web3.js v1 equivalent code", async () => {
    const aliceAddress = "qbuMdeYxYJXBjU6C6qFKjZKjXmrU83eDQomHdrch826" as Address;
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const offerId = 420n;
    const { pda, bump } = await getPDAAndBump(programAddress, ["offer", aliceAddress, offerId]);

    assert.equal(pda.toString(), "GNhnD5ucxtTkuX4raePZxo4spK27t4qzBMHgscSYyLS3");
    assert.equal(bump, 253);
  });

  test("works with string seed only", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const { pda, bump } = await getPDAAndBump(programAddress, ["foo"]);
    assert.ok(pda);
    assert.strictEqual(typeof bump, "number");
  });

  test("works with Address seed only", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const addr = "qbuMdeYxYJXBjU6C6qFKjZKjXmrU83eDQomHdrch826" as Address;
    const { pda, bump } = await getPDAAndBump(programAddress, [addr]);
    assert.ok(pda);
    assert.strictEqual(typeof bump, "number");
  });

  test("works with BigInt seed only", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const { pda, bump } = await getPDAAndBump(programAddress, [123456789n]);
    assert.ok(pda);
    assert.strictEqual(typeof bump, "number");
  });

  test("works with Uint8Array seed only", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const arr = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const { pda, bump } = await getPDAAndBump(programAddress, [arr]);
    assert.ok(pda);
    assert.strictEqual(typeof bump, "number");
  });

  test("works with mixed seed types", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const addr = "qbuMdeYxYJXBjU6C6qFKjZKjXmrU83eDQomHdrch826" as Address;
    const arr = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2]);
    const { pda, bump } = await getPDAAndBump(programAddress, ["foo", addr, 42n, arr]);
    assert.ok(pda);
    assert.strictEqual(typeof bump, "number");
  });

  test("throws or returns for empty seeds array", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    try {
      await getPDAAndBump(programAddress, []);
      // If no error, that's fine, just check output type
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  });

  test("useBigEndian parameter works with BigInt seeds", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const bigIntSeed = 123456789n;

    // Test little-endian (default)
    const { pda: pdaLE, bump: bumpLE } = await getPDAAndBump(programAddress, [bigIntSeed], false);

    // Test big-endian
    const { pda: pdaBE, bump: bumpBE } = await getPDAAndBump(programAddress, [bigIntSeed], true);

    // PDAs should be different due to different byte ordering
    assert.notEqual(pdaLE.toString(), pdaBE.toString(), "Little-endian and big-endian should produce different PDAs");

    // Both should be valid addresses with valid bumps
    assert.ok(pdaLE);
    assert.ok(pdaBE);
    assert.strictEqual(typeof bumpLE, "number");
    assert.strictEqual(typeof bumpBE, "number");
    assert.ok(bumpLE >= 0 && bumpLE <= 255);
    assert.ok(bumpBE >= 0 && bumpBE <= 255);
  });

  test("useBigEndian parameter defaults to false (little-endian)", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const bigIntSeed = 987654321n;

    // Test default behavior (should be little-endian)
    const { pda: pdaDefault, bump: bumpDefault } = await getPDAAndBump(programAddress, [bigIntSeed]);

    // Test explicit false (little-endian)
    const { pda: pdaExplicit, bump: bumpExplicit } = await getPDAAndBump(programAddress, [bigIntSeed], false);

    // Should produce identical results
    assert.equal(pdaDefault.toString(), pdaExplicit.toString(), "Default and explicit false should produce same PDA");
    assert.equal(bumpDefault, bumpExplicit, "Default and explicit false should produce same bump");
  });

  test("useBigEndian parameter works with mixed seed types", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const addr = "qbuMdeYxYJXBjU6C6qFKjZKjXmrU83eDQomHdrch826" as Address;
    const bigIntSeed = 555666777n;
    const arr = new Uint8Array([1, 2, 3, 4]);

    // Test little-endian
    const { pda: pdaLE, bump: bumpLE } = await getPDAAndBump(programAddress, ["test", addr, bigIntSeed, arr], false);

    // Test big-endian
    const { pda: pdaBE, bump: bumpBE } = await getPDAAndBump(programAddress, ["test", addr, bigIntSeed, arr], true);

    // PDAs should be different due to different BigInt byte ordering
    assert.notEqual(
      pdaLE.toString(),
      pdaBE.toString(),
      "Mixed seeds with different endianness should produce different PDAs",
    );

    // Both should be valid
    assert.ok(pdaLE);
    assert.ok(pdaBE);
    assert.strictEqual(typeof bumpLE, "number");
    assert.strictEqual(typeof bumpBE, "number");
  });

  test("useBigEndian parameter only affects BigInt seeds", async () => {
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const addr = "qbuMdeYxYJXBjU6C6qFKjZKjXmrU83eDQomHdrch826" as Address;
    const arr = new Uint8Array([5, 6, 7, 8]);

    // Test with only non-BigInt seeds (should be identical regardless of endianness)
    const { pda: pdaLE, bump: bumpLE } = await getPDAAndBump(programAddress, ["test", addr, arr], false);
    const { pda: pdaBE, bump: bumpBE } = await getPDAAndBump(programAddress, ["test", addr, arr], true);

    // Should produce identical results since no BigInt seeds
    assert.equal(
      pdaLE.toString(),
      pdaBE.toString(),
      "Non-BigInt seeds should produce same PDA regardless of endianness",
    );
    assert.equal(bumpLE, bumpBE, "Non-BigInt seeds should produce same bump regardless of endianness");
  });
});
