import {
  Address,
  createSolanaRpcSubscriptions,
  Lamports,
  Commitment,
  createSolanaRpcFromTransport,
  airdropFactory,
} from "@solana/kit";

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
      const signature = await airdrop({
        // We're being conservative here, using the 'finalized' commitment
        // level because we want to ensure the SOL is always available
        // when the function return and users try and spend it.
        commitment: commitment || "finalized",
        recipientAddress: address,
        lamports: airdropAmount,
      });
      return signature;
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
