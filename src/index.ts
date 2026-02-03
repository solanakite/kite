export { connect, createKitePlugin } from "./lib/connect";
export { SOL, TOKEN_PROGRAM, TOKEN_EXTENSIONS_PROGRAM, ASSOCIATED_TOKEN_PROGRAM } from "./lib/constants";
export type { Connection, KitePluginConfig } from "./lib/connect";
export type { ErrorWithTransaction } from "./lib/transactions";

// Factory functions for tree shaking - import only what you need
export { airdropIfRequiredFactory, getLamportBalanceFactory, watchLamportBalanceFactory } from "./lib/sol";
export {
  getMintFactory,
  getTokenAccountAddress,
  createTokenMintFactory,
  mintTokensFactory,
  transferLamportsFactory,
  transferTokensFactory,
  getTokenAccountBalanceFactory,
  checkTokenAccountIsClosedFactory,
  getTokenMetadataFactory,
  burnTokensFactory,
  closeTokenAccountFactory,
  watchTokenBalanceFactory,
  getTokenAccountsFactory,
} from "./lib/tokens";
export { getLogsFactory } from "./lib/logs";
export { getExplorerLinkFactory } from "./lib/explorer";
export {
  sendTransactionFromInstructionsFactory,
  sendTransactionFromInstructionsWithWalletAppFactory,
  signatureBytesToBase58String,
  signatureBase58StringToBytes,
} from "./lib/transactions";
export { createWalletFactory, createWalletsFactory } from "./lib/wallets";
export {
  getLatestBlockhashFactory,
  checkHealthFactory,
  getCurrentSlotFactory,
  getMinimumBalanceFactory,
  getTransactionFactory,
} from "./lib/rpc";
export { getAccountsFactoryFactory } from "./lib/accounts";
export { loadWalletFromFile, loadWalletFromEnvironment, checkAddressMatchesPrivateKey } from "./lib/keypair";
export { checkIfAddressIsPublicKey } from "./lib/crypto";
export { getPDAAndBump } from "./lib/pdas";

// Re-export RpcTransport type to fix build warning:
//   "RpcTransport" is imported from external module "@solana/kit" but never used
// This type is used in the Connection interface and connect function signatures, so it needs to be available in the generated .d.ts files
export type { RpcTransport } from "@solana/kit";
