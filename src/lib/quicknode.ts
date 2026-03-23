/**
 * QuickNode-specific helpers for Kite
 *
 * These functions require a QuickNode endpoint with the relevant add-ons enabled.
 * Get a free endpoint at: https://dashboard.quicknode.com
 *
 * Add-ons used:
 *   - Solana Priority Fee API (FREE) → getQuickNodePriorityFeesFactory
 *   - Metaplex Digital Asset Standard API (FREE) → getAssetsByOwnerFactory, getAssetFactory
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface QuickNodePriorityFees {
  /** Cheapest fee — may be slow during congestion */
  low: number;
  /** Medium fee — fine on a quiet network */
  medium: number;
  /** Recommended fee — best default for most transactions */
  recommended: number;
  /** High fee — use when you need confirmation in the next block */
  high: number;
  /** Extreme fee — use during peak congestion */
  extreme: number;
  /**
   * Network congestion score from 0 to 1.
   * 0 = very quiet, 1 = extremely busy.
   */
  networkCongestion: number;
}

export interface QuickNodePriorityFeeOptions {
  /**
   * Filter fee estimate by a specific account address (e.g. a program ID).
   * More accurate than the global estimate when you know which accounts
   * your transaction will touch.
   */
  account?: string;
  /**
   * Number of recent blocks to sample for fee estimation.
   * Default: 100
   */
  lastNBlocks?: number;
}

export interface DigitalAssetContent {
  json_uri: string;
  metadata: {
    name: string;
    symbol: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  };
}

export interface DigitalAsset {
  /** The mint address of the asset */
  id: string;
  /** Asset interface type (V1_NFT, FungibleToken, etc.) */
  interface: string;
  content: DigitalAssetContent;
  ownership: {
    owner: string;
    frozen: boolean;
    delegated: boolean;
    delegate?: string;
  };
  compression?: {
    compressed: boolean;
    tree: string;
    leaf_id: number;
    seq: number;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
  };
  royalty?: {
    basis_points: number;
    percent: number;
    primary_sale_happened: boolean;
  };
  creators?: Array<{ address: string; share: number; verified: boolean }>;
  grouping?: Array<{ group_key: string; group_value: string }>;
  mutable: boolean;
  burnt: boolean;
}

export interface GetAssetsByOwnerResult {
  total: number;
  limit: number;
  page: number;
  items: DigitalAsset[];
}

export interface GetAssetsByOwnerOptions {
  /** The wallet address to query */
  ownerAddress: string;
  /** Max results per page. Default: 100 */
  limit?: number;
  /** Page number, starting at 1. Default: 1 */
  page?: number;
}

// ─────────────────────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────────────────────

const rpcFetch = async <T>(
  endpointUrl: string,
  method: string,
  params: unknown,
): Promise<T> => {
  const res = await fetch(endpointUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal:  AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QuickNode RPC error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as { result?: T; error?: { code: number; message: string } };
  if (data.error) {
    throw new Error(`QuickNode method error ${data.error.code}: ${data.error.message}`);
  }
  return data.result as T;
};

// ─────────────────────────────────────────────────────────────
// getQuickNodePriorityFeesFactory
// ─────────────────────────────────────────────────────────────

/**
 * Creates a function that fetches real-time priority fee recommendations
 * from QuickNode's Priority Fee API.
 *
 * Returns 5 fee levels (low to extreme) plus a network congestion score,
 * based on recent confirmed transactions on the network.
 *
 * Requires: Solana Priority Fee API add-on (FREE)
 * Enable at: https://dashboard.quicknode.com → your endpoint → Add-ons
 *
 * @param endpointUrl - Your QuickNode endpoint URL
 * @returns Function to fetch live priority fees
 *
 * @example
 * const getPriorityFees = getQuickNodePriorityFeesFactory(
 *   "https://your-endpoint.solana-mainnet.quiknode.pro/TOKEN/"
 * );
 *
 * const fees = await getPriorityFees();
 * console.log(`Recommended: ${fees.recommended} µlamports/CU`);
 * console.log(`Congestion:  ${(fees.networkCongestion * 100).toFixed(0)}%`);
 *
 * // Filter by program for more accurate estimates
 * const jupFees = await getPriorityFees({
 *   account: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
 * });
 */
export const getQuickNodePriorityFeesFactory = (endpointUrl: string) => {
  const getQuickNodePriorityFees = async (
    options: QuickNodePriorityFeeOptions = {}
  ): Promise<QuickNodePriorityFees> => {
    const params: Record<string, unknown> = {
      last_n_blocks: options.lastNBlocks ?? 100,
      api_version:   2,
    };
    if (options.account) {
      params.account = options.account;
    }

    const result = await rpcFetch<{
      per_compute_unit: {
        extreme:     number;
        high:        number;
        medium:      number;
        low:         number;
        recommended: number;
      };
      network_congestion?: number;
    }>(endpointUrl, "qn_estimatePriorityFees", params);

    return {
      low:               result.per_compute_unit.low,
      medium:            result.per_compute_unit.medium,
      recommended:       result.per_compute_unit.recommended,
      high:              result.per_compute_unit.high,
      extreme:           result.per_compute_unit.extreme,
      networkCongestion: result.network_congestion ?? 0,
    };
  };

  return getQuickNodePriorityFees;
};

// ─────────────────────────────────────────────────────────────
// getAssetsByOwnerFactory
// ─────────────────────────────────────────────────────────────

/**
 * Creates a function that queries all digital assets (NFTs, cNFTs, tokens)
 * owned by a wallet using QuickNode's Metaplex DAS API.
 *
 * Works with regular NFTs, compressed NFTs (cNFTs), fungible tokens,
 * and Token-2022 assets.
 *
 * Requires: Metaplex Digital Asset Standard (DAS) API add-on (FREE)
 * Enable at: https://dashboard.quicknode.com → your endpoint → Add-ons
 *
 * @param endpointUrl - Your QuickNode endpoint URL
 * @returns Function to query digital assets by owner
 *
 * @example
 * const getAssetsByOwner = getAssetsByOwnerFactory(
 *   "https://your-endpoint.solana-mainnet.quiknode.pro/TOKEN/"
 * );
 *
 * const { items, total } = await getAssetsByOwner({
 *   ownerAddress: "YourWalletAddressHere",
 *   limit: 50,
 * });
 *
 * items.forEach(asset => {
 *   console.log(asset.content.metadata.name);
 *   console.log(asset.compression?.compressed ? "cNFT" : "NFT");
 * });
 */
export const getAssetsByOwnerFactory = (endpointUrl: string) => {
  const getAssetsByOwner = async (
    options: GetAssetsByOwnerOptions
  ): Promise<GetAssetsByOwnerResult> => {
    return rpcFetch<GetAssetsByOwnerResult>(
      endpointUrl,
      "getAssetsByOwner",
      {
        ownerAddress: options.ownerAddress,
        limit:        options.limit ?? 100,
        page:         options.page  ?? 1,
      }
    );
  };

  return getAssetsByOwner;
};

// ─────────────────────────────────────────────────────────────
// getAssetFactory
// ─────────────────────────────────────────────────────────────

/**
 * Creates a function that fetches full details for a single digital asset
 * by its mint address.
 *
 * Requires: Metaplex Digital Asset Standard (DAS) API add-on (FREE)
 * Enable at: https://dashboard.quicknode.com → your endpoint → Add-ons
 *
 * @param endpointUrl - Your QuickNode endpoint URL
 * @returns Function to fetch a single digital asset
 *
 * @example
 * const getAsset = getAssetFactory(
 *   "https://your-endpoint.solana-mainnet.quiknode.pro/TOKEN/"
 * );
 *
 * const asset = await getAsset("NFTMintAddressHere");
 * console.log(asset.content.metadata.name);
 * console.log(asset.ownership.owner);
 */
export const getAssetFactory = (endpointUrl: string) => {
  const getAsset = async (mintAddress: string): Promise<DigitalAsset> => {
    return rpcFetch<DigitalAsset>(
      endpointUrl,
      "getAsset",
      { id: mintAddress }
    );
  };

  return getAsset;
};
