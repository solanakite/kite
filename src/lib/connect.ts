import {
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  sendAndConfirmTransactionFactory,
  TransactionSigner,
  Address,
  type RpcTransport,
  SolanaRpcSubscriptionsApi,
  RpcSubscriptions,
} from "@solana/kit";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

import { checkIsValidURL } from "./url";
import { loadWalletFromEnvironment, loadWalletFromFile } from "./keypair";
import { KNOWN_CLUSTER_NAMES, CLUSTERS, KNOWN_CLUSTER_NAMES_STRING, ClusterConfig } from "./clusters";
import { checkIfAddressIsPublicKey } from "./crypto";

import {
  sendTransactionFromInstructionsFactory,
  sendTransactionFromInstructionsWithWalletAppFactory,
  signatureBytesToBase58String,
  signatureBase58StringToBytes,
} from "./transactions";
import { createWalletFactory, createWalletsFactory } from "./wallets";
import {
  getMintFactory,
  getTokenAccountAddress,
  createTokenMintFactory,
  mintTokensFactory,
  transferLamportsFactory,
  transferTokensFactory,
  getTokenAccountBalanceFactory,
  checkTokenAccountIsClosedFactory,
  getTokenMetadataFactory,
  updateTokenMetadataFactory,
  burnTokensFactory,
  closeTokenAccountFactory,
  getTokenAccountsFactory,
} from "./tokens";
import { getLogsFactory } from "./logs";
import { getExplorerLinkFactory } from "./explorer";
import { airdropIfRequiredFactory, getLamportBalanceFactory, watchLamportBalanceFactory } from "./sol";
import { watchTokenBalanceFactory } from "./tokens";
import { getPDAAndBump } from "./pdas";
import { getAccountsFactoryFactory } from "./accounts";
import { signMessageFromWalletApp } from "./messages";
import { checkAddressMatchesPrivateKey } from "./keypair";
import {
  getLatestBlockhashFactory,
  checkHealthFactory,
  getCurrentSlotFactory,
  getMinimumBalanceFactory,
  getTransactionFactory,
} from "./rpc";

/**
 * Converts an HTTP(S) URL to the corresponding WS(S) URL.
 * @param httpUrl - The HTTP or HTTPS URL string
 * @returns The corresponding WebSocket URL string
 */
export function getWebsocketUrlFromHTTPUrl(httpUrl: string): string {
  try {
    const url = new URL(httpUrl);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
    } else if (url.protocol === "https:") {
      url.protocol = "wss:";
    } else {
      throw new Error("URL must start with http:// or https://");
    }
    return url.toString();
  } catch (thrownObject) {
    throw new Error(`Invalid HTTP URL: ${httpUrl}`);
  }
}

export interface ClusterDetails {
  httpURL: string;
  webSocketURL: string;
  features: {
    supportsGetPriorityFeeEstimate: boolean;
    needsPriorityFees: boolean;
    enableClientSideRetries: boolean;
    isNameKnownToSolanaExplorer: boolean;
    isExplorerDefault: boolean;
  };
}

// Our cluster config doesn't have everything we need, so we need to get the rest of the details from the environment
export const getClusterDetailsFromClusterConfig = (
  clusterName: string,
  clusterConfig: ClusterConfig,
): ClusterDetails => {
  let features = clusterConfig.features;

  if (clusterConfig.httpURL && clusterConfig.webSocketURL) {
    // For RPC providers like Helius, the endpoint is constant, but we need to set the API key in an environment variable
    const requiredParamEnvironmentVariable = clusterConfig.requiredParamEnvironmentVariable;
    // Reminder: requiredParam is the URL param name like 'api-key', requiredParamEnvironmentVariable is the environment variable we're going to look to find the value, like 'HELIUS_API_KEY'
    if (clusterConfig.requiredParam && requiredParamEnvironmentVariable) {
      const requiredParamValue = process.env[requiredParamEnvironmentVariable];
      if (!requiredParamValue) {
        throw new Error(`Environment variable '${requiredParamEnvironmentVariable}' is not set.`);
      }
      // Add the URL param 'api-key' with the value of the environment variable
      const queryParams = new URLSearchParams();
      queryParams.set(clusterConfig.requiredParam, requiredParamValue);

      return {
        httpURL: `${clusterConfig.httpURL}?${queryParams}`,
        webSocketURL: `${clusterConfig.webSocketURL}?${queryParams}`,
        features,
      };
    }
    // Otherwise just use the cluster config URLs
    return {
      httpURL: clusterConfig.httpURL,
      webSocketURL: clusterConfig.webSocketURL,
      features,
    };
  }

  // For RPC providers like QuickNode, we need to get the endpoint from an environment variable
  const requiredRpcEnvironmentVariable = clusterConfig.requiredRpcEnvironmentVariable;
  if (requiredRpcEnvironmentVariable) {
    const rpcEndpoint = process.env[requiredRpcEnvironmentVariable];
    if (!rpcEndpoint) {
      throw new Error(`Environment variable '${requiredRpcEnvironmentVariable}' is not set.`);
    }
    return {
      httpURL: rpcEndpoint,
      webSocketURL: getWebsocketUrlFromHTTPUrl(rpcEndpoint),
      features,
    };
  }

  throw new Error(`Cluster ${clusterName} has null URLs but no requiredRpcEnvironmentVariable specified.`);
};

export interface KitePluginConfig {
  clusterNameOrURL?: string;
  webSocketURL?: string;
}

/**
 * Creates a Kite plugin that extends a Solana Kit RPC client with helpful utility functions.
 * This plugin adds wallet creation, token operations, transaction helpers, and more.
 *
 * @param {KitePluginConfig} [config={}] - Configuration for the plugin
 * @param {string} [config.clusterNameOrURL="localnet"] - Cluster name or HTTP URL
 * @param {string} [config.webSocketURL] - WebSocket URL for subscriptions (auto-derived if not provided)
 * @returns A plugin function that extends RPC clients with Kite functionality
 *
 * @example
 * // Use as a plugin
 * const client = createSolanaRpc(url).use(createKitePlugin({ clusterNameOrURL: 'devnet' }));
 */
export const createKitePlugin = (config: KitePluginConfig = {}) => {
  return <T extends ReturnType<typeof createSolanaRpcFromTransport<RpcTransport>>>(
    rpc: T,
  ): T & Connection => {
    const { clusterNameOrURL = "localnet", webSocketURL } = config;

    let rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
    let clusterName = clusterNameOrURL;
    let wsUrl: string;

    // Postel's law: be liberal in what you accept
    if (clusterName === "mainnet") {
      clusterName = "mainnet-beta";
    }

    // Determine WebSocket URL
    if (webSocketURL) {
      wsUrl = webSocketURL;
    } else if (KNOWN_CLUSTER_NAMES.includes(clusterName)) {
      const clusterDetails = CLUSTERS[clusterName];
      const { webSocketURL: derivedWsUrl } = getClusterDetailsFromClusterConfig(clusterName, clusterDetails);
      wsUrl = derivedWsUrl;
    } else if (checkIsValidURL(clusterName)) {
      wsUrl = getWebsocketUrlFromHTTPUrl(clusterName);
    } else {
      throw new Error(
        `Unsupported cluster name (valid options are ${KNOWN_CLUSTER_NAMES_STRING}) or URL: ${clusterName}`,
      );
    }

    rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

    const supportsGetPriorityFeeEstimate = false;
    const needsPriorityFees = false;
    const enableClientSideRetries = false;

    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any);
    const getRecentSignatureConfirmation = createRecentSignatureConfirmationPromiseFactory({ rpc, rpcSubscriptions } as any);
    const airdropIfRequired = airdropIfRequiredFactory(rpc, rpcSubscriptions);
    const createWallet = createWalletFactory(airdropIfRequired);
    const createWallets = createWalletsFactory(createWallet);
    const getLogs = getLogsFactory(rpc);

    const sendTransactionFromInstructions = sendTransactionFromInstructionsFactory(
      rpc,
      needsPriorityFees,
      supportsGetPriorityFeeEstimate,
      enableClientSideRetries,
      sendAndConfirmTransaction,
    );

    const transferLamports = transferLamportsFactory(sendTransactionFromInstructions);
    const createTokenMint = createTokenMintFactory(rpc, sendTransactionFromInstructions);
    const getMint = getMintFactory(rpc);
    const transferTokens = transferTokensFactory(getMint, sendTransactionFromInstructions);
    const mintTokens = mintTokensFactory(sendTransactionFromInstructions);
    const getTokenAccountBalance = getTokenAccountBalanceFactory(rpc);
    const checkTokenAccountIsClosed = checkTokenAccountIsClosedFactory(getTokenAccountBalance);
    const getTokenMetadata = getTokenMetadataFactory(rpc);
    const updateTokenMetadata = updateTokenMetadataFactory(rpc, sendTransactionFromInstructions);
    const burnTokens = burnTokensFactory(getMint, sendTransactionFromInstructions);
    const closeTokenAccount = closeTokenAccountFactory(sendTransactionFromInstructions);
    const getLatestBlockhash = getLatestBlockhashFactory(rpc);
    const checkHealth = checkHealthFactory(rpc);
    const getCurrentSlot = getCurrentSlotFactory(rpc);
    const getMinimumBalance = getMinimumBalanceFactory(rpc);
    const getTransaction = getTransactionFactory(rpc);
    const getAccountsFactory = getAccountsFactoryFactory(rpc);
    const getTokenAccounts = getTokenAccountsFactory(rpc);

    return {
      ...rpc,
      rpc,
      rpcSubscriptions,
      sendAndConfirmTransaction,
      sendTransactionFromInstructions,
      getLamportBalance: getLamportBalanceFactory(rpc),
      watchLamportBalance: watchLamportBalanceFactory(rpc, rpcSubscriptions),
      watchTokenBalance: watchTokenBalanceFactory(rpc, rpcSubscriptions),
      getExplorerLink: getExplorerLinkFactory(clusterName),
      airdropIfRequired,
      createWallet,
      createWallets,
      getLogs,
      getRecentSignatureConfirmation,
      transferLamports,
      transferTokens,
      createTokenMint,
      mintTokens,
      getTokenAccountAddress,
      loadWalletFromFile,
      loadWalletFromEnvironment,
      getMint,
      getTokenAccountBalance,
      getPDAAndBump,
      checkTokenAccountIsClosed,
      getTokenMetadata,
      updateTokenMetadata,
      burnTokens,
      closeTokenAccount,
      getLatestBlockhash,
      checkHealth,
      getCurrentSlot,
      getMinimumBalance,
      getTransaction,
      getAccountsFactory,
      getTokenAccounts,
      signatureBytesToBase58String,
      signatureBase58StringToBytes,
      sendTransactionFromInstructionsWithWalletApp: sendTransactionFromInstructionsWithWalletAppFactory(rpc),
      signMessageFromWalletApp,
      checkAddressMatchesPrivateKey,
      checkIfAddressIsPublicKey,
    };
  };
};

/**
 * Creates a connection to a Solana cluster with all helper functions pre-configured.
 * This is a convenience wrapper around the Kite plugin.
 *
 * @param {string | ReturnType<typeof createSolanaRpcFromTransport>} [clusterNameOrURLOrRpc="localnet"] - Either:
 *                 - A cluster name, from this list:
 *                   Public clusters (note these are rate limited, you should use a commercial RPC provider for production apps)
 *                     "mainnet", "testnet", "devnet", "localnet"
 *                   QuickNode:
 *                     "quicknode-mainnet", "quicknode-devnet", "quicknode-testnet"
 *                   Helius:
 *                     "helius-mainnet" or "helius-devnet" (Helius does not have testnet)
 *                   Triton:
 *                     "triton-mainnet", "triton-devnet", "triton-testnet"
 *                 - An HTTP URL
 *                 - A pre-configured RPC client
 * @param {string | ReturnType<typeof createSolanaRpcSubscriptions> | null} [clusterWebSocketURLOrRpcSubscriptions=null] - Either:
 *                 - WebSocket URL for subscriptions (required if using custom HTTP URL)
 *                 - A pre-configured RPC subscriptions client
 * @returns {Connection} Connection object with all helper functions configured
 * @throws {Error} If using QuickNode cluster without QUICKNODE_SOLANA_MAINNET_ENDPOINT or QUICKNODE_SOLANA_DEVNET_ENDPOINT or QUICKNODE_SOLANA_TESTNET_ENDPOINT environment variable set
 * @throws {Error} If using Helius cluster without HELIUS_API_KEY environment variable set
 * @throws {Error} If using Triton cluster without TRITON_SOLANA_MAINNET_ENDPOINT or TRITON_SOLANA_DEVNET_ENDPOINT or TRITON_SOLANA_TESTNET_ENDPOINT environment variable set
 * @throws {Error} If using custom HTTP URL without WebSocket URL
 * @throws {Error} If cluster name is invalid
 */
export const connect = (
  clusterNameOrURLOrRpc: string | ReturnType<typeof createSolanaRpcFromTransport<RpcTransport>> = "localnet",
  clusterWebSocketURLOrRpcSubscriptions: string | ReturnType<typeof createSolanaRpcSubscriptions> | null = null,
): Connection => {
  let rpc: ReturnType<typeof createSolanaRpcFromTransport<RpcTransport>>;
  let clusterNameOrURL: string;
  let webSocketURL: string | undefined;

  // Check if first argument is an RPC client
  if (typeof clusterNameOrURLOrRpc !== "string") {
    rpc = clusterNameOrURLOrRpc;
    if (!clusterWebSocketURLOrRpcSubscriptions || typeof clusterWebSocketURLOrRpcSubscriptions === "string") {
      throw new Error("When providing an RPC client, you must also provide an RPC subscriptions client");
    }
    // When a pre-configured RPC client is provided, we need to handle subscriptions differently
    // For now, we'll use "custom" as the cluster name
    clusterNameOrURL = "custom";
    // We can't easily use the plugin pattern here since we have a pre-configured RPC subscriptions client
    // Fall back to the original direct implementation for this case
    const rpcSubscriptions = clusterWebSocketURLOrRpcSubscriptions;
    const supportsGetPriorityFeeEstimate = false;
    const needsPriorityFees = false;
    const enableClientSideRetries = false;

    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any);
    const getRecentSignatureConfirmation = createRecentSignatureConfirmationPromiseFactory({ rpc, rpcSubscriptions } as any);
    const airdropIfRequired = airdropIfRequiredFactory(rpc, rpcSubscriptions);
    const createWallet = createWalletFactory(airdropIfRequired);
    const createWallets = createWalletsFactory(createWallet);
    const getLogs = getLogsFactory(rpc);

    const sendTransactionFromInstructions = sendTransactionFromInstructionsFactory(
      rpc,
      needsPriorityFees,
      supportsGetPriorityFeeEstimate,
      enableClientSideRetries,
      sendAndConfirmTransaction,
    );

    const transferLamports = transferLamportsFactory(sendTransactionFromInstructions);
    const createTokenMint = createTokenMintFactory(rpc, sendTransactionFromInstructions);
    const getMint = getMintFactory(rpc);
    const transferTokens = transferTokensFactory(getMint, sendTransactionFromInstructions);
    const mintTokens = mintTokensFactory(sendTransactionFromInstructions);
    const getTokenAccountBalance = getTokenAccountBalanceFactory(rpc);
    const checkTokenAccountIsClosed = checkTokenAccountIsClosedFactory(getTokenAccountBalance);
    const getTokenMetadata = getTokenMetadataFactory(rpc);
    const updateTokenMetadata = updateTokenMetadataFactory(rpc, sendTransactionFromInstructions);
    const burnTokens = burnTokensFactory(getMint, sendTransactionFromInstructions);
    const closeTokenAccount = closeTokenAccountFactory(sendTransactionFromInstructions);
    const getLatestBlockhash = getLatestBlockhashFactory(rpc);
    const checkHealth = checkHealthFactory(rpc);
    const getCurrentSlot = getCurrentSlotFactory(rpc);
    const getMinimumBalance = getMinimumBalanceFactory(rpc);
    const getTransaction = getTransactionFactory(rpc);
    const getAccountsFactory = getAccountsFactoryFactory(rpc);
    const getTokenAccounts = getTokenAccountsFactory(rpc);

    return {
      rpc,
      rpcSubscriptions,
      sendAndConfirmTransaction,
      sendTransactionFromInstructions,
      getLamportBalance: getLamportBalanceFactory(rpc),
      watchLamportBalance: watchLamportBalanceFactory(rpc, rpcSubscriptions),
      watchTokenBalance: watchTokenBalanceFactory(rpc, rpcSubscriptions),
      getExplorerLink: getExplorerLinkFactory(clusterNameOrURL),
      airdropIfRequired,
      createWallet,
      createWallets,
      getLogs,
      getRecentSignatureConfirmation,
      transferLamports,
      transferTokens,
      createTokenMint,
      mintTokens,
      getTokenAccountAddress,
      loadWalletFromFile,
      loadWalletFromEnvironment,
      getMint,
      getTokenAccountBalance,
      getPDAAndBump,
      checkTokenAccountIsClosed,
      getTokenMetadata,
      updateTokenMetadata,
      burnTokens,
      closeTokenAccount,
      getLatestBlockhash,
      checkHealth,
      getCurrentSlot,
      getMinimumBalance,
      getTransaction,
      getAccountsFactory,
      getTokenAccounts,
      signatureBytesToBase58String,
      signatureBase58StringToBytes,
      sendTransactionFromInstructionsWithWalletApp: sendTransactionFromInstructionsWithWalletAppFactory(rpc),
      signMessageFromWalletApp,
      checkAddressMatchesPrivateKey,
      checkIfAddressIsPublicKey,
    };
  }

  // String argument - create RPC client and use plugin
  clusterNameOrURL = clusterNameOrURLOrRpc;

  // Postel's law: be liberal in what you accept
  if (clusterNameOrURL === "mainnet") {
    clusterNameOrURL = "mainnet-beta";
  }

  if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
    const clusterDetails = CLUSTERS[clusterNameOrURL];
    const { httpURL, webSocketURL: wsUrl } = getClusterDetailsFromClusterConfig(clusterNameOrURL, clusterDetails);

    const transport = createDefaultRpcTransport({ url: httpURL });
    rpc = createSolanaRpcFromTransport(transport);
    webSocketURL = wsUrl;
  } else {
    if (!clusterWebSocketURLOrRpcSubscriptions || typeof clusterWebSocketURLOrRpcSubscriptions !== "string") {
      throw new Error(
        `Missing clusterWebSocketURL. Either provide a valid cluster name (${KNOWN_CLUSTER_NAMES_STRING}) or two valid URLs.`,
      );
    }
    if (checkIsValidURL(clusterNameOrURL) && checkIsValidURL(clusterWebSocketURLOrRpcSubscriptions)) {
      const transport = createDefaultRpcTransport({ url: clusterNameOrURL });
      rpc = createSolanaRpcFromTransport(transport);
      webSocketURL = clusterWebSocketURLOrRpcSubscriptions;
    } else {
      throw new Error(
        `Unsupported cluster name (valid options are ${KNOWN_CLUSTER_NAMES_STRING}) or URL: ${clusterNameOrURL}`,
      );
    }
  }

  // Use the plugin to extend the RPC client
  const plugin = createKitePlugin({ clusterNameOrURL, webSocketURL });
  return plugin(rpc);
};

export interface Connection {
  /**
   * The core RPC client for making direct Solana API calls. Use this when you need
   * access to raw Solana JSON RPC methods not covered by helper functions.
   */
  rpc: ReturnType<typeof createSolanaRpcFromTransport<RpcTransport>>;

  /**
   * The WebSocket client for real-time Solana event subscriptions like new blocks,
   * program logs, account changes etc.
   */
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;

  /**
   * Submits a transaction and waits for it to be confirmed on the network.
   * @param {VersionedTransaction} transaction - The complete signed transaction to submit
   * @param {Object} [options] - Optional configuration
   * @param {Commitment} [options.commitment] - Confirmation level to wait for:
   *                                           'processed' = processed by current node,
   *                                           'confirmed' = confirmed by supermajority of the cluster,
   *                                           'finalized' = confirmed by supermajority and unlikely to revert
   * @param {boolean} [options.skipPreflight] - Skip pre-flight transaction checks to reduce latency
   * @returns {Promise<void>}
   */
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>;

  /**
   * Builds, signs and sends a transaction containing multiple instructions.
   * @param {Object} params - Transaction parameters
   * @param {TransactionSigner} params.feePayer - Account that will pay the transaction fees
   * @param {Array<Instruction>} params.instructions - List of instructions to execute in sequence
   * @param {Commitment} [params.commitment="confirmed"] - Confirmation level to wait for:
   *                                                      'processed' = processed by current node,
   *                                                      'confirmed' = confirmed by supermajority of the cluster,
   *                                                      'finalized' = confirmed by supermajority and unlikely to revert
   * @param {boolean} [params.skipPreflight=true] - Skip pre-flight transaction checks to reduce latency
   * @param {number} [params.maximumClientSideRetries=0] - Number of times to retry if the transaction fails
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the transaction
   * @param {number} [params.timeout=undefined] - Timeout for the transaction in milliseconds
   * @returns {Promise<string>} The transaction signature
   */
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>;

  /**
   * Gets an account's SOL balance in lamports (1 SOL = 1,000,000,000 lamports).
   * @param {string} address - The account address to check
   * @param {Commitment} commitment - Confirmation level of data:
   *                                 'processed' = maybe outdated but fast,
   *                                 'confirmed' = confirmed by supermajority,
   *                                 'finalized' = definitely permanent but slower
   * @returns {Promise<Lamports>} The balance in lamports
   */
  getLamportBalance: ReturnType<typeof getLamportBalanceFactory>;

  /**
   * Watches for changes to a Solana account's lamport balance.
   * @param {Address} address - The Solana address to watch
   * @param {(error: Error | null, balance: Lamports | null) => void} callback - Called with (error, balance) on each balance change
   * @returns {() => void} Cleanup function to stop watching
   */
  watchLamportBalance: ReturnType<typeof watchLamportBalanceFactory>;

  /**
   * Watches for changes to a token balance.
   * @param {Address} ownerAddress - The wallet address that owns the tokens
   * @param {Address} mintAddress - The token mint address
   * @param {(error: Error | null, balance: object | null) => void} callback - Called with (error, balance) on each balance change
   * @returns {Promise<() => void>} Cleanup function to stop watching
   */
  watchTokenBalance: ReturnType<typeof watchTokenBalanceFactory>;

  /**
   * Creates a URL to view any Solana entity on Solana Explorer.
   * Automatically configures the URL for the current network/cluster.
   * @param {("transaction" | "tx" | "address" | "block")} linkType - What type of entity to view
   * @param {string} id - Identifier (address, signature, or block number)
   * @returns {string} A properly configured Solana Explorer URL
   */
  getExplorerLink: ReturnType<typeof getExplorerLinkFactory>;

  /**
   * Checks if a transaction has been confirmed on the network.
   * Useful for verifying that time-sensitive transactions have succeeded.
   * @param {string} signature - The unique transaction signature to verify
   * @returns {Promise<boolean>} True if the transaction is confirmed
   */
  getRecentSignatureConfirmation: ReturnType<typeof createRecentSignatureConfirmationPromiseFactory>;

  /**
   * Checks if a token account is closed or doesn't exist.
   * A token account can be specified directly or derived from a wallet and mint address.
   * @param {Object} params - Parameters for checking token account
   * @param {Address} [params.tokenAccount] - Direct token account address to check
   * @param {Address} [params.wallet] - Wallet address (required if tokenAccount not provided)
   * @param {Address} [params.mint] - Token mint address (required if tokenAccount not provided)
   * @param {boolean} [params.useTokenExtensions=false] - Use Token Extensions program instead of classic Token program
   * @returns {Promise<boolean>} True if the token account is closed or doesn't exist, false if it exists and is open
   * @throws {Error} If neither tokenAccount nor both wallet and mint are provided
   * @throws {Error} If there's an error checking the account that isn't related to the account not existing
   */
  checkTokenAccountIsClosed: ReturnType<typeof checkTokenAccountIsClosedFactory>;

  /**
   * Gets token metadata using the metadata pointer extension.
   * @param {Address} mintAddress - The token mint address
   * @param {Commitment} [commitment="confirmed"] - Confirmation level to wait for
   * @returns {Promise<Object>} The token metadata including name, symbol, uri, and additional metadata
   */
  getTokenMetadata: ReturnType<typeof getTokenMetadataFactory>;

  /**
   * Updates Token-2022 metadata fields.
   * @param {Object} params - Parameters for updating metadata
   * @param {Address} params.mintAddress - The token mint address
   * @param {TransactionSigner} params.updateAuthority - The update authority signer
   * @param {string} [params.name] - New token name
   * @param {string} [params.symbol] - New token symbol
   * @param {string} [params.uri] - New metadata URI
   * @param {Record<string, string>} [params.additionalMetadata] - Additional metadata key-value pairs
   * @param {Commitment} [params.commitment="confirmed"] - Confirmation level to wait for
   * @returns {Promise<string>} Transaction signature
   */
  updateTokenMetadata: ReturnType<typeof updateTokenMetadataFactory>;

  /**
   * Requests free test SOL from a faucet if an account's balance is too low.
   * Only works on test networks (devnet/testnet).
   * @param {Address} address - The account that needs SOL
   * @param {Lamports} airdropAmount - How much SOL to request (in lamports)
   * @param {Lamports} minimumBalance - Only request SOL if balance is below this amount
   * @param {Commitment} commitment - Confirmation level to wait for:
   *                                 'processed' = processed by current node,
   *                                 'confirmed' = confirmed by supermajority of the cluster,
   *                                 'finalized' = confirmed by supermajority and unlikely to revert
   * @returns {Promise<string | null>} Transaction signature if SOL was airdropped, null if no airdrop was needed
   */
  airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>;

  /**
   * Creates a new Solana wallet with optional vanity address and automatic funding.
   * @param {Object} [options={}] - Configuration options
   * @param {string | null} [options.prefix] - Generate address starting with these characters
   * @param {string | null} [options.suffix] - Generate address ending with these characters
   * @param {string | null} [options.envFileName] - Save private key to this .env file
   * @param {string} [options.envVariableName] - Environment variable name to store the key
   * @param {Lamports | null} [options.airdropAmount] - Amount of test SOL to request from faucet
   * @returns {Promise<TransactionSigner>} The new wallet, ready to use
   */
  createWallet: ReturnType<typeof createWalletFactory>;

  /**
   * Creates multiple Solana wallets in parallel with identical configuration.
   * @param {number} amount - How many wallets to create
   * @param {Object} options - Same configuration options as createWallet
   * @returns {Promise<Array<TransactionSigner>>} Array of new wallets
   */
  createWallets: ReturnType<typeof createWalletsFactory>;

  /**
   * Retrieves the program output messages from a transaction.
   * Useful for debugging failed transactions or understanding program behavior.
   * @param {string} signature - Transaction signature to analyze
   * @returns {Promise<readonly Array<string>>} Program log messages in order of execution
   */
  getLogs: ReturnType<typeof getLogsFactory>;

  /**
   * Transfers SOL from one account to another.
   * @param {Object} params - Transfer details
   * @param {TransactionSigner} params.source - Account sending the SOL (must sign)
   * @param {Address} params.destination - Account receiving the SOL
   * @param {Lamports} params.amount - Amount of SOL to send (in lamports)
   * @param {boolean} [params.skipPreflight=true] - Skip pre-flight checks to reduce latency
   * @param {number} [params.maximumClientSideRetries=0] - Number of retry attempts if transfer fails
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the transfer
   * @returns {Promise<string>} Transaction signature
   */
  transferLamports: ReturnType<typeof transferLamportsFactory>;

  /**
   * Creates a new SPL token with metadata and minting controls.
   * @param {Object} params - Token configuration
   * @param {TransactionSigner} params.mintAuthority - Account that will have permission to mint tokens
   * @param {number} params.decimals - Number of decimal places (e.g. 9 decimals means 1 token = 1,000,000,000 base units)
   * @param {string} params.name - Display name of the token
   * @param {string} params.symbol - Short ticker symbol (e.g. "USDC")
   * @param {string} params.uri - URL to token metadata (image, description etc.)
   * @param {Record<string, string> | Map<string, string>} [params.additionalMetadata={}] - Extra metadata key-value pairs
   * @returns {Promise<Address>} Address of the new token mint
   */
  createTokenMint: (params: {
    mintAuthority: TransactionSigner;
    decimals: number;
    name?: string;
    symbol?: string;
    uri?: string;
    additionalMetadata?: Record<string, string> | Map<string, string>;
    useTokenExtensions?: boolean;
  }) => Promise<Address>;

  /**
   * Creates new tokens from a token mint.
   * @param {Address} mintAddress - The token mint to create tokens from
   * @param {TransactionSigner} mintAuthority - Account authorized to mint new tokens (must sign)
   * @param {bigint} amount - Number of base units to mint (adjusted for decimals)
   * @param {Address} destination - Account to receive the new tokens
   * @param {boolean} [useTokenExtensions=true] - Use Token Extensions program instead of classic Token program
   * @returns {Promise<string>} Transaction signature
   */
  mintTokens: (
    mintAddress: Address,
    mintAuthority: TransactionSigner,
    amount: bigint,
    destination: Address,
    useTokenExtensions?: boolean,
  ) => Promise<string>;

  /**
   * Transfers SPL tokens between accounts.
   * @param {Object} params - Transfer details
   * @param {TransactionSigner} params.sender - Account sending the tokens (must sign)
   * @param {Address} params.destination - Account receiving the tokens
   * @param {Address} params.mintAddress - The type of token to transfer
   * @param {bigint} params.amount - Number of base units to transfer (adjusted for decimals)
   * @param {number} [params.maximumClientSideRetries=0] - Number of retry attempts if transfer fails
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the transfer
   * @param {boolean} [params.useTokenExtensions=true] - Use Token Extensions program instead of classic Token program
   * @returns {Promise<string>} Transaction signature
   */
  transferTokens: ReturnType<typeof transferTokensFactory>;

  /**
   * Retrieves information about a token mint including supply and decimals.
   * @param {Address} mintAddress - Address of the token mint to query
   * @param {Commitment} [commitment="confirmed"] - Confirmation level of data:
   *                                               'processed' = maybe outdated but fast,
   *                                               'confirmed' = confirmed by supermajority,
   *                                               'finalized' = definitely permanent but slower
   * @returns {Promise<Mint | null>} Token information if found, null if not
   */
  getMint: ReturnType<typeof getMintFactory>;

  /**
   * Gets the token balance for a specific account. You can either provide a token account address directly, or provide a wallet address and a mint address to derive the token account address.
   * @param {Object} params - Parameters for getting token balance
   * @param {Address} [params.tokenAccount] - Direct token account address to check balance for
   * @param {Address} [params.wallet] - Wallet address (required if tokenAccount not provided)
   * @param {Address} [params.mint] - Token mint address (required if tokenAccount not provided)
   * @param {boolean} [params.useTokenExtensions=false] - Use Token Extensions program instead of classic Token program
   * @returns {Promise<{amount: BigInt, decimals: number, uiAmount: number | null, uiAmountString: string}>} Balance information including amount and decimals
   * @throws {Error} If neither tokenAccount nor both wallet and mint are provided
   */
  getTokenAccountBalance: (params: {
    tokenAccount?: Address;
    wallet?: Address;
    mint?: Address;
    useTokenExtensions?: boolean;
  }) => Promise<{
    amount: BigInt;
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  }>;

  /**
   * Gets the address where a wallet's tokens are stored.
   * Each wallet has a unique storage address for each type of token.
   * @param {Address} wallet - The wallet that owns the tokens
   * @param {Address} mint - The type of token
   * @param {boolean} [useTokenExtensions=false] - Use Token Extensions program instead of classic Token program
   * @returns {Promise<Address>} The token account address
   */
  getTokenAccountAddress: typeof getTokenAccountAddress;

  /**
   * Loads a wallet from a file containing a keypair.
   * Compatible with keypair files generated by 'solana-keygen'.
   * @param {string} [filepath] - Location of the keypair file (defaults to ~/.config/solana/id.json)
   * @returns {Promise<TransactionSigner>} The loaded wallet
   */
  loadWalletFromFile: typeof loadWalletFromFile;

  /**
   * Loads a wallet from an environment variable containing a keypair.
   * The keypair must be in the same format as 'solana-keygen' (array of numbers).
   * @param {string} variableName - Name of environment variable storing the keypair
   * @returns {TransactionSigner} The loaded wallet
   */
  loadWalletFromEnvironment: typeof loadWalletFromEnvironment;

  /**
   * Derives a Program Derived Address (PDA) and its bump seed.
   * PDAs are deterministic addresses that programs can sign for.
   * @param {Address} programAddress - The program that will control this PDA
   * @param {Array<String | Address | BigInt>} seeds - Values used to derive the PDA
   * @returns {Promise<{pda: Address, bump: number}>} The derived address and bump seed
   */
  getPDAAndBump: typeof getPDAAndBump;

  /**
   * Creates a factory function for getting program accounts with a specific discriminator.
   */
  getAccountsFactory: ReturnType<typeof getAccountsFactoryFactory>;

  /**
   * Gets all token accounts owned by a wallet address.
   * Queries both the classic SPL Token program and Token Extensions program.
   * @param {Address} walletAddress - The wallet address to get token accounts for
   * @param {boolean} [excludeZeroBalance=false] - If true, only returns accounts with balance > 0
   * @returns {Promise<Array>} All token accounts from both programs
   */
  getTokenAccounts: ReturnType<typeof getTokenAccountsFactory>;

  /**
   * Converts signature bytes to a base58 string.
   * @param {Uint8Array} signatureBytes - The signature bytes to convert
   * @returns {string} The base58 encoded signature string
   */
  signatureBytesToBase58String: typeof signatureBytesToBase58String;

  /**
   * Converts a base58 string to signature bytes.
   * @param {string} base58String - The base58 encoded signature string
   * @returns {Uint8Array} The signature bytes
   */
  signatureBase58StringToBytes: typeof signatureBase58StringToBytes;

  /**
   * Builds, signs and sends a transaction containing multiple instructions using a wallet app.
   * @param {Object} params - Transaction parameters
   * @param {TransactionSigner} params.feePayer - Account that will pay the transaction fees
   * @param {Array<Instruction>} params.instructions - List of instructions to execute in sequence
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the transaction
   * @returns {Promise<string>} The transaction signature
   */
  sendTransactionFromInstructionsWithWalletApp: ReturnType<typeof sendTransactionFromInstructionsWithWalletAppFactory>;

  /**
   * Signs a message using a wallet app.
   * @param {string} message - The message to sign
   * @param {MessageModifyingSigner} messageSigner - The signer that will sign the message
   * @returns {Promise<string>} The base58 encoded signature
   */
  signMessageFromWalletApp: typeof signMessageFromWalletApp;

  /**
   * Verifies if a given private key corresponds to a specific Solana address.
   * This is useful for validating that a private key matches an expected address
   * without exposing the private key in the process.
   *
   * @param {Address} address - The Solana address to verify against
   * @param {Uint8Array} privateKey - The raw private key bytes to check
   * @returns {Promise<boolean>} True if the private key corresponds to the address, false otherwise
   */
  checkAddressMatchesPrivateKey: typeof checkAddressMatchesPrivateKey;

  /**
   * Checks if a given address is a valid Ed25519 public key.
   * This verifies that the address represents a valid public key point on the Ed25519 curve,
   * as opposed to a Program Derived Address (PDA).
   *
   * @param {Uint8Array | string | Address} address - The address to check, either as bytes, base58 string, or Address type
   * @returns {Promise<boolean>} True if the address is a valid Ed25519 public key, false otherwise
   */
  checkIfAddressIsPublicKey: typeof checkIfAddressIsPublicKey;

  /**
   * Burns (permanently destroys) tokens from an account.
   * @param {Object} params - Burn parameters
   * @param {Address} params.mintAddress - The token mint address
   * @param {KeyPairSigner} params.owner - The owner of the tokens to burn
   * @param {bigint} params.amount - Number of base units to burn (adjusted for decimals)
   * @param {boolean} [params.useTokenExtensions=true] - Use Token Extensions program instead of classic Token program
   * @param {boolean} [params.skipPreflight=true] - Skip pre-flight checks
   * @param {number} [params.maximumClientSideRetries=0] - Number of retry attempts
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the operation
   * @returns {Promise<string>} Transaction signature
   */
  burnTokens: ReturnType<typeof burnTokensFactory>;

  /**
   * Closes a token account and reclaims rent.
   * The account must have a zero balance before it can be closed.
   * @param {Object} params - Close account parameters
   * @param {KeyPairSigner} params.owner - The owner of the token account
   * @param {Address} [params.tokenAccount] - Direct token account address to close
   * @param {Address} [params.wallet] - Wallet address (required if tokenAccount not provided)
   * @param {Address} [params.mint] - Token mint address (required if tokenAccount not provided)
   * @param {Address} [params.destination] - Where to send reclaimed rent (defaults to owner)
   * @param {boolean} [params.useTokenExtensions=true] - Use Token Extensions program instead of classic Token program
   * @param {boolean} [params.skipPreflight=true] - Skip pre-flight checks
   * @param {number} [params.maximumClientSideRetries=0] - Number of retry attempts
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the operation
   * @returns {Promise<string>} Transaction signature
   */
  closeTokenAccount: ReturnType<typeof closeTokenAccountFactory>;

  /**
   * Gets the latest blockhash from the network.
   * @param {Commitment} [commitment="finalized"] - Confirmation level to use
   * @returns {Promise<Object>} Object containing blockhash, lastValidBlockHeight, and context
   */
  getLatestBlockhash: ReturnType<typeof getLatestBlockhashFactory>;

  /**
   * Checks the health status of the cluster node.
   * @returns {Promise<boolean>} true if the node is healthy, false otherwise
   */
  checkHealth: ReturnType<typeof checkHealthFactory>;

  /**
   * Gets the current slot the node is processing.
   * @param {Commitment} [commitment="finalized"] - Confirmation level to use
   * @returns {Promise<bigint>} The current slot number
   */
  getCurrentSlot: ReturnType<typeof getCurrentSlotFactory>;

  /**
   * Calculates the minimum balance required for rent exemption for a given data size.
   * @param {bigint} dataLength - The size of the account data in bytes
   * @returns {Promise<Lamports>} The minimum balance in lamports needed for rent exemption
   */
  getMinimumBalance: ReturnType<typeof getMinimumBalanceFactory>;

  /**
   * Gets transaction details by signature.
   * @param {string} signature - The transaction signature to look up
   * @param {Commitment} [commitment="finalized"] - Confirmation level to use
   * @param {number} [maxSupportedTransactionVersion=0] - Maximum transaction version to return
   * @returns {Promise<Object | null>} Transaction details or null if not found
   */
  getTransaction: ReturnType<typeof getTransactionFactory>;
}
