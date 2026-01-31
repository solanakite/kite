export { connect, createKitePlugin } from "./lib/connect";
export { SOL, TOKEN_PROGRAM, TOKEN_EXTENSIONS_PROGRAM, ASSOCIATED_TOKEN_PROGRAM } from "./lib/constants";
export type { Connection, KitePluginConfig } from "./lib/connect";
export type { ErrorWithTransaction } from "./lib/transactions";
// Re-export RpcTransport type to fix build warning:
//   "RpcTransport" is imported from external module "@solana/kit" but never used
// This type is used in the Connection interface and connect function signatures, so it needs to be available in the generated .d.ts files
export type { RpcTransport } from "@solana/kit";
