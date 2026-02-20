import { Commitment, createSignerFromKeyPair, Lamports, TransactionSigner } from "@solana/kit";
import { DEFAULT_AIRDROP_AMOUNT, DEFAULT_ENV_KEYPAIR_VARIABLE_NAME } from "./constants";
import {
  addKeyPairSignerToEnvFile,
  createJSONFromKeyPairSigner,
  grindKeyPair,
  loadWalletFromEnvironment,
} from "./keypair";
import dotenv from "dotenv";
import { airdropIfRequiredFactory } from "./sol";

const expandHomeDirectoryPath = async (filePath: string): Promise<string> => {
  if (filePath[0] === "~") {
    const path = await import("node:path");
    const home = process.env.HOME || null;
    if (home) {
      return path.join(home, filePath.slice(1));
    }
  }
  return filePath;
};

const ensureFileDoesNotExist = async (filePath: string): Promise<void> => {
  const { access } = await import("node:fs/promises");
  try {
    await access(filePath);
    throw new Error(`File '${filePath}' already exists.`);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    // If the error is our "already exists" error, rethrow it
    if (fileError.message.includes("already exists")) {
      throw fileError;
    }
    // If the error code is ENOENT, the file doesn't exist, which is what we want
    // Otherwise, rethrow the error (e.g., permission errors)
    if (fileError.code !== "ENOENT") {
      throw fileError;
    }
  }
};

export const createWalletFactory = (airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>) => {
  const createWallet = async (
    options: {
      prefix?: string | null;
      suffix?: string | null;
      envFileName?: string | null;
      envVariableName?: string;
      fileName?: string | null;
      airdropAmount?: Lamports | null;
      commitment?: Commitment | null;
    } = {},
  ): Promise<TransactionSigner> => {
    // If the user wants to save to an env variable, we need to save to a file
    if (options.envVariableName && !options.envFileName) {
      options.envFileName = ".env";
    }

    const {
      prefix = null,
      suffix = null,
      envFileName = null,
      envVariableName = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
      fileName = null,
      airdropAmount = DEFAULT_AIRDROP_AMOUNT,
      commitment = null,
    } = options;

    // Don't allow saving to both envFileName and fileName
    if (envFileName && fileName) {
      throw new Error("Cannot save to both envFileName and fileName. Please specify only one.");
    }

    // Check if fileName already exists BEFORE grinding (since grinding can take a while)
    if (fileName) {
      const filePath = await expandHomeDirectoryPath(fileName);
      await ensureFileDoesNotExist(filePath);
    }

    let keyPairSigner: TransactionSigner;

    // If we need to save to a file or env file, we need an extractable keypair
    if (envFileName || fileName) {
      // Important: we make a temporary extractable keyPair and write it to the file(s)
      // We then reload the keypair from the file as non-extractable
      // This is because the temporaryExtractableKeyPair's private key is extractable, and we want to keep it secret
      const temporaryExtractableKeyPair = await grindKeyPair({
        prefix,
        suffix,
        silenceGrindProgress: false,
        isPrivateKeyExtractable:
          "yes I understand the risk of extractable private keys and will delete this keypair shortly after saving it to a file",
      });
      const temporaryExtractableKeyPairSigner = await createSignerFromKeyPair(temporaryExtractableKeyPair);

      // Save to env file if requested
      if (envFileName) {
        await addKeyPairSignerToEnvFile(temporaryExtractableKeyPairSigner, envVariableName, envFileName);
        dotenv.config({ path: envFileName });
        keyPairSigner = await loadWalletFromEnvironment(envVariableName);
      }

      // Save to JSON file if requested
      if (fileName) {
        const { writeFile } = await import("node:fs/promises");
        const filePath = await expandHomeDirectoryPath(fileName);

        const privateKeyJSON = await createJSONFromKeyPairSigner(temporaryExtractableKeyPairSigner);
        await writeFile(filePath, privateKeyJSON);

        // Reload from JSON file as non-extractable
        const { loadWalletFromFile } = await import("./keypair");
        keyPairSigner = await loadWalletFromFile(filePath);
      }

      // Once the block is exited, the variable will be dereferenced and no longer accessible. This means the memory used by the variable can be reclaimed by the garbage collector, as there are no other references to it outside the block. Goodbye temporaryExtractableKeyPair and temporaryExtractableKeyPairSigner!
    } else {
      const keyPair = await grindKeyPair({
        prefix,
        suffix,
      });
      keyPairSigner = await createSignerFromKeyPair(keyPair);
    }

    // TypeScript can't infer that keyPairSigner is always assigned, but logically it must be
    // (either from the if block when envFileName || fileName, or from the else block)
    const finalKeyPairSigner = keyPairSigner!;

    if (airdropAmount) {
      // Since this is a brand new wallet (and has no existing balance), we can just use the airdrop amount for the minimum balance
      await airdropIfRequired(finalKeyPairSigner.address, airdropAmount, airdropAmount, commitment);
    }

    return finalKeyPairSigner;
  };

  return createWallet;
};

// See https://assets.fengsi.io/pr:sharp/rs:fill:1600:1067:1:1/g:ce/q:80/L2FwaS9qZGxlYXRoZXJnb29kcy9vcmlnaW5hbHMvYjZmNmU2ODAtNzY3OC00MDFiLWE1MzctODg4MWQyMmMzZWIyLmpwZw.jpg
export const createWalletsFactory = (createWallet: ReturnType<typeof createWalletFactory>) => {
  const createWallets = (
    amount: number,
    options: Parameters<ReturnType<typeof createWalletFactory>>[0] = {},
  ): Promise<Array<TransactionSigner>> => {
    const walletPromises = Array.from({ length: amount }, () => createWallet(options));
    return Promise.all(walletPromises);
  };
  return createWallets;
};
