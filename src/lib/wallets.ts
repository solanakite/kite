import { Commitment, createSignerFromKeyPair, KeyPairSigner, Lamports } from "@solana/kit";
import { DEFAULT_AIRDROP_AMOUNT, DEFAULT_ENV_KEYPAIR_VARIABLE_NAME } from "./constants";
import { addKeyPairSignerToEnvFile, grindKeyPair, loadWalletFromEnvironment } from "./keypair";
import dotenv from "dotenv";
import { airdropIfRequiredFactory } from "./sol";

export const createWalletFactory = (airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>) => {
  const createWallet = async (
    options: {
      prefix?: string | null;
      suffix?: string | null;
      envFileName?: string | null;
      envVariableName?: string;
      airdropAmount?: Lamports | null;
      commitment?: Commitment | null;
    } = {},
  ): Promise<KeyPairSigner> => {
    // If the user wants to save to an env variable, we need to save to a file
    if (options.envVariableName && !options.envFileName) {
      options.envFileName = ".env";
    }

    const {
      prefix = null,
      suffix = null,
      envFileName = null,
      envVariableName = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
      airdropAmount = DEFAULT_AIRDROP_AMOUNT,
      commitment = null,
    } = options;

    let keyPairSigner: KeyPairSigner;

    if (envFileName) {
      // Important: we make a temporary extractable keyPair and write it to the environment file
      // We then reload the keypair from the environment as non-extractable
      // This is because the temporaryExtractableKeyPair's private key is extractable, and we want to keep it secret
      const temporaryExtractableKeyPair = await grindKeyPair({
        prefix,
        suffix,
        silenceGrindProgress: false,
        isPrivateKeyExtractable:
          "yes I understand the risk of extractable private keys and will delete this keypair shortly after saving it to a file",
      });
      const temporaryExtractableKeyPairSigner = await createSignerFromKeyPair(temporaryExtractableKeyPair);
      await addKeyPairSignerToEnvFile(temporaryExtractableKeyPairSigner, envVariableName, envFileName);
      dotenv.config({ path: envFileName });
      keyPairSigner = await loadWalletFromEnvironment(envVariableName);
      // Once the block is exited, the variable will be dereferenced and no longer accessible. This means the memory used by the variable can be reclaimed by the garbage collector, as there are no other references to it outside the block. Goodbye temporaryExtractableKeyPair and temporaryExtractableKeyPairSigner!
    } else {
      const keyPair = await grindKeyPair({
        prefix,
        suffix,
      });
      keyPairSigner = await createSignerFromKeyPair(keyPair);
    }

    if (airdropAmount) {
      // Since this is a brand new wallet (and has no existing balance), we can just use the airdrop amount for the minimum balance
      await airdropIfRequired(keyPairSigner.address, airdropAmount, airdropAmount, commitment);
    }

    return keyPairSigner;
  };

  return createWallet;
};

// See https://assets.fengsi.io/pr:sharp/rs:fill:1600:1067:1:1/g:ce/q:80/L2FwaS9qZGxlYXRoZXJnb29kcy9vcmlnaW5hbHMvYjZmNmU2ODAtNzY3OC00MDFiLWE1MzctODg4MWQyMmMzZWIyLmpwZw.jpg
export const createWalletsFactory = (createWallet: ReturnType<typeof createWalletFactory>) => {
  const createWallets = (
    amount: number,
    options: Parameters<ReturnType<typeof createWalletFactory>>[0] = {},
  ): Promise<Array<KeyPairSigner>> => {
    const walletPromises = Array.from({ length: amount }, () => createWallet(options));
    return Promise.all(walletPromises);
  };
  return createWallets;
};
