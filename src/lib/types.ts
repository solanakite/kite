import { sendAndConfirmTransactionFactory } from "@solana/kit";

// Type alias for transactions that can be sent via sendAndConfirmTransaction
// The type used by sendAndConfirmTransaction doesn't have an obvious name
export type SendableTransaction = Parameters<ReturnType<typeof sendAndConfirmTransactionFactory>>[0];
