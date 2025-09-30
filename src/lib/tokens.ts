import { Account, Commitment, generateKeyPairSigner, Lamports, some } from "@solana/kit";
import { Address } from "@solana/kit";
import {
  // This is badly named. It's a function that returns an object.
  extension as getExtensionData,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMetadataPointerInstruction,
  getInitializeMintInstruction,
  getInitializeTokenMetadataInstruction,
  getMintSize,
  getMintToInstruction,
  getUpdateTokenMetadataFieldInstruction,
  tokenMetadataField,
  getTransferCheckedInstruction,
  fetchMint,
  getCreateAssociatedTokenInstruction,
  Extension,
  Mint,
} from "@solana-program/token-2022";
const { getInitializeMintInstruction: getClassicInitializeMintInstruction, getMintSize: getClassicMintSize } =
  await import("@solana-program/token");
import { createSolanaRpcFromTransport, KeyPairSigner } from "@solana/kit";
import { sendTransactionFromInstructionsFactory } from "./transactions";
import { getCreateAccountInstruction, getTransferSolInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM,
  TOKEN_EXTENSIONS_PROGRAM,
  DISCRIMINATOR_SIZE,
  PUBLIC_KEY_SIZE,
  LENGTH_FIELD_SIZE,
} from "./constants";

export const transferLamportsFactory = (
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  const transferLamports = async ({
    source,
    destination,
    amount,
    skipPreflight = true,
    maximumClientSideRetries = 0,
    abortSignal = null,
  }: {
    source: KeyPairSigner;
    destination: Address;
    amount: Lamports;
    skipPreflight?: boolean;
    maximumClientSideRetries?: number;
    abortSignal?: AbortSignal | null;
  }) => {
    const instruction = getTransferSolInstruction({
      amount,
      destination: destination,
      source: source,
    });

    const signature = await sendTransactionFromInstructions({
      feePayer: source,
      instructions: [instruction],
      commitment: "confirmed",
      skipPreflight,
      maximumClientSideRetries,
      abortSignal,
    });

    return signature;
  };
  return transferLamports;
};

export const transferTokensFactory = (
  getMint: ReturnType<typeof getMintFactory>,
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  const transferTokens = async ({
    sender,
    destination,
    mintAddress,
    amount,
    maximumClientSideRetries = 0,
    abortSignal = null,
    useTokenExtensions = true,
  }: {
    sender: KeyPairSigner;
    destination: Address;
    mintAddress: Address;
    amount: bigint;
    maximumClientSideRetries?: number;
    abortSignal?: AbortSignal | null;
    useTokenExtensions?: boolean;
  }) => {
    const tokenProgram = useTokenExtensions ? TOKEN_EXTENSIONS_PROGRAM : TOKEN_PROGRAM;

    const mint = await getMint(mintAddress);

    if (!mint) {
      throw new Error(`Mint not found: ${mintAddress}`);
    }

    const decimals = mint.data.decimals;

    const sourceAssociatedTokenAddress = await getTokenAccountAddress(sender.address, mintAddress, useTokenExtensions);

    const destinationAssociatedTokenAddress = await getTokenAccountAddress(
      destination,
      mintAddress,
      useTokenExtensions,
    );

    // Create an associated token account for the receiver
    const createAssociatedTokenInstruction = getCreateAssociatedTokenInstruction({
      ata: destinationAssociatedTokenAddress,
      mint: mintAddress,
      owner: destination,
      payer: sender,
      tokenProgram,
    });

    const transferInstruction = getTransferCheckedInstruction(
      {
        source: sourceAssociatedTokenAddress,
        mint: mintAddress,
        destination: destinationAssociatedTokenAddress,
        authority: sender.address,
        amount,
        decimals,
      },
      { programAddress: tokenProgram },
    );

    const signature = await sendTransactionFromInstructions({
      feePayer: sender,
      instructions: [createAssociatedTokenInstruction, transferInstruction],
      commitment: "confirmed",
      skipPreflight: true,
      maximumClientSideRetries,
      abortSignal,
    });

    return signature;
  };
  return transferTokens;
};

/**
 * Gets the address where a wallet's tokens are stored.
 * Each wallet has a unique storage address for each type of token.
 * @param {Address} wallet - The wallet that owns the tokens
 * @param {Address} mint - The type of token
 * @param {boolean} [useTokenExtensions=false] - Use Token Extensions program instead of classic Token program
 * @returns {Promise<Address>} The token account address
 */
export const getTokenAccountAddress = async (wallet: Address, mint: Address, useTokenExtensions: boolean = false) => {
  const tokenProgram = useTokenExtensions ? TOKEN_EXTENSIONS_PROGRAM : TOKEN_PROGRAM;

  // Slightly misnamed, it returns an address and a seed
  const [address] = await findAssociatedTokenPda({
    mint: mint,
    owner: wallet,
    tokenProgram,
  });

  return address;
};

/**
 * Creates a classic SPL token mint (without metadata extensions)
 */
const createClassicTokenMint = async ({
  rpc,
  sendTransactionFromInstructions,
  mintAuthority,
  decimals,
}: {
  rpc: ReturnType<typeof createSolanaRpcFromTransport>;
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>;
  mintAuthority: KeyPairSigner;
  decimals: number;
}): Promise<Address> => {
  const mint = await generateKeyPairSigner();
  const mintSpace = BigInt(getClassicMintSize());
  const rent = await rpc.getMinimumBalanceForRentExemption(mintSpace).send();

  const createAccountInstruction = getCreateAccountInstruction({
    payer: mintAuthority,
    newAccount: mint,
    lamports: rent,
    space: mintSpace,
    programAddress: TOKEN_PROGRAM,
  });

  const initializeMintInstruction = getClassicInitializeMintInstruction(
    {
      mint: mint.address,
      decimals,
      mintAuthority: mintAuthority.address,
    },
    { programAddress: TOKEN_PROGRAM },
  );

  const instructions = [createAccountInstruction, initializeMintInstruction];

  await sendTransactionFromInstructions({
    feePayer: mintAuthority,
    instructions,
  });

  return mint.address;
};

/**
 * Creates a Token Extensions (Token-2022) mint with metadata
 */
const createToken22Mint = async ({
  rpc,
  sendTransactionFromInstructions,
  mintAuthority,
  decimals,
  name,
  symbol,
  uri,
  additionalMetadata = {},
}: {
  rpc: ReturnType<typeof createSolanaRpcFromTransport>;
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>;
  mintAuthority: KeyPairSigner;
  decimals: number;
  name: string;
  symbol: string;
  uri: string;
  additionalMetadata?: Record<string, string> | Map<string, string>;
}): Promise<Address> => {
  // See https://solana.stackexchange.com/questions/19747/how-do-i-make-a-token-with-metadata-using-web3-js-version-2/19792#19792 - big thanks to John for helping me turn the unit tests into a working example

  // Generate keypairs for and mint
  const mint = await generateKeyPairSigner();

  // Convert additionalMetadata to a Map if it's a Record
  const additionalMetadataMap =
    additionalMetadata instanceof Map ? additionalMetadata : new Map(Object.entries(additionalMetadata));

  // Metadata Pointer Extension Data
  // Storing metadata directly in the mint account
  const metadataPointerExtensionData = getExtensionData("MetadataPointer", {
    authority: some(mintAuthority.address),
    metadataAddress: some(mint.address),
  });

  // Token Metadata Extension Data
  // Using this to calculate rent lamports up front
  const tokenMetadataExtensionData = getExtensionData("TokenMetadata", {
    updateAuthority: some(mintAuthority.address),
    mint: mint.address,
    name,
    symbol,
    uri,
    additionalMetadata: additionalMetadataMap,
  });

  // The amount of space required to initialize the mint account (with metadata pointer extension only)
  // Excluding the metadata extension intentionally
  // The metadata extension instruction MUST come after initialize mint instruction,
  // Including space for the metadata extension will result in
  // error: "invalid account data for instruction" when the initialize mint instruction is processed
  const spaceWithoutMetadata = BigInt(getMintSize([metadataPointerExtensionData]));

  // The amount of space required for the mint account and both extensions
  // Use to calculate total rent lamports that must be allocated to the mint account
  // The metadata extension instruction automatically does the space reallocation,
  // but DOES NOT transfer the rent lamports required to store the extra metadata
  const spaceWithMetadata = BigInt(getMintSize([metadataPointerExtensionData, tokenMetadataExtensionData]));

  // Calculate rent lamports for mint account with metadata pointer and token metadata extensions
  const rent = await rpc.getMinimumBalanceForRentExemption(spaceWithMetadata).send();

  // Instruction to create new account for mint (Token Extensions program)
  // space: only for mint and metadata pointer extension, other wise initialize instruction will fail
  // lamports: for mint, metadata pointer extension, and token metadata extension (paying up front for simplicity)
  const createAccountInstruction = getCreateAccountInstruction({
    payer: mintAuthority,
    newAccount: mint,
    lamports: rent,
    space: spaceWithoutMetadata,
    programAddress: TOKEN_EXTENSIONS_PROGRAM,
  });

  // Instruction to initialize metadata pointer extension
  // This instruction must come before initialize mint instruction
  const initializeMetadataPointerInstruction = getInitializeMetadataPointerInstruction({
    mint: mint.address,
    authority: mintAuthority.address,
    metadataAddress: mint.address,
  });

  // Instruction to initialize base mint account data
  const initializeMintInstruction = getInitializeMintInstruction({
    mint: mint.address,
    decimals,
    mintAuthority: mintAuthority.address,
  });

  // Instruction to initialize token metadata extension
  // This instruction must come after initialize mint instruction
  // This ONLY initializes basic metadata fields (name, symbol, uri)
  const initializeTokenMetadataInstruction = getInitializeTokenMetadataInstruction({
    metadata: mint.address,
    updateAuthority: mintAuthority.address,
    mint: mint.address,
    mintAuthority: mintAuthority,
    name: tokenMetadataExtensionData.name,
    symbol: tokenMetadataExtensionData.symbol,
    uri: tokenMetadataExtensionData.uri,
  });

  // Create update instructions for all additional metadata fields
  const updateInstructions = Array.from(additionalMetadataMap.entries()).map(([key, value]) => {
    return getUpdateTokenMetadataFieldInstruction({
      metadata: mint.address,
      updateAuthority: mintAuthority,
      field: tokenMetadataField("Key", [key]),
      value: value,
    });
  });

  // Order of instructions to add to transaction
  const instructions = [
    createAccountInstruction,
    initializeMetadataPointerInstruction,
    initializeMintInstruction,
    initializeTokenMetadataInstruction,
    ...updateInstructions,
  ];

  await sendTransactionFromInstructions({
    feePayer: mintAuthority,
    instructions,
  });

  return mint.address;
};

export const createTokenMintFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
): ((params: {
  mintAuthority: KeyPairSigner;
  decimals: number;
  name?: string;
  symbol?: string;
  uri?: string;
  additionalMetadata?: Record<string, string> | Map<string, string>;
  useTokenExtensions?: boolean;
}) => Promise<Address>) => {
  const createTokenMint = async ({
    mintAuthority,
    decimals,
    name,
    symbol,
    uri,
    additionalMetadata = {},
    useTokenExtensions = true,
  }: {
    mintAuthority: KeyPairSigner;
    decimals: number;
    name?: string;
    symbol?: string;
    uri?: string;
    additionalMetadata?: Record<string, string> | Map<string, string>;
    useTokenExtensions?: boolean;
  }) => {
    if (!useTokenExtensions) {
      return createClassicTokenMint({
        rpc,
        sendTransactionFromInstructions,
        mintAuthority,
        decimals,
      });
    }

    if (!name || !symbol || !uri) {
      throw new Error("name, symbol, and uri are required when useTokenExtensions is true");
    }

    return createToken22Mint({
      rpc,
      sendTransactionFromInstructions,
      mintAuthority,
      decimals,
      name,
      symbol,
      uri,
      additionalMetadata,
    });
  };

  return createTokenMint;
};

export const mintTokensFactory = (
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  const mintTokens = async (
    mintAddress: Address,
    mintAuthority: KeyPairSigner,
    amount: bigint,
    destination: Address,
    useTokenExtensions = true,
  ) => {
    const tokenProgram = useTokenExtensions ? TOKEN_EXTENSIONS_PROGRAM : TOKEN_PROGRAM;

    // Create Associated Token Account
    const createAtaInstruction = await getCreateAssociatedTokenInstructionAsync({
      payer: mintAuthority,
      mint: mintAddress,
      owner: destination,
      tokenProgram,
    });

    // Derive destination associated token address
    // Instruction to mint tokens to associated token account
    const associatedTokenAddress = await getTokenAccountAddress(destination, mintAddress, useTokenExtensions);

    const mintToInstruction = getMintToInstruction(
      {
        mint: mintAddress,
        token: associatedTokenAddress,
        mintAuthority: mintAuthority.address,
        amount: amount,
      },
      { programAddress: tokenProgram },
    );

    const transactionSignature = await sendTransactionFromInstructions({
      feePayer: mintAuthority,
      instructions: [createAtaInstruction, mintToInstruction],
    });

    return transactionSignature;
  };
  return mintTokens;
};

export const getMintFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getMint = async (mintAddress: Address, commitment: Commitment = "confirmed") => {
    const mint = await fetchMint(rpc, mintAddress, { commitment });
    return mint;
  };

  return getMint;
};

export const getTokenAccountBalanceFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getTokenAccountBalance = async (options: {
    wallet?: Address;
    mint?: Address;
    tokenAccount?: Address;
    useTokenExtensions?: boolean;
  }) => {
    const { wallet, mint, tokenAccount, useTokenExtensions } = options;
    if (!tokenAccount) {
      if (!wallet || !mint) {
        throw new Error("wallet and mint are required when tokenAccount is not provided");
      }
      options.tokenAccount = await getTokenAccountAddress(wallet, mint, useTokenExtensions);
    }
    const result = await rpc.getTokenAccountBalance(options.tokenAccount).send();

    const { amount, decimals, uiAmount, uiAmountString } = result.value;

    return {
      amount: BigInt(amount),
      decimals,
      uiAmount,
      uiAmountString,
    };
  };
  return getTokenAccountBalance;
};

export const checkTokenAccountIsClosedFactory = (
  getTokenAccountBalance: ReturnType<typeof getTokenAccountBalanceFactory>,
) => {
  const checkTokenAccountIsClosed = async (options: {
    wallet?: Address;
    mint?: Address;
    tokenAccount?: Address;
    useTokenExtensions?: boolean;
  }) => {
    try {
      await getTokenAccountBalance(options);
      return false;
    } catch (thrownObject) {
      const error = thrownObject as Error;
      if (error.message.includes("Invalid param: could not find account")) {
        return true;
      }
      throw error;
    }
  };
  return checkTokenAccountIsClosed;
};

export const getTokenMetadataFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getTokenMetadata = async (mintAddress: Address, commitment: Commitment = "confirmed") => {
    // First, try to get the mint account using Token-2022
    let mint: Account<Mint, string>;
    try {
      mint = await fetchMint(rpc, mintAddress, { commitment });
    } catch (error: unknown) {
      // If Token Extensions fails, try classic Token program
      const { fetchMint: fetchClassicMint } = await import("@solana-program/token");
      try {
        mint = await fetchClassicMint(rpc, mintAddress, { commitment });
        // Classic Token program doesn't have metadata extensions
        throw new Error(`Mint ${mintAddress} uses classic Token program which doesn't support metadata extensions`);
      } catch (classicError) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(
          `Mint not found: ${mintAddress}. Neither Token Extensions nor classic Token program could decode this mint. Original error: ${errorMessage}`,
        );
      }
    }

    if (!mint) {
      throw new Error(`Mint not found: ${mintAddress}`);
    }

    // Extract extensions from the mint account data
    const extensions = mint.data?.extensions?.__option === "Some" ? mint.data.extensions.value : [];

    // Find the metadata pointer extension
    const metadataPointerExtension = extensions.find((extension: Extension) => extension.__kind === "MetadataPointer");

    if (!metadataPointerExtension || metadataPointerExtension.metadataAddress.__option === "None") {
      throw new Error(`No metadata pointer extension found for mint: ${mintAddress}`);
    }

    // Get the metadata address from the extension
    const metadataAddress =
      metadataPointerExtension.metadataAddress?.__option === "Some"
        ? metadataPointerExtension.metadataAddress.value
        : null;

    if (!metadataAddress) {
      throw new Error(`No metadata address found in metadata pointer extension for mint: ${mintAddress}`);
    }

    // Check if metadata is stored directly in the mint account
    if (metadataAddress.toString() === mintAddress.toString()) {
      // Metadata is stored directly in the mint account
      // Find the TokenMetadata extension
      const tokenMetadata = extensions.find((extension: Extension) => extension.__kind === "TokenMetadata");

      if (!tokenMetadata) {
        throw new Error(`TokenMetadata extension not found in mint account: ${mintAddress}`);
      }

      // Extract metadata from the TokenMetadata extension
      const additionalMetadata: Record<string, string> = {};
      if (tokenMetadata.additionalMetadata instanceof Map) {
        for (const [key, value] of tokenMetadata.additionalMetadata) {
          additionalMetadata[key] = value;
        }
      }

      const updateAuthority =
        tokenMetadata.updateAuthority.__option === "Some"
          ? tokenMetadata.updateAuthority?.value
          : undefined;

      return {
        updateAuthority:
          tokenMetadata.updateAuthority?.__option === "Some"
            ? tokenMetadata.updateAuthority.value
            : null,
        mint: tokenMetadata.mint,
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        uri: tokenMetadata.uri,
        additionalMetadata,
      };
    } else {
      // Metadata is stored in a separate account
      const metadataAccount = await rpc.getAccountInfo(metadataAddress, { commitment }).send();

      if (!metadataAccount.value) {
        throw new Error(`Metadata account not found: ${metadataAddress}`);
      }

      // Parse the metadata from the separate metadata account
      const data = metadataAccount.value.data;
      return parseTokenMetadataAccount(data);
    }
  };

  // Helper function to parse TokenMetadata account data
  const parseTokenMetadataAccount = (data: Uint8Array) => {
    // Skip the 8-byte discriminator
    let offset = DISCRIMINATOR_SIZE;

    // Read update authority (32 bytes)
    const updateAuthority = data.slice(offset, offset + PUBLIC_KEY_SIZE);
    offset += PUBLIC_KEY_SIZE;

    // Read mint (32 bytes)
    const mintAddressFromMetadata = data.slice(offset, offset + PUBLIC_KEY_SIZE);
    offset += PUBLIC_KEY_SIZE;

    // Read name length (4 bytes, little endian)
    const nameLength = new DataView(data.buffer, data.byteOffset).getUint32(offset, true);
    offset += LENGTH_FIELD_SIZE;

    // Read name (variable length)
    const name = new TextDecoder("utf8").decode(data.slice(offset, offset + nameLength));
    offset += nameLength;

    // Read symbol length (4 bytes, little endian)
    const symbolLength = new DataView(data.buffer, data.byteOffset).getUint32(offset, true);
    offset += LENGTH_FIELD_SIZE;

    // Read symbol (variable length)
    const symbol = new TextDecoder("utf8").decode(data.slice(offset, offset + symbolLength));
    offset += symbolLength;

    // Read URI length (4 bytes, little endian)
    const uriLength = new DataView(data.buffer, data.byteOffset).getUint32(offset, true);
    offset += LENGTH_FIELD_SIZE;

    // Read URI (variable length)
    const uri = new TextDecoder("utf8").decode(data.slice(offset, offset + uriLength));
    offset += uriLength;

    // Read additional metadata count (4 bytes, little endian)
    const additionalMetadataCount = new DataView(data.buffer, data.byteOffset).getUint32(offset, true);
    offset += LENGTH_FIELD_SIZE;

    // Parse additional metadata
    const additionalMetadata: Record<string, string> = {};
    for (let i = 0; i < additionalMetadataCount; i++) {
      // Read key length (4 bytes, little endian)
      const keyLength = new DataView(data.buffer, data.byteOffset).getUint32(offset, true);
      offset += LENGTH_FIELD_SIZE;

      // Read key (variable length)
      const key = new TextDecoder("utf8").decode(data.slice(offset, offset + keyLength));
      offset += keyLength;

      // Read value length (4 bytes, little endian)
      const valueLength = new DataView(data.buffer, data.byteOffset).getUint32(offset, true);
      offset += LENGTH_FIELD_SIZE;

      // Read value (variable length)
      const value = new TextDecoder("utf8").decode(data.slice(offset, offset + valueLength));
      offset += valueLength;

      additionalMetadata[key] = value;
    }

    return {
      updateAuthority: updateAuthority,
      mint: mintAddressFromMetadata,
      name,
      symbol,
      uri,
      additionalMetadata,
    };
  };

  return getTokenMetadata;
};
