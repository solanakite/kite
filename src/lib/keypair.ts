import {
  createKeyPairSignerFromBytes,
  KeyPairSigner,
  Address,
  createKeyPairSignerFromPrivateKeyBytes,
} from "@solana/kit";
import { assertKeyGenerationIsAvailable } from "@solana/assertions";
import { exportRawPrivateKeyBytes, exportRawPublicKeyBytes, getBase58AddressFromPublicKey } from "./crypto";
import {
  BASE58_CHARACTER_SET,
  DEFAULT_FILEPATH,
  GRIND_COMPLEXITY_THRESHOLD,
  KEYPAIR_LENGTH,
  KEYPAIR_PUBLIC_KEY_OFFSET,
} from "./constants";
import { isBrowser } from "./utilts";
const ALLOW_EXTRACTABLE_PRIVATE_KEY_MESSAGE =
  "yes I understand the risk of extractable private keys and will delete this keypair shortly after saving it to a file";

// TODO: we should rename this
// 'Grind' a keypair means making keypairs repeatedly until we match a vanity name.
export const grindKeyPair = async (options: {
  prefix?: string | null;
  suffix?: string | null;
  silenceGrindProgress?: boolean;
  // We have no choice but to makeextractable keypairs here, since we need to write the private key to a file
  isPrivateKeyExtractable?: false | typeof ALLOW_EXTRACTABLE_PRIVATE_KEY_MESSAGE;
}): Promise<CryptoKeyPair> => {
  await assertKeyGenerationIsAvailable();

  // Do not allow extractable keyPairs unless the user has explicitly said they understand the risk
  const allowExtractablePrivateKey = options.isPrivateKeyExtractable === ALLOW_EXTRACTABLE_PRIVATE_KEY_MESSAGE;

  // Ensure the prefix and suffix are within the base58 character set
  if (options.prefix && !BASE58_CHARACTER_SET.test(options.prefix)) {
    throw new Error("Prefix must contain only base58 characters.");
  }
  if (options.suffix && !BASE58_CHARACTER_SET.test(options.suffix)) {
    throw new Error("Suffix must contain only base58 characters.");
  }

  // Throw a warning if keypairGrindComplexity is greater than GRIND_COMPLEXITY_THRESHOLD
  // First, add the total length of the prefix and suffix
  const keypairGrindComplexity = (options.prefix?.length || 0) + (options.suffix?.length || 0);
  if (keypairGrindComplexity > GRIND_COMPLEXITY_THRESHOLD) {
    console.warn(
      `Generating a keyPair with a prefix and suffix of ${keypairGrindComplexity} characters, this may take some time.`,
    );
  }

  // Run a loop until we that starts with the prefix and ends with the suffix
  let counter = 0;
  while (true) {
    counter++;

    // Log every 100,000 iterations
    if (!options.silenceGrindProgress && counter % 100000 === 0) {
      console.log(`Keypair grind tries: ${counter}`);
    }

    const keyPair = await crypto.subtle.generateKey(
      // Algorithm. Native implementation status: https://github.com/WICG/webcrypto-secure-curves/issues/20
      "Ed25519",
      // Allows the private key to be exported (eg for saving it to a file) - public key is always extractable see https://wicg.github.io/webcrypto-secure-curves/#ed25519-operations
      allowExtractablePrivateKey,
      // Allowed uses
      ["sign", "verify"],
    );

    const publicKeyString = await getBase58AddressFromPublicKey(keyPair.publicKey);

    // If we don't have a prefix, we don't need to check if the keyPair starts with the prefix
    if (!options.prefix && !options.suffix) {
      return keyPair;
    }

    const matchesPrefix = options.prefix ? publicKeyString.startsWith(options.prefix) : true;
    const matchesSuffix = options.suffix ? publicKeyString.endsWith(options.suffix) : true;

    // If the keyPair matches, return it
    if (matchesPrefix && matchesSuffix) {
      return keyPair;
    }

    // Restart the loop
    continue;
  }
};

// Take a webcrypto keyPair and convert it to the same format Anza CLI uses
// 32 bytes raw private key followed by 32 bytes raw public key
// (a bit odd, since the public key is usually derived from the private key, but
// this is how NaCl / libsodium did it, and it saves a little time not having
// to derive the public key from the private key)
export const createJSONFromKeyPairSigner = async (keyPairSigner: KeyPairSigner): Promise<string> => {
  const rawPrivateKeyBytes = await exportRawPrivateKeyBytes(keyPairSigner.keyPair.privateKey);
  const rawPublicKeyBytes = await exportRawPublicKeyBytes(keyPairSigner.keyPair.publicKey);

  // Concatenate the raw private and public keys
  const combinedUint8Array = new Uint8Array(KEYPAIR_LENGTH);
  combinedUint8Array.set(new Uint8Array(rawPrivateKeyBytes), 0);
  combinedUint8Array.set(new Uint8Array(rawPublicKeyBytes), KEYPAIR_PUBLIC_KEY_OFFSET);

  return JSON.stringify(Array.from(combinedUint8Array));
};

/**
 * Loads a wallet (KeyPairSigner) from a file. The file should be in the same format as files created by the solana-keygen command.
 * @param {string} [filepath] - Path to load keypair from file. Defaults to ~/.config/solana/id.json
 * @returns {Promise<KeyPairSigner>} The loaded wallet
 */
export const loadWalletFromFile = async (filepath?: string): Promise<KeyPairSigner> => {
  if (isBrowser) {
    throw new Error(
      "loadWalletFromFile is not available in browser environments. " +
        "It relies on Node.js built-ins like fs/promises.",
    );
  }
  // Node-specific imports
  const path = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  // Work out correct file name
  if (!filepath) {
    filepath = DEFAULT_FILEPATH;
  }
  if (filepath[0] === "~") {
    const home = process.env.HOME || null;
    if (home) {
      filepath = path.join(home, filepath.slice(1));
    }
  }

  // Get contents of file
  let fileContents: string;
  try {
    // This a Buffer, not a Uint8Array
    // (which doesn't work in browser)
    // but that's ok because we're not using it in the browser
    const fileContentsBuffer = await readFile(filepath);
    fileContents = fileContentsBuffer.toString();
  } catch (thrownObject) {
    throw new Error(`Could not read keyPair from file at '${filepath}'`);
  }

  try {
    // Parse file and return the keyPair
    const parsedFileContents = Uint8Array.from(JSON.parse(fileContents));
    return createKeyPairSignerFromBytes(parsedFileContents);
  } catch (thrownObject) {
    const error = thrownObject as Error;
    if (!error.message.includes("Unexpected token")) {
      throw error;
    }
    throw new Error(`Invalid secret key file at '${filepath}'!`);
  }
};

/**
 * Loads a wallet (KeyPairSigner) from an environment variable. The keypair should be in the same 'array of numbers' format as used by solana-keygen.
 * @param {string} variableName - Name of environment variable containing the keypair
 * @returns {KeyPairSigner} The loaded wallet
 */
export const loadWalletFromEnvironment = (variableName: string) => {
  const privateKeyString = process.env[variableName];
  if (!privateKeyString) {
    throw new Error(`Please set '${variableName}' in environment.`);
  }

  try {
    // If we wanted to, we could also support base58 encoded private keys
    // let decodedPrivateKey = getBase58Encoder().encode(solanaPrivateKeyBase58)
    // but the array-of-numbers format is the Anza CLI's format
    let decodedPrivateKey = Uint8Array.from(JSON.parse(privateKeyString));
    return createKeyPairSignerFromBytes(decodedPrivateKey);
  } catch (error) {
    throw new Error(`Invalid private key in environment variable '${variableName}'!`);
  }
};

export const addKeyPairSignerToEnvFile = async (
  keyPairSigner: KeyPairSigner,
  variableName: string,
  envFileName?: string,
) => {
  if (isBrowser) {
    throw new Error(
      "addKeyPairSignerToEnvFile is not available in browser environments. " +
        "It relies on Node.js built-ins like fs/promises.",
    );
  }
  // Node-specific imports
  const { appendFile } = await import("node:fs/promises");
  if (!envFileName) {
    envFileName = ".env";
  }
  const existingSecretKey = process.env[variableName];
  if (existingSecretKey) {
    throw new Error(`'${variableName}' already exists in env file.`);
  }
  const privateKeyString = await createJSONFromKeyPairSigner(keyPairSigner);
  await appendFile(envFileName, `\n# Solana Address: ${keyPairSigner.address}\n${variableName}=${privateKeyString}`);
};

export const checkAddressMatchesPrivateKey = async (address: Address, privateKey: Uint8Array) => {
  const temporarySigner = await createKeyPairSignerFromPrivateKeyBytes(privateKey);
  return temporarySigner.address === address;
};
