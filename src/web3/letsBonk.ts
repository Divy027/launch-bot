import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  Connection,
  Transaction,
} from "@solana/web3.js";
import TARGET_PROGRAM_IDL from "./IDL/bonk.json";
import bs58 from "bs58";
import dotenv from "dotenv";
import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { findVanityAddress } from "./keypairGenerate";
dotenv.config();

interface MintParams {
  decimals: number;
  name: string;
  symbol: string;
  uri: string;
}

interface ConstantCurveData {
  supply: anchor.BN;
  totalBaseSell: anchor.BN;
  totalQuoteFundRaising: anchor.BN;
  migrateType: number;
}

interface ConstantCurveParams {
  data: ConstantCurveData;
}

interface CurveParams {
  constant: ConstantCurveParams;
}

interface VestingParams {
  totalLockedAmount: anchor.BN;
  cliffPeriod: anchor.BN;
  unlockPeriod: anchor.BN;
}

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const TARGET_RPC_URL = process.env.RPC || "https://api.mainnet-beta.solana.com";

export async function launchBonkToken(
  tokenName: string,
  tokenSymbol: string,
  tokenUri: string,
  amountToBuyLamports: anchor.BN
): Promise<any> {
  const connection = new Connection(TARGET_RPC_URL, "confirmed");

  const privateKeyEnvVar = process.env.WALLET_PRIVATE_KEY_BASE58 
  console.log(privateKeyEnvVar);
  if (!privateKeyEnvVar) {
    throw new Error("WALLET_PRIVATE_KEY_BASE58 not found in .env file.");
  }
  let secretKeyBytes: Uint8Array;
  try {
    secretKeyBytes = Uint8Array.from(bs58.decode(privateKeyEnvVar));
  } catch (e) {
    throw new Error(
      "Failed to parse WALLET_PRIVATE_KEY_BYTES. Ensure it's a valid JSON array string."
    );
  }
  const internalKeypair = Keypair.fromSecretKey(secretKeyBytes);
  const internalWallet = new anchor.Wallet(internalKeypair);

  const provider = new anchor.AnchorProvider(
    connection,
    internalWallet,
    anchor.AnchorProvider.defaultOptions()
  );
  const program = new Program(TARGET_PROGRAM_IDL as Idl, provider);

  const globalConfigPublicKey = new PublicKey(
    "6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX"
  );
  const platformConfigPublicKey = new PublicKey(
    "FfYek5vEz23cMkWsdJwG2oa6EphsvXSHrGpdALN4g6W1"
  );
  const quoteMintPublicKey = new PublicKey(
    "So11111111111111111111111111111111111111112"
  );
  const eventAuthorityPublicKey = new PublicKey(
    "2DPAtwB8L12vrMRExbLuyGnC7n2J5LNoZQSejeQGpwkr"
  );
  const LAUNCHPAD_AUTHORITY_PUBKEY = new PublicKey(
    "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh"
  );

  const baseMintKeypair = await findVanityAddress();l

  const baseMintParam: MintParams = {
    decimals: 6,
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
  };

  const curveParam: CurveParams = {
    constant: {
      data: {
        supply: new anchor.BN("1000000000000000"),
        totalBaseSell: new anchor.BN("793100000000000"),
        totalQuoteFundRaising: new anchor.BN("85000000000"),
        migrateType: 1,
      },
    },
  };

  const vestingParam: VestingParams = {
    totalLockedAmount: new anchor.BN(0),
    cliffPeriod: new anchor.BN(0),
    unlockPeriod: new anchor.BN(0),
  };

  const [poolStatePda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      baseMintKeypair.publicKey.toBuffer(),
      quoteMintPublicKey.toBuffer(),
    ],
    program.programId
  );
  const [baseVaultPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_vault"),
      poolStatePda.toBuffer(),
      baseMintKeypair.publicKey.toBuffer(),
    ],
    program.programId
  );
  const [quoteVaultPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_vault"),
      poolStatePda.toBuffer(),
      quoteMintPublicKey.toBuffer(),
    ],
    program.programId
  );
  const [metadataAccountPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METAPLEX_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      baseMintKeypair.publicKey.toBuffer(),
    ],
    METAPLEX_TOKEN_METADATA_PROGRAM_ID
  );

  try {
    const transaction = new Transaction();
    // The signers always include you and the new mint.
    const signers = [internalKeypair, baseMintKeypair];

    // =================================================================
    // STEP 1: CREATE AND FUND A TEMPORARY WSOL ACCOUNT
    // =================================================================
    const tempWsolAccount = Keypair.generate();
    const rentExemption = await connection.getMinimumBalanceForRentExemption(
      165
    );

    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: internalWallet.publicKey,
        newAccountPubkey: tempWsolAccount.publicKey,
        lamports: rentExemption + amountToBuyLamports.toNumber(),
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(
        tempWsolAccount.publicKey,
        quoteMintPublicKey,
        internalWallet.publicKey
      )
    );

    signers.push(tempWsolAccount);

    // =================================================================
    // STEP 2: Build the instruction to LAUNCH the token
    // =================================================================
    const initializeInstruction = await program.methods
      .initialize(baseMintParam, curveParam, vestingParam)
      .accountsStrict({
        payer: internalWallet.publicKey,
        creator: internalWallet.publicKey,
        globalConfig: globalConfigPublicKey,
        platformConfig: platformConfigPublicKey,
        authority: LAUNCHPAD_AUTHORITY_PUBKEY,
        poolState: poolStatePda,
        baseMint: baseMintKeypair.publicKey,
        quoteMint: quoteMintPublicKey,
        baseVault: baseVaultPda,
        quoteVault: quoteVaultPda,
        metadataAccount: metadataAccountPda,
        baseTokenProgram: TOKEN_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        metadataProgram: METAPLEX_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rentProgram: SYSVAR_RENT_PUBKEY,
        eventAuthority: eventAuthorityPublicKey,
        program: program.programId,
      })
      .instruction();

    transaction.add(initializeInstruction);

    const userBaseTokenAta = getAssociatedTokenAddressSync(
      baseMintKeypair.publicKey, // The mint of the token we are creating
      internalWallet.publicKey // The owner of the ATA
    );

    // =================================================================
    // STEP 3: Build the instruction to CREATE the user's ATA for the new token
    // =================================================================
    const createAtaInstruction = createAssociatedTokenAccountInstruction(
      internalWallet.publicKey, // Payer
      userBaseTokenAta, // The new ATA address to create
      internalWallet.publicKey, // Owner of the new ATA
      baseMintKeypair.publicKey // Mint of the token
    );

    transaction.add(createAtaInstruction);

    // =================================================================
    // STEP 4: Build the 'buy_exact_in' instruction
    // =================================================================
    const buyInstruction = await program.methods
      .buyExactIn(
        amountToBuyLamports, // amount_in: How much WSOL to spend
        new anchor.BN(1), // minimum_amount_out: Slippage protection (1 is fine for first buy)
        new anchor.BN(0) // share_fee_rate: Set to 0 if no referrer
      )
      .accountsStrict({
        payer: internalWallet.publicKey,
        authority: LAUNCHPAD_AUTHORITY_PUBKEY,
        globalConfig: globalConfigPublicKey,
        platformConfig: platformConfigPublicKey,
        poolState: poolStatePda,
        userBaseToken: userBaseTokenAta, // User's ATA for the new token
        userQuoteToken: tempWsolAccount.publicKey, // User's ATA for WSOL
        baseVault: baseVaultPda,
        quoteVault: quoteVaultPda,
        baseTokenMint: baseMintKeypair.publicKey,
        quoteTokenMint: quoteMintPublicKey,
        baseTokenProgram: TOKEN_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        eventAuthority: eventAuthorityPublicKey,
        program: program.programId,
      })
      .instruction();
    transaction.add(buyInstruction);

    transaction.add(
      createCloseAccountInstruction(
        tempWsolAccount.publicKey,
        internalWallet.publicKey, // Send rent back to you
        internalWallet.publicKey
      )
    );

    // =================================================================
    // STEP 5: Send the bundled transaction
    // =================================================================
    const txSignature = await provider.sendAndConfirm(transaction, signers);

    console.log("Token pool initialized AND first buy executed successfully!");
    console.log("Payer/Creator Wallet:", internalWallet.publicKey.toBase58());
    console.log("Transaction Signature:", txSignature);
    console.log("Base Mint PublicKey:", baseMintKeypair.publicKey.toBase58());
    console.log("Pool State PDA:", poolStatePda.toBase58());
    return txSignature;
  } catch (error) {
    console.error("Error initializing token pool with internal wallet:", error);
    if (error instanceof anchor.AnchorError) {
      console.error("AnchorError Details:", error.error);
      console.error("Error Logs:", error.logs);
    } else {
      console.error("Full Error:", error);
    }
    throw error;
  }
}
