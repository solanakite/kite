import { PKCS_8_PREFIX_LENGTH } from "./constants";
import { Address, getBase58Decoder, getBase58Encoder, ReadonlyUint8Array } from "@solana/kit";
// Fixes "Value of "this" must be of type SubtleCrypto" errors
const exportKey = crypto.subtle.exportKey.bind(crypto.subtle);

/**
 * Calculates modular inverse using extended Euclidean algorithm
 */
const modInverse = (a: bigint, m: bigint): bigint => {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  let [old_t, t] = [0n, 1n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
    [old_t, t] = [t, old_t - quotient * t];
  }

  return old_s < 0n ? old_s + m : old_s;
};

// Ed25519 curve parameters
const P = 2n ** 255n - 19n; // Field modulus
const D = (-121665n * modInverse(121666n, P)) % P; // Curve parameter d

/**
 * Checks if a point is on the Ed25519 curve
 * @param publicKeyBytes - 32-byte public key
 * @returns boolean indicating if the point is on the curve
 */
const isOnEd25519Curve = (publicKeyBytes: ReadonlyUint8Array): boolean => {
  try {
    // Extract y from bytes (little-endian, last byte's high bit is x sign)
    let y = 0n;
    for (let i = 0; i < 32; i++) {
      y |= BigInt(publicKeyBytes[i] & (i === 31 ? 0x7f : 0xff)) << (8n * BigInt(i));
    }
    if (y >= P) return false;
    // Compute x^2 = (y^2 - 1) / (d*y^2 + 1) mod P
    const y2 = (y * y) % P;
    const u = (y2 - 1n + P) % P;
    const v = (D * y2 + 1n) % P;
    if (v === 0n) return false;
    const x2 = (u * modInverse(v, P)) % P;
    return isQuadraticResidue(x2, P);
  } catch {
    return false;
  }
};

/**
 * Checks if a number is a quadratic residue modulo p
 * Using Euler's criterion: a^((p-1)/2) ≡ 1 (mod p)
 */
const isQuadraticResidue = (a: bigint, p: bigint): boolean => {
  if (a === 0n) return true;
  const exponent = (p - 1n) / 2n;
  return modPow(a, exponent, p) === 1n;
};

/**
 * Calculates modular exponentiation
 */
const modPow = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  let result = 1n;
  base = base % modulus;

  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = (result * base) % modulus;
    }
    exponent = exponent >> 1n;
    base = (base * base) % modulus;
  }

  return result;
};

// Annoyingly we can't directly output the "raw" format value of a private key
// (we have to use another format)
// See https://wicg.github.io/webcrypto-secure-curves/#ed25519-operations
// So let's strip out the PKCS8 prefix and return the raw bytes that follow
export const exportRawPrivateKeyBytes = async (privateKey: CryptoKey): Promise<Uint8Array> => {
  if (!privateKey.extractable) {
    throw new Error("Private key is not extractable");
  }
  // Cast to ArrayBuffer: Web Crypto API always returns ArrayBuffer, but TypeScript DOM types
  // incorrectly include SharedArrayBuffer in the union type
  const pkcs8Bytes = (await exportKey("pkcs8", privateKey)) as ArrayBuffer;
  const rawPrivateKeyBytes = pkcs8Bytes.slice(PKCS_8_PREFIX_LENGTH);
  return new Uint8Array(rawPrivateKeyBytes);
};

export const exportRawPublicKeyBytes = async (publicKey: CryptoKey): Promise<Uint8Array> => {
  // Note we don't need to check if the public key is extractable because it is always true
  // See https://wicg.github.io/webcrypto-secure-curves/#ed25519-operations
  // Cast to ArrayBuffer: Web Crypto API always returns ArrayBuffer, but TypeScript DOM types
  // incorrectly include SharedArrayBuffer in the union type
  const rawPublicKeyBytes = (await exportKey("raw", publicKey)) as ArrayBuffer;
  return new Uint8Array(rawPublicKeyBytes);
};

export const getBase58AddressFromPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const base58Decoder = getBase58Decoder();
  const publicKeyBytes = await exportRawPublicKeyBytes(publicKey);
  const publicKeyString = base58Decoder.decode(publicKeyBytes);
  return publicKeyString;
};

/**
 * Checks if a given address is a valid Ed25519 public key.
 * @param address - The address key to check, either as a Uint8Array, base58 string, or Address
 * @returns boolean indicating if the public key is valid
 */
export const checkIfAddressIsPublicKey = async (address: Uint8Array | string | Address): Promise<boolean> => {
  const base58Encoder = getBase58Encoder();
  try {
    let publicKeyBytes: ReadonlyUint8Array;
    if (typeof address === "string") {
      publicKeyBytes = base58Encoder.encode(address);
    } else if (address instanceof Uint8Array) {
      publicKeyBytes = address;
    } else if (typeof address === "object" && address !== null && typeof (address as Address).toString === "function") {
      publicKeyBytes = base58Encoder.encode((address as Address).toString());
    } else {
      return false;
    }

    // Ed25519 public keys must be exactly 32 bytes
    if (publicKeyBytes.length !== 32) {
      return false;
    }

    // Reject all-zero public keys
    if (publicKeyBytes.every((b) => b === 0)) {
      return false;
    }

    // Check if the point is on the Ed25519 curve
    if (!isOnEd25519Curve(publicKeyBytes)) {
      return false;
    }

    // Try to import the key to verify it's a valid Ed25519 public key
    try {
      await crypto.subtle.importKey(
        "raw",
        publicKeyBytes,
        {
          name: "Ed25519",
          namedCurve: "Ed25519",
        },
        false,
        ["verify"],
      );
    } catch (error) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};
