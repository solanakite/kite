import {
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  sendAndConfirmTransactionFactory,
  KeyPairSigner,
  Address,
  RpcTransport,
} from "@solana/kit";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

import { checkIsValidURL } from "./url";
import { loadWalletFromEnvironment, loadWalletFromFile } from "./keypair";
import { KNOWN_CLUSTER_NAMES, CLUSTERS, KNOWN_CLUSTER_NAMES_STRING, ClusterConfig } from "./clusters";

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
} from "./tokens";
import { getLogsFactory } from "./logs";
import { getExplorerLinkFactory } from "./explorer";
import { airdropIfRequiredFactory, getLamportBalanceFactory } from "./sol";
import { getPDAAndBump } from "./pdas";
import { getAccountsFactoryFactory } from "./accounts";
import { signMessageFromWalletApp } from "./messages";
import { checkAddressMatchesPrivateKey } from "./keypair";

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
  },
}

// Our cluster config doesn't have everything we need, so we need to get the rest of the details from the environment
export const getClusterDetailsFromClusterConfig = (clusterName: string, clusterConfig: ClusterConfig): ClusterDetails => {
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
}

/**
 * Creates a connection to a Solana cluster with all helper functions pre-configured.
 * @param {string | ReturnType<typeof createSolanaRpcFromTransport>} [clusterNameOrURLOrRpc="localnet"] - Either:
 *                 - A cluster name, from this list:
 *                   Public clusters (note these are rate limited, you should use a commercial RPCp provider for production apps)
 *                     "mainnet", "testnet", "devnet", "localnet"
 *                   QuickNode:
 *                     "quicknode-mainnet", "quicknode-devnet", "quicknode-testnet"
 *                   Helius:
 *                     "helius-mainnet" or "helius-devnet" (Helius does not have testnet)
 *                 - An HTTP URL
 *                 - A pre-configured RPC client
 * @param {string | ReturnType<typeof createSolanaRpcSubscriptions> | null} [clusterWebSocketURLOrRpcSubscriptions=null] - Either:
 *                 - WebSocket URL for subscriptions (required if using custom HTTP URL)
 *                 - A pre-configured RPC subscriptions client
 * @returns {Connection} Connection object with all helper functions configured
 * @throws {Error} If using Helius cluster without HELIUS_API_KEY environment variable set
 * @throws {Error} If using custom HTTP URL without WebSocket URL
 * @throws {Error} If cluster name is invalid
 */
export const connect = (
  clusterNameOrURLOrRpc: string | ReturnType<typeof createSolanaRpcFromTransport<RpcTransport>> = "localnet",
  clusterWebSocketURLOrRpcSubscriptions: string | ReturnType<typeof createSolanaRpcSubscriptions> | null = null,
): Connection => {
  let rpc: ReturnType<typeof createSolanaRpcFromTransport<RpcTransport>>;
  let rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  let supportsGetPriorityFeeEstimate: boolean = false;
  let needsPriorityFees: boolean = false;
  let enableClientSideRetries: boolean = false;
  let clusterNameOrURL: string;

  // Check if first argument is an RPC client
  if (typeof clusterNameOrURLOrRpc !== "string") {
    rpc = clusterNameOrURLOrRpc;
    if (!clusterWebSocketURLOrRpcSubscriptions || typeof clusterWebSocketURLOrRpcSubscriptions === "string") {
      throw new Error("When providing an RPC client, you must also provide an RPC subscriptions client");
    }
    rpcSubscriptions = clusterWebSocketURLOrRpcSubscriptions;
    clusterNameOrURL = "custom"; // Use a default name for explorer links
  } else {
    clusterNameOrURL = clusterNameOrURLOrRpc;
    // Postel's law: be liberal in what you accept - so include 'mainnet' as well as 'mainnet-beta'
    if (clusterNameOrURL === "mainnet") {
      clusterNameOrURL = "mainnet-beta";
    }

    if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
      const clusterDetails = CLUSTERS[clusterNameOrURL];

      const { httpURL, webSocketURL, features } = getClusterDetailsFromClusterConfig(clusterNameOrURL, clusterDetails);

      const transport = createDefaultRpcTransport({
        url: httpURL,
      });

      rpc = createSolanaRpcFromTransport(transport);
      rpcSubscriptions = createSolanaRpcSubscriptions(webSocketURL);
    } else {
      if (!clusterWebSocketURLOrRpcSubscriptions || typeof clusterWebSocketURLOrRpcSubscriptions !== "string") {
        throw new Error(
          `Missing clusterWebSocketURL. Either provide a valid cluster name (${KNOWN_CLUSTER_NAMES_STRING}) or two valid URLs.`,
        );
      }
      if (checkIsValidURL(clusterNameOrURL) && checkIsValidURL(clusterWebSocketURLOrRpcSubscriptions)) {
        const transport = createDefaultRpcTransport({
          url: clusterNameOrURL,
        });

        rpc = createSolanaRpcFromTransport(transport);
        rpcSubscriptions = createSolanaRpcSubscriptions(clusterWebSocketURLOrRpcSubscriptions);
      } else {
        throw new Error(
          `Unsupported cluster name (valid options are ${KNOWN_CLUSTER_NAMES_STRING}) or URL: ${clusterNameOrURL}. `,
        );
      }
    }
  }

  // Use rpcSubscriptions as-is, do not add ~cluster property
  const typedRpcSubscriptions = rpcSubscriptions as ReturnType<typeof createSolanaRpcSubscriptions>;

  // Create the transaction confirmation functions based on the cluster name
  const sendAndConfirmTransaction = clusterNameOrURL.includes("mainnet")
    ? sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: typedRpcSubscriptions as any })
    : clusterNameOrURL.includes("testnet")
      ? sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: typedRpcSubscriptions as any })
      : sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: typedRpcSubscriptions as any });

  // Let's avoid data types like 'Promise' into the function name
  // we're not using Hungarian notation, this isn't common TS behavior, and it's not necessary to do so
  const getRecentSignatureConfirmation = clusterNameOrURL.includes("mainnet")
    ? createRecentSignatureConfirmationPromiseFactory({ rpc, rpcSubscriptions: typedRpcSubscriptions as any })
    : clusterNameOrURL.includes("testnet")
      ? createRecentSignatureConfirmationPromiseFactory({ rpc, rpcSubscriptions: typedRpcSubscriptions as any })
      : createRecentSignatureConfirmationPromiseFactory({ rpc, rpcSubscriptions: typedRpcSubscriptions as any });

  const airdropIfRequired = airdropIfRequiredFactory(rpc, typedRpcSubscriptions);

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

  const getAccountsFactory = getAccountsFactoryFactory(rpc);

  return {
    rpc,
    rpcSubscriptions,
    sendAndConfirmTransaction,
    sendTransactionFromInstructions,
    getLamportBalance: getLamportBalanceFactory(rpc),
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
    getAccountsFactory,
    signatureBytesToBase58String,
    signatureBase58StringToBytes,
    sendTransactionFromInstructionsWithWalletApp: sendTransactionFromInstructionsWithWalletAppFactory(rpc),
    signMessageFromWalletApp,
    checkAddressMatchesPrivateKey,
  };
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
   * @param {KeyPairSigner} params.feePayer - Account that will pay the transaction fees
   * @param {Array<IInstruction>} params.instructions - List of instructions to execute in sequence
   * @param {Commitment} [params.commitment="confirmed"] - Confirmation level to wait for:
   *                                                      'processed' = processed by current node,
   *                                                      'confirmed' = confirmed by supermajority of the cluster,
   *                                                      'finalized' = confirmed by supermajority and unlikely to revert
   * @param {boolean} [params.skipPreflight=true] - Skip pre-flight transaction checks to reduce latency
   * @param {number} [params.maximumClientSideRetries=0] - Number of times to retry if the transaction fails
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the transaction
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
   * @returns {Promise<KeyPairSigner>} The new wallet, ready to use
   */
  createWallet: ReturnType<typeof createWalletFactory>;

  /**
   * Creates multiple Solana wallets in parallel with identical configuration.
   * @param {number} amount - How many wallets to create
   * @param {Object} options - Same configuration options as createWallet
   * @returns {Promise<Array<KeyPairSigner>>} Array of new wallets
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
   * @param {KeyPairSigner} params.source - Account sending the SOL (must sign)
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
   * @param {KeyPairSigner} params.mintAuthority - Account that will have permission to mint tokens
   * @param {number} params.decimals - Number of decimal places (e.g. 9 decimals means 1 token = 1,000,000,000 base units)
   * @param {string} params.name - Display name of the token
   * @param {string} params.symbol - Short ticker symbol (e.g. "USDC")
   * @param {string} params.uri - URL to token metadata (image, description etc.)
   * @param {Record<string, string> | Map<string, string>} [params.additionalMetadata={}] - Extra metadata key-value pairs
   * @returns {Promise<Address>} Address of the new token mint
   */
  createTokenMint: (params: {
    mintAuthority: KeyPairSigner;
    decimals: number;
    name: string;
    symbol: string;
    uri: string;
    additionalMetadata?: Record<string, string> | Map<string, string>;
  }) => Promise<Address>;

  /**
   * Creates new tokens from a token mint.
   * @param {Address} mintAddress - The token mint to create tokens from
   * @param {KeyPairSigner} mintAuthority - Account authorized to mint new tokens (must sign)
   * @param {bigint} amount - Number of base units to mint (adjusted for decimals)
   * @param {Address} destination - Account to receive the new tokens
   * @returns {Promise<string>} Transaction signature
   */
  mintTokens: (
    mintAddress: Address,
    mintAuthority: KeyPairSigner,
    amount: bigint,
    destination: Address,
  ) => Promise<string>;

  /**
   * Transfers SPL tokens between accounts.
   * @param {Object} params - Transfer details
   * @param {KeyPairSigner} params.sender - Account sending the tokens (must sign)
   * @param {Address} params.destination - Account receiving the tokens
   * @param {Address} params.mintAddress - The type of token to transfer
   * @param {bigint} params.amount - Number of base units to transfer (adjusted for decimals)
   * @param {number} [params.maximumClientSideRetries=0] - Number of retry attempts if transfer fails
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to cancel the transfer
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
   * @returns {Promise<KeyPairSigner>} The loaded wallet
   */
  loadWalletFromFile: typeof loadWalletFromFile;

  /**
   * Loads a wallet from an environment variable containing a keypair.
   * The keypair must be in the same format as 'solana-keygen' (array of numbers).
   * @param {string} variableName - Name of environment variable storing the keypair
   * @returns {KeyPairSigner} The loaded wallet
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
   * @param {TransactionSendingSigner} params.feePayer - Account that will pay the transaction fees
   * @param {Array<IInstruction>} params.instructions - List of instructions to execute in sequence
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
}
