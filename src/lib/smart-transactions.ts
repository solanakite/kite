// Based on smart-transaction.ts from https://github.com/mcintyre94/helius-smart-transactions-web3js2

import {
  Instruction,
  appendTransactionMessageInstruction,
  TransactionMessage,
  isWritableRole,
  isInstructionWithData,
  CompilableTransactionMessage,
  createSolanaRpcFromTransport,
  sendAndConfirmTransactionFactory,
  TransactionWithBlockhashLifetime,
  FullySignedTransaction,
  Commitment,
  SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED,
  isSolanaError,
} from "@solana/kit";
import {
  getSetComputeUnitPriceInstruction,
  identifyComputeBudgetInstruction,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
  ComputeBudgetInstruction,
  estimateComputeUnitLimitFactory,
} from "@solana-program/compute-budget";
import { getAbortablePromise } from "@solana/promises";
import { DEFAULT_TRANSACTION_RETRIES, DEFAULT_TRANSACTION_TIMEOUT, SECONDS } from "./constants";

export const getPriorityFeeEstimate = async (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  supportsGetPriorityFeeEstimate: boolean,
  transactionMessage: TransactionMessage,
  abortSignal: AbortSignal | null = null,
): Promise<number> => {
  const accountKeys = [
    ...new Set([
      ...transactionMessage.instructions.flatMap((instruction: Instruction) =>
        (instruction.accounts ?? [])
          .filter((account) => isWritableRole(account.role))
          .map((account) => account.address),
      ),
    ]),
  ];

  // If the RPC doesn't support getPriorityFeeEstimate, use the median of the recent fees
  if (!supportsGetPriorityFeeEstimate) {
    const recentFeesResponse = await rpc.getRecentPrioritizationFees([...accountKeys]).send({ abortSignal });
    // @ts-expect-error TODO: typing error from original helius-smart-transactions-web3js2. Fix this.
    const recentFeesValues = recentFeesResponse.reduce((accumulator, current) => {
      if (current.prioritizationFee > 0n) {
        return [...accumulator, current.prioritizationFee];
      } else {
        return accumulator;
      }
    }, []);

    // Return the median fee
    // @ts-expect-error TODO: typing error from original helius-smart-transactions-web3js2. Fix this.
    recentFeesValues.sort((a, b) => Number(a - b));
    return Number(recentFeesValues[Math.floor(recentFeesValues.length / 2)]);
  }
  // Get a priority fee estimate, using Helius' `getPriorityFeeEstimate` method on Helius mainnet

  const { priorityFeeEstimate } = await rpc
    .getPriorityFeeEstimate({
      accountKeys,
      options: {
        // See https://docs.helius.dev/solana-apis/priority-fee-api
        // Per Evan at Helius 20250213: recommended: true is not longer preferred,
        // instead use priorityLevel: "High"
        priorityLevel: "High",
      },
    })
    .send({ abortSignal });

  return priorityFeeEstimate;
};

export const getComputeUnitEstimate = async (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  transactionMessage: CompilableTransactionMessage,
  abortSignal: AbortSignal | null = null,
) => {
  // add placeholder instruction for CU price if not already present
  // web3js estimate will add CU limit but not price
  // both take CUs, so we need both in the simulation
  const hasExistingComputeBudgetPriceInstruction = transactionMessage.instructions.some(
    (instruction) =>
      instruction.programAddress === COMPUTE_BUDGET_PROGRAM_ADDRESS &&
      isInstructionWithData(instruction) &&
      identifyComputeBudgetInstruction(instruction) === ComputeBudgetInstruction.SetComputeUnitPrice,
  );

  const transactionMessageToSimulate = hasExistingComputeBudgetPriceInstruction
    ? transactionMessage
    : appendTransactionMessageInstruction(getSetComputeUnitPriceInstruction({ microLamports: 0n }), transactionMessage);

  const computeUnitEstimateFn = estimateComputeUnitLimitFactory({ rpc });
  // TODO: computeUnitEstimateFn expects an explicit 'undefined' for abortSignal,
  // fix upstream
  return computeUnitEstimateFn(transactionMessageToSimulate, {
    abortSignal: abortSignal ?? undefined,
  });
};

export const sendTransactionWithRetries = async (
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>,
  transaction: FullySignedTransaction & TransactionWithBlockhashLifetime,
  options: {
    maximumClientSideRetries: number;
    abortSignal: AbortSignal | null;
    commitment: Commitment;
    timeout?: number;
  } = {
    maximumClientSideRetries: DEFAULT_TRANSACTION_RETRIES,
    abortSignal: null,
    commitment: "confirmed",
    timeout: undefined,
  },
) => {
  if (options.commitment === "finalized") {
    console.warn(
      "Using finalized commitment for transaction with retries is not recommended. This will likely result in blockhash expiration.",
    );
  }

  let retriesLeft = options.maximumClientSideRetries;

  const transactionOptions = {
    // TODO: web3.js wants explicit undefineds. Fix upstream.
    abortSignal: options.abortSignal || undefined,
    commitment: options.commitment,
    // This is the server-side retries and should always be 0.
    // We will do retries here on the client.
    // See https://docs.helius.dev/solana-rpc-nodes/sending-transactions-on-solana#sending-transactions-without-the-sdk
    maxRetries: 0n,
  };

  let timeout: number;
  if (options.timeout) {
    timeout = options.timeout;
  } else {
    switch (options.commitment) {
      case "processed":
        timeout = 5 * SECONDS;
        break;
      case "confirmed":
        timeout = 15 * SECONDS;
        break;
      case "finalized":
        timeout = 30 * SECONDS;
        break;
      default:
        timeout = DEFAULT_TRANSACTION_TIMEOUT;
        break;
    }
  }

  while (retriesLeft) {
    try {
      const txPromise = sendAndConfirmTransaction(transaction, transactionOptions);
      await getAbortablePromise(txPromise, AbortSignal.timeout(timeout));
      break;
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        // timeout error happens if the transaction is not confirmed in DEFAULT_TRANSACTION_TIMEOUT
        // we can retry until we run out of retries
        console.debug("Transaction not confirmed, retrying...");
      } else if (isSolanaError(error, SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED)) {
        // race condition where the transaction is processed between throwing the
        // `TimeoutError` and our next retry
        break;
      } else {
        throw error;
      }
    } finally {
      retriesLeft--;
    }
  }
};
