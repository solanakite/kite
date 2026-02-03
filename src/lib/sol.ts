import {
  Address,
  createSolanaRpcSubscriptions,
  Lamports,
  Commitment,
  createSolanaRpcFromTransport,
  airdropFactory,
} from "@solana/kit";
import { Connection } from "./connect";

// In JS it's possible to throw *anything*. A sensible programmer
// will only throw Errors but we must still check to satisfy
// TypeScript (and flag any craziness)
const ensureError = (thrownObject: unknown): Error => {
  if (thrownObject instanceof Error) {
    return thrownObject;
  }
  return new Error(`Non-Error thrown: ${String(thrownObject)}`);
};

export const getLamportBalanceFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getLamportBalance = async (address: string, commitment: Commitment = "finalized"): Promise<Lamports> => {
    const getLamportBalanceResponse = await rpc.getBalance(address, { commitment }).send();
    return getLamportBalanceResponse.value;
  };
  return getLamportBalance;
};

export const airdropIfRequiredFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>,
) => {
  const getLamportBalance = getLamportBalanceFactory(rpc);
  // Plain 'airdrop' is not exported as we don't want to encourage people to
  // request airdrops when they don't need them, ie - don't bother
  // the faucet unless you really need to!
  //
  // Note rpc.requestAirdrop is broken, the commitment parameter doesn't do anything
  // despite the docs repeatedly referring to rpc.requestAirdrop
  // See https://github.com/solana-labs/solana-web3.js/issues/3683
  //
  // @ts-expect-error TODO need to work out devnet/mainnet typing issue re: airdrops
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  const airdropIfRequired = async (
    address: Address,
    airdropAmount: Lamports,
    minimumBalance: Lamports,
    commitment: Commitment | null = null,
  ): Promise<string | null> => {
    // We reuse this for no minimum balance, or when the balance is less than the minimum balance
    const doAirDrop = async () => {
      try {
        const signature = await airdrop({
          // We're being conservative here, using the 'finalized' commitment
          // level because we want to ensure the SOL is always available
          // when the function returns and users try and spend it.
          commitment: commitment || "finalized",
          recipientAddress: address,
          lamports: airdropAmount,
        });
        return signature;
      } catch (thrownObject) {
        const error = thrownObject as Error;
        if (error.message.includes("Too Many Requests")) {
          throw new Error(`You have requested too many airdrops for ${address}. See https://solanakite.org/docs/sol/airdrop-if-required for help.`);
        }
        throw error;
      };
    };

    if (airdropAmount < 0n) {
      throw new Error(`Airdrop amount must be a positive number, not ${airdropAmount}`);
    }
    if (minimumBalance === 0n) {
      return doAirDrop();
    }
    const balance = await getLamportBalance(address, commitment || "finalized");

    if (balance >= minimumBalance) {
      return null;
    }
    return doAirDrop();
  };
  return airdropIfRequired;
};

/**
 * Creates a function to watch for changes to a Solana account's lamport balance.
 * @param rpc - The Solana RPC client for making API calls
 * @param rpcSubscriptions - The WebSocket client for real-time subscriptions
 * @returns Function to watch balance changes
 */
export const watchLamportBalanceFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>
) => {
  const watchLamportBalance = (
    address: Address,
    callback: (error: Error | null, balance: Lamports | null) => void
  ) => {
    const abortController = new AbortController();
    // Keep track of the slot of the last-published update.
    let lastUpdateSlot = -1n;

    const fetchInitialBalance = async () => {
      try {
        const { context: { slot }, value: lamports } = await rpc
          .getBalance(address, { commitment: "confirmed" })
          .send({ abortSignal: abortController.signal });

        if (slot < lastUpdateSlot) {
          // The last-published update (ie. from the subscription) is newer than this one.
          return;
        }
        lastUpdateSlot = slot;
        callback(null /* error */, lamports /* balance */);
      } catch (thrownObject) {
        const error = ensureError(thrownObject);
        if (error.name !== 'AbortError') {
          callback(error, null);
        }
      }
    };

    const subscribeToUpdates = async () => {
      try {
        const accountInfoNotifications = await rpcSubscriptions
          .accountNotifications(address)
          .subscribe({ abortSignal: abortController.signal });

        try {
          for await (const {
            context: { slot },
            value: { lamports },
          } of accountInfoNotifications) {
            if (slot < lastUpdateSlot) {
              // The last-published update (ie. from the initial fetch) is newer than this one.
              continue;
            }
            lastUpdateSlot = slot;
            callback(null /* error */, lamports /* balance */);
          }
        } catch (thrownObject) {
          // Don't call callback on abort - that's expected cleanup behavior
          const error = ensureError(thrownObject);
          if (error.name !== 'AbortError') {
            callback(error, null);
          }
        }
      } catch (thrownObject) {
        // Don't call callback on abort - that's expected cleanup behavior
        const error = ensureError(thrownObject);
        if (error.name !== 'AbortError') {
          callback(error, null);
        }
      }
    };

    // Fetch the current balance of this account.
    fetchInitialBalance();

    // Subscribe for updates to that balance.
    subscribeToUpdates();

    // Return a cleanup callback that aborts the RPC call/subscription.
    return () => {
      abortController.abort();
    };
  };

  /**
   * Watch for changes to a Solana account's lamport balance.
   *
   * This function fetches the current balance and subscribes to ongoing updates,
   * calling the provided callback whenever the balance changes.
   *
   * @param address - The Solana address to watch
   * @param callback - Called with (error, balance) on each balance change
   * @returns Cleanup function to stop watching
   *
   * The callback receives:
   * - error: Error object if an error occurred (null if successful)
   * - balance: the new lamport balance (null if error)
   *
   * At all points in time, check that the update you received -- no matter from where -- is from a
   * higher slot (ie. is newer) than the last one you published to the consumer.
   */
  return watchLamportBalance;
};
