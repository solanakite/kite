import { getBase58Decoder, MessageModifyingSigner } from "@solana/kit";

export const signMessageFromWalletApp = async (
  message: string,
  messageSigner: MessageModifyingSigner,
): Promise<string> => {
  const base58Decoder = getBase58Decoder();
  const encodedMessage = new TextEncoder().encode(message);
  // Oddly, there's only a modifyAndSignMessages (which accepts an array of messages and returns an array of results)
  // but no singular modifyAndSignMessage.
  // TODO: should be fixed upstream.
  const results = await messageSigner.modifyAndSignMessages([
    {
      content: encodedMessage,
      signatures: {},
    },
  ]);
  const result = results[0];

  // Get the first (and should be only) signature from the result
  const signature = Object.values(result?.signatures)[0];
  if (!signature) {
    throw new Error("Could not find signature in the result");
  }
  return base58Decoder.decode(signature);
};
