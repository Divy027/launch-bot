import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY, Connection } from "@solana/web3.js";
import  TARGET_PROGRAM_IDL  from "./IDL/bonk.json"
import bs58 from 'bs58';
import dotenv from 'dotenv'; 
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

interface CurveParams {
    constant: ConstantCurveData;
}

interface VestingParams {
    totalLockedAmount: anchor.BN;
    cliffPeriod: anchor.BN;
    unlockPeriod: anchor.BN;
}

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const TARGET_RPC_URL = process.env.RPC || "https://api.mainnet-beta.solana.com"

export async function launchBonkToken(
    tokenName: string,
    tokenSymbol: string,
    tokenUri: string
): Promise<string> {

    const connection = new Connection(TARGET_RPC_URL, "confirmed");

    const privateKeyEnvVar = process.env.PAYMENT_WALLET_BASE58;
    if (!privateKeyEnvVar) {
        throw new Error("WALLET_PRIVATE_KEY_BYTES not found in .env file. Expected a stringified JSON array of numbers.");
    }
    let secretKeyBytes: Uint8Array;
    try {
        secretKeyBytes = Uint8Array.from(bs58.decode(privateKeyEnvVar));
    } catch (e) {
        throw new Error("Failed to parse WALLET_PRIVATE_KEY_BYTES. Ensure it's a valid JSON array string.");
    }
    const internalKeypair = Keypair.fromSecretKey(secretKeyBytes);
    const internalWallet = new anchor.Wallet(internalKeypair);

    const provider = new anchor.AnchorProvider(connection, internalWallet, anchor.AnchorProvider.defaultOptions());
    const program = new Program(TARGET_PROGRAM_IDL as Idl, provider);


    const globalConfigPublicKey = new PublicKey("6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX"); 
    const platformConfigPublicKey = new PublicKey("FfYek5vEz23cMkWsdJwG2oa6EphsvXSHrGpdALN4g6W1"); 
    const quoteMintPublicKey = new PublicKey("So11111111111111111111111111111111111111112"); 

    const baseMintKeypair = Keypair.generate();

   
    const baseMintParam: MintParams = {
        decimals: 6,
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri,
    };

    const curveParam: CurveParams = {
        constant: {
            supply: new anchor.BN("1000000000000000"),
            totalBaseSell: new anchor.BN("793100000000000"),
            totalQuoteFundRaising: new anchor.BN("85000000000"),
            migrateType: 1,
        }
    };

    const vestingParam: VestingParams = {
        totalLockedAmount: new anchor.BN(0),
        cliffPeriod: new anchor.BN(0),
        unlockPeriod: new anchor.BN(0),
    };

    
    const [authorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_auth_seed")], program.programId
    );
    const [poolStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), baseMintKeypair.publicKey.toBuffer(), quoteMintPublicKey.toBuffer()], program.programId
    );
    const [baseVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_vault"), poolStatePda.toBuffer(), baseMintKeypair.publicKey.toBuffer()], program.programId
    );
    const [quoteVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_vault"), poolStatePda.toBuffer(), quoteMintPublicKey.toBuffer()], program.programId
    );
    const [metadataAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METAPLEX_TOKEN_METADATA_PROGRAM_ID.toBuffer(), baseMintKeypair.publicKey.toBuffer()], METAPLEX_TOKEN_METADATA_PROGRAM_ID
    );
    const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("__event_authority")], program.programId
    );

    try {
        const txSignature = await program.methods
            .initialize(baseMintParam, curveParam, vestingParam)
            .accountsStrict({
                payer: internalWallet.publicKey, 
                creator: internalWallet.publicKey, 
                globalConfig: globalConfigPublicKey,
                platformConfig: platformConfigPublicKey,
                authority: authorityPda,
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
                eventAuthority: eventAuthorityPda,
                program: program.programId,
            })
            .signers([baseMintKeypair])
            .rpc();

        console.log("Token pool initialized successfully with internal wallet!");
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

