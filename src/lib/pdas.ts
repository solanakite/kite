import { Address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";

const addressEncoder = getAddressEncoder();

// The web3.js c2 equivalent of
//    bigNumber.toArrayLike(Buffer, "le", 8),
// from web3.js v1
const bigIntToSeed = (bigInt: bigint, byteLength: number, useBigEndian: boolean = false): Uint8Array => {
  const bytes = new Uint8Array(byteLength);

  if (useBigEndian) {
    // Big-endian: most significant byte first
    let temp = bigInt;
    for (let i = byteLength - 1; i >= 0 && temp > 0n; i--) {
      bytes[i] = Number(temp & 0xffn);
      temp >>= 8n;
    }
  } else {
    // Little-endian: least significant byte first
    let temp = bigInt;
    for (let i = 0; i < byteLength && temp > 0n; i++) {
      bytes[i] = Number(temp & 0xffn);
      temp >>= 8n;
    }
  }

  return bytes;
};

/**
 * Calculates a Program Derived Address (PDA) and its bump seed from a program address and seeds.
 * Handles encoding of different seed types:
 *   - Strings: encoded as UTF-8
 *   - Addresses: encoded using the address encoder
 *   - BigInts: encoded as 8-byte Uint8Array (little-endian by default, big-endian if specified)
 *   - Uint8Array: used as-is
 *
 * @param {Address} programAddress - The program address to derive the PDA from
 * @param {Array<String | Address | BigInt | Uint8Array>} seeds - Array of seeds to derive the PDA
 * @param {boolean} useBigEndian - Whether to use big-endian byte order for BigInt seeds (default: false)
 * @returns {Promise<{pda: Address, bump: number}>} The derived PDA and its bump seed
 */
export const getPDAAndBump = async (
  programAddress: Address,
  seeds: Array<String | Address | BigInt | Uint8Array>,
  useBigEndian: boolean = false,
) => {
  const seedsUint8Array = seeds.map((seed) => {
    if (seed instanceof Uint8Array) {
      return seed; // Pass through unchanged
    }
    if (typeof seed === "bigint") {
      return bigIntToSeed(seed, 8, useBigEndian);
    }

    // Try to encode as Address, if it fails treat as string
    // (since Address is an extension of String at runtime)
    try {
      const encoded = addressEncoder.encode(seed as Address);
      return encoded;
    } catch {
      return new TextEncoder().encode(seed as string);
    }
  });
  const [pda, bump] = await getProgramDerivedAddress({
    seeds: seedsUint8Array,
    programAddress,
  });
  return { pda, bump };
};
