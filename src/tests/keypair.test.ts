import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import {
  addKeyPairSignerToEnvFile,
  createJSONFromKeyPairSigner,
  grindKeyPair,
  loadWalletFromEnvironment,
  loadWalletFromFile,
  checkAddressMatchesPrivateKey,
} from "../lib/keypair";
import {
  exportRawPrivateKeyBytes,
  exportRawPublicKeyBytes,
  getBase58AddressFromPublicKey,
} from "../lib/crypto";
import { address, Address, getBase58Decoder } from "@solana/kit";
import { getPDAAndBump } from "../lib/pdas";
import { connect } from "../lib/connect";
// See https://m.media-amazon.com/images/I/51TJeGHxyTL._SY445_SX342_.jpg
import { exec as execNoPromises } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink as deleteFile } from "node:fs/promises";
import dotenv from "dotenv";
import { createSignerFromKeyPair, KeyPairSigner, createKeyPairSignerFromBytes } from "@solana/kit";
import { log } from "../lib/serializer";

const exec = promisify(execNoPromises);
const TEMP_DIR = "temp";

// Use this for tests only. Extractable keypairs suck.
const makeExtractableKeyPairForTests = async () => {
  return crypto.subtle.generateKey(
    "Ed25519",
    // Remember these should be deleted or removed from scope
    true,
    ["sign", "verify"],
  );
};

describe("bytesToCryptoKeyPair", () => {
  test("converts a byte array to a keyPairSigner and back", async () => {
    const byteArray = new Uint8Array([
      151, 24, 248, 226, 248, 85, 216, 178, 164, 113, 117, 70, 121, 115, 157, 157, 205, 102, 210, 37, 141, 245, 213,
      254, 199, 203, 222, 93, 253, 117, 255, 18, 83, 40, 53, 247, 88, 125, 205, 117, 253, 145, 76, 192, 68, 252, 144,
      167, 77, 47, 55, 214, 164, 6, 126, 238, 7, 242, 183, 1, 108, 87, 126, 9,
    ]);

    const keyPairSigner = await createKeyPairSignerFromBytes(byteArray, true);

    const testCryptoKeyPairString = await createJSONFromKeyPairSigner(keyPairSigner);

    assert.deepEqual(byteArray, Uint8Array.from(JSON.parse(testCryptoKeyPairString)));
  });
});

describe("addKeyPairSignerToEnvFile", () => {
  const TEST_ENV_VAR_ARRAY_OF_NUMBERS = "TEST_ENV_VAR_ARRAY_OF_NUMBERS";
  let testKeyPairSigner: KeyPairSigner;

  before(async () => {
    const testCryptoKeyPair = await makeExtractableKeyPairForTests();
    testKeyPairSigner = await createSignerFromKeyPair(testCryptoKeyPair);

    const testCryptoKeyPairString = await createJSONFromKeyPairSigner(testKeyPairSigner);

    process.env[TEST_ENV_VAR_ARRAY_OF_NUMBERS] = testCryptoKeyPairString;
  });

  test("Adds keyPairSigner to env file if variable doesn't exist", async () => {
    // We need to use a specific file name to avoid conflicts with other tests
    const envFileName = "../.env-unittest-add-key-pair-to-env-file";
    await addKeyPairSignerToEnvFile(testKeyPairSigner, "TEMP_KEYPAIR", envFileName);
    // Now reload the environment and check it matches our test keyPair
    dotenv.config({ path: envFileName });
    // Get the secret from the .env file
    const privateKeyString = process.env.TEMP_KEYPAIR;
    if (!privateKeyString) {
      throw new Error("TEMP_KEYPAIR not found in environment");
    }
    const privateKeyBytes = Uint8Array.from(JSON.parse(privateKeyString));
    const envKeyPairSigner = await createKeyPairSignerFromBytes(privateKeyBytes);
    assert.ok(envKeyPairSigner.keyPair.privateKey);
    await deleteFile(envFileName);
  });

  test("throws a nice error if the env var already exists", async () => {
    assert.rejects(async () => addKeyPairSignerToEnvFile(testKeyPairSigner, TEST_ENV_VAR_ARRAY_OF_NUMBERS), {
      message: `'TEST_ENV_VAR_ARRAY_OF_NUMBERS' already exists in env file.`,
    });
  });
});

describe("loadWalletFromFile", () => {
  test("getting a keyPair from a file", async () => {
    const TEST_KEY_PAIR_FILE = `${TEMP_DIR}/test-key-pair-file-do-not-use.json`;
    const { stdout } = await exec(`solana-keygen new --force --no-bip39-passphrase -o ${TEST_KEY_PAIR_FILE}`);
    // Note Anza's Solana Kit spells key pair as two words, Anza's Solana CLI spells it as one word
    assert(stdout.includes("Wrote new keypair"));
    await loadWalletFromFile(TEST_KEY_PAIR_FILE);
    await deleteFile(TEST_KEY_PAIR_FILE);
  });

  test("throws a nice error if the file is missing", async () => {
    const MISSING_KEY_PAIR_FILE = "THIS FILE DOES NOT EXIST";
    await assert.rejects(async () => loadWalletFromFile(MISSING_KEY_PAIR_FILE), {
      message: `Could not read keyPair from file at '${MISSING_KEY_PAIR_FILE}'`,
    });
  });

  test("throws a nice error if the file is corrupt", async () => {
    const CORRUPT_TEST_KEY_PAIR = `${TEMP_DIR}/corrupt-key-pair-file-do-not-use.json`;
    await writeFile(CORRUPT_TEST_KEY_PAIR, "I AM CORRUPT");
    await assert.rejects(async () => loadWalletFromFile(CORRUPT_TEST_KEY_PAIR), {
      message: `Invalid secret key file at '${CORRUPT_TEST_KEY_PAIR}'!`,
    });
    await deleteFile(CORRUPT_TEST_KEY_PAIR);
  });
});

describe("loadWalletFromEnvironment", () => {
  const TEST_ENV_VAR_ARRAY_OF_NUMBERS = "TEST_ENV_VAR_ARRAY_OF_NUMBERS";
  const TEST_ENV_VAR_WITH_BAD_VALUE = "TEST_ENV_VAR_WITH_BAD_VALUE";

  before(async () => {
    const randomCryptoKeyPair = await makeExtractableKeyPairForTests();
    const randomKeyPairSigner = await createSignerFromKeyPair(randomCryptoKeyPair);

    process.env[TEST_ENV_VAR_ARRAY_OF_NUMBERS] = await createJSONFromKeyPairSigner(randomKeyPairSigner);

    process.env[TEST_ENV_VAR_WITH_BAD_VALUE] = "this isn't a valid value for a secret key";
  });

  test("getting a keyPair from an environment variable (array of numbers format)", async () => {
    const cryptoKeyPair = await loadWalletFromEnvironment(TEST_ENV_VAR_ARRAY_OF_NUMBERS);
  });

  test("throws a nice error if the env var doesn't exist", () => {
    assert.throws(() => loadWalletFromEnvironment("MISSING_ENV_VAR"), {
      message: `Please set 'MISSING_ENV_VAR' in environment.`,
    });
  });

  test("throws a nice error if the value of the env var isn't valid", () => {
    assert.throws(() => loadWalletFromEnvironment("TEST_ENV_VAR_WITH_BAD_VALUE"), {
      message: `Invalid private key in environment variable 'TEST_ENV_VAR_WITH_BAD_VALUE'!`,
    });
  });
});

describe("checkAddressMatchesPrivateKey", () => {
  test("returns true when address matches secret key", async () => {
    // Make a temporary keypair
    const keyPair = await makeExtractableKeyPairForTests();
    const keyPairSigner = await createSignerFromKeyPair(keyPair);

    // Convert keyPair.privateKey into a Uint8Array
    const privateKeyBytes = await exportRawPrivateKeyBytes(keyPair.privateKey);

    const result = await checkAddressMatchesPrivateKey(keyPairSigner.address, privateKeyBytes);
    assert.equal(result, true);
  });

  test("returns false when address does not match secret key", async () => {
    const keyPair1 = await makeExtractableKeyPairForTests();
    const keyPair2 = await makeExtractableKeyPairForTests();
    const keyPairSigner1 = await createSignerFromKeyPair(keyPair1);
    const privateKeyBytes2 = await exportRawPrivateKeyBytes(keyPair2.privateKey);

    const result = await checkAddressMatchesPrivateKey(keyPairSigner1.address, privateKeyBytes2);
    assert.equal(result, false);
  });
});

describe("checkIfAddressIsPublicKey", () => {
  let keyPair: CryptoKeyPair;
  let publicKeyBytes: Uint8Array;
  let publicKeyString: string;
  const connection = connect();

  before(async () => {
    const base58Decoder = getBase58Decoder();
    keyPair = await makeExtractableKeyPairForTests();
    publicKeyBytes = await exportRawPublicKeyBytes(keyPair.publicKey);
    publicKeyString = base58Decoder.decode(publicKeyBytes);
  });

  test("returns true for valid Ed25519 public key bytes", async () => {
    assert.equal(await connection.checkIfAddressIsPublicKey(publicKeyBytes), true);
  });

  test("returns true for valid base58 encoded public key", async () => {
    assert.equal(await connection.checkIfAddressIsPublicKey(publicKeyString), true);
  });

  test("returns false for a Program Derived Address", async () => {
    const programAddress = address("11111111111111111111111111111111");
    const { pda } = await getPDAAndBump(programAddress, ["test-seed"]);
    assert.equal(await connection.checkIfAddressIsPublicKey(pda), false);
  });

  test("returns true for valid Address type", async () => {
    const publicKeyString = await getBase58AddressFromPublicKey(keyPair.publicKey);
    // Solana kit uses the name 'address' for a function, so we use address1 here.
    const address1 = address(publicKeyString);
    assert.equal(await connection.checkIfAddressIsPublicKey(address1), true);
  });

  test("returns false for invalid length bytes", async () => {
    const invalidKey = new Uint8Array(31); // Too short
    assert.equal(await connection.checkIfAddressIsPublicKey(invalidKey), false);
  });

  test("returns false for invalid base58 string", async () => {
    assert.equal(await connection.checkIfAddressIsPublicKey("invalid-base58"), false);
  });

  test("returns false for invalid public key bytes", async () => {
    const invalidKey = new Uint8Array(32).fill(0); // All zeros is not a valid public key
    assert.equal(await connection.checkIfAddressIsPublicKey(invalidKey), false);
  });

  test("returns false for non-base58 string", async () => {
    assert.equal(await connection.checkIfAddressIsPublicKey("not-a-base58-string!"), false);
  });

  test("returns false for empty string", async () => {
    assert.equal(await connection.checkIfAddressIsPublicKey(""), false);
  });

  test("returns false for null", async () => {
    // @ts-expect-error Testing invalid input
    assert.equal(await connection.checkIfAddressIsPublicKey(null), false);
  });

  test("returns false for undefined", async () => {
    // @ts-expect-error Testing invalid input
    assert.equal(await connection.checkIfAddressIsPublicKey(undefined), false);
  });
});
