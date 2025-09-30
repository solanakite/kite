import {
  appendTransactionMessageInstructions,
  assertIsTransactionMessageWithSingleSendingSigner,
  Commitment,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  getBase58Decoder,
  getBase58Encoder,
  getSignatureFromTransaction,
  IInstruction,
  KeyPairSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  signTransactionMessageWithSigners,
  TransactionSendingSigner,
} from "@solana/kit";
import { getComputeUnitEstimate, getPriorityFeeEstimate, sendTransactionWithRetries } from "./smart-transactions";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { DEFAULT_TRANSACTION_RETRIES } from "./constants";
import { getErrorMessageFromLogs } from "./logs";

export interface ErrorWithTransaction extends Error {
  // We add this ourselves, so users can see logs etc
  transaction: Awaited<ReturnType<ReturnType<typeof createSolanaRpcFromTransport>["getTransaction"]>>;
  // This is added by @solana/kit
  context: {
    __code: number;
    code: number;
    index: number;
  };
}

export const signatureBytesToBase58String = (signatureBytes: Uint8Array): string => {
  return getBase58Decoder().decode(signatureBytes);
};

export const signatureBase58StringToBytes = (base58String: string): Uint8Array => {
  return new Uint8Array(getBase58Encoder().encode(base58String));
};

export const sendTransactionFromInstructionsWithWalletAppFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
) => {
  const sendTransactionFromInstructionsWithWalletApp = async ({
    feePayer,
    instructions,
    abortSignal = null,
  }: {
    feePayer: TransactionSendingSigner;
    instructions: Array<IInstruction>;
    abortSignal?: AbortSignal | null;
  }) => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send({ abortSignal });
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (message) => setTransactionMessageFeePayerSigner(feePayer, message),
      (message) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      (message) => appendTransactionMessageInstructions(instructions, message),
    );
    assertIsTransactionMessageWithSingleSendingSigner(transactionMessage);
    const signatureBytes = await signAndSendTransactionMessageWithSigners(transactionMessage);
    const signature = signatureBytesToBase58String(signatureBytes);
    return signature;
  };
  return sendTransactionFromInstructionsWithWalletApp;
};

export const sendTransactionFromInstructionsFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  needsPriorityFees: boolean,
  supportsGetPriorityFeeEstimate: boolean,
  enableClientSideRetries: boolean,
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>,
) => {
  const sendTransactionFromInstructions = async ({
    feePayer,
    instructions,
    commitment = "confirmed",
    skipPreflight = true,
    maximumClientSideRetries = enableClientSideRetries ? DEFAULT_TRANSACTION_RETRIES : 0,
    abortSignal = null,
  }: {
    feePayer: KeyPairSigner;
    instructions: Array<IInstruction>;
    commitment?: Commitment;
    skipPreflight?: boolean;
    maximumClientSideRetries?: number;
    abortSignal?: AbortSignal | null;
  }) => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send({ abortSignal });

    let transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (message) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      (message) => setTransactionMessageFeePayerSigner(feePayer, message),
      (message) => appendTransactionMessageInstructions(instructions, message),
    );

    if (needsPriorityFees) {
      const [priorityFeeEstimate, computeUnitEstimate] = await Promise.all([
        getPriorityFeeEstimate(rpc, supportsGetPriorityFeeEstimate, transactionMessage, abortSignal),
        getComputeUnitEstimate(rpc, transactionMessage, abortSignal),
      ]);

      const setComputeUnitPriceInstruction = getSetComputeUnitPriceInstruction({
        microLamports: BigInt(priorityFeeEstimate),
      });

      const setComputeUnitLimitInstruction = getSetComputeUnitLimitInstruction({
        units: Math.ceil(computeUnitEstimate * 1.1),
      });

      transactionMessage = appendTransactionMessageInstructions(
        [setComputeUnitPriceInstruction, setComputeUnitLimitInstruction],
        transactionMessage,
      );
    }

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

    const signature = getSignatureFromTransaction(signedTransaction);

    try {
      if (maximumClientSideRetries) {
        await sendTransactionWithRetries(sendAndConfirmTransaction, signedTransaction, {
          maximumClientSideRetries,
          abortSignal,
          commitment,
        });
      } else {
        await sendAndConfirmTransaction(signedTransaction, {
          commitment,
          skipPreflight,
        });
      }
    } catch (thrownObject) {
      const error = thrownObject as ErrorWithTransaction;

      const transaction = await rpc
        .getTransaction(signature, {
          commitment,
          maxSupportedTransactionVersion: 0,
        })
        .send();

      error.transaction = transaction;

      // If we have a custom program error, try to find a better error message in the logs
      // TODO: honestly this should be fixed upstream in @solana/kit
      if (error.message.includes("custom program error") && transaction.meta?.logMessages) {
        const betterMessage = getErrorMessageFromLogs(transaction.meta.logMessages);
        if (betterMessage) {
          error.message = betterMessage;
        }
      }

      throw error;
    }

    return signature;
  };
  return sendTransactionFromInstructions;
};
