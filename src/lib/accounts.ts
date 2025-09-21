import {
  type Address,
  decodeAccount,
  MaybeEncodedAccount,
  parseBase64RpcAccount,
  type Decoder,
  createSolanaRpcFromTransport,
  getBase58Decoder,
} from "@solana/kit";

// OK brother hear me out
// 'FactoryFactory' seems weird but:
// - The first factory returns a second factory, with the RPC connection baked in
// - That second factory people can use to create a 'getOffers' or 'getAuctions' or 'getUsers'
export const getAccountsFactoryFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Creates a function that gets all program accounts of a particular type
   * @param {Address} programAddress - The program address to query accounts from
   * @param {Uint8Array} discriminator - The discriminator to filter accounts by
   * @param {Decoder<T>} decoder - The decoder to use for parsing account data
   * @returns {() => Promise<Array<T>>} A function that returns an array of decoded accounts
   *
   * @example
   * ```typescript
   * export const getOffers = getAccountsFactory(
   *   programClient.ESCROW_PROGRAM_ADDRESS,
   *   OFFER_DISCRIMINATOR,
   *   getOfferDecoder(),
   * );
   * ```
   */
  const getAccountsFactory = <T extends object>(
    programAddress: Address,
    discriminator: Uint8Array,
    decoder: Decoder<T>,
  ) => {
    return async () => {
      // See https://solana.com/docs/rpc/http/getprogramaccounts
      const base58Decoder = getBase58Decoder();
      const getProgramAccountsResults = await rpc
        .getProgramAccounts(programAddress, {
          encoding: "jsonParsed",
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: base58Decoder.decode(discriminator),
              },
            },
          ],
        })
        .send();

      // getProgramAccounts uses one format
      // decodeAccount uses another
      const encodedAccounts: Array<MaybeEncodedAccount> = getProgramAccountsResults.map((result: any) => {
        const account = parseBase64RpcAccount(result.pubkey, result.account);
        return {
          ...account,
          data: Uint8Array.from(account.data),
          exists: true,
        };
      });

      const decodedAccounts = encodedAccounts.map((maybeAccount) => {
        return decodeAccount(maybeAccount, decoder);
      });
      return decodedAccounts;
    };
  };
  return getAccountsFactory;
};
