import { Commitment, createSolanaRpcFromTransport, Lamports } from "@solana/kit";

export const getLatestBlockhashFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Gets the latest blockhash from the network.
   * @param {Commitment} [commitment="finalized"] - Confirmation level to use
   * @returns {Promise<Object>} Object containing blockhash, lastValidBlockHeight, and context
   */
  const getLatestBlockhash = async (commitment: Commitment = "finalized") => {
    const result = await rpc.getLatestBlockhash({ commitment }).send();
    return result;
  };

  return getLatestBlockhash;
};

export const checkHealthFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Checks the health status of the cluster node.
   * @returns {Promise<boolean>} true if the node is healthy, false otherwise
   */
  const checkHealth = async () => {
    try {
      const health = await rpc.getHealth().send();
      return health === "ok";
    } catch (error) {
      return false;
    }
  };

  return checkHealth;
};

export const getCurrentSlotFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Gets the current slot the node is processing.
   * @param {Commitment} [commitment="finalized"] - Confirmation level to use
   * @returns {Promise<bigint>} The current slot number
   */
  const getCurrentSlot = async (commitment: Commitment = "finalized") => {
    const slot = await rpc.getSlot({ commitment }).send();
    return slot;
  };

  return getCurrentSlot;
};

export const getMinimumBalanceFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Calculates the minimum balance required for rent exemption for a given data size.
   * @param {bigint} dataLength - The size of the account data in bytes
   * @returns {Promise<Lamports>} The minimum balance in lamports needed for rent exemption
   */
  const getMinimumBalance = async (dataLength: bigint) => {
    const rent = await rpc.getMinimumBalanceForRentExemption(dataLength).send();
    return rent;
  };

  return getMinimumBalance;
};

export const getTransactionFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Gets transaction details by signature.
   * @param {string} signature - The transaction signature to look up
   * @param {Commitment} [commitment="finalized"] - Confirmation level to use
   * @param {number} [maxSupportedTransactionVersion=0] - Maximum transaction version to return
   * @returns {Promise<Object | null>} Transaction details or null if not found
   */
  const getTransaction = async (
    signature: string,
    commitment: Commitment = "finalized",
    maxSupportedTransactionVersion: number = 0,
  ) => {
    const transaction = await rpc
      .getTransaction(signature, {
        commitment,
        maxSupportedTransactionVersion,
      })
      .send();
    return transaction;
  };

  return getTransaction;
};
