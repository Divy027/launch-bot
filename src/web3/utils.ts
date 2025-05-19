import { Keypair } from '@solana/web3.js';
import { Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { sha256 } from '@noble/hashes/sha256'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import axios from 'axios';
import fs from 'fs';
import FormData from "form-data";
import { USERNAME } from '../twitter/helpers';

export async function getKeyPairFromPrivateKey(key: string) {
    return Keypair.fromSecretKey(
        new Uint8Array(bs58.decode(key))
    );
}

export async function createTransaction(connection: Connection, instructions: TransactionInstruction[], payer: PublicKey): Promise<Transaction> {
    const transaction = new Transaction().add(...instructions);
    transaction.feePayer = payer;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return transaction;
}

export async function sendAndConfirmTransactionWrapper(connection: Connection, transaction: Transaction, signers: any[]) {
    try {
        const signature = await sendAndConfirmTransaction(connection, transaction, signers, { skipPreflight: true, preflightCommitment: 'confirmed' });
        console.log('Transaction confirmed with signature:', signature);
        return signature;
    } catch (error) {
        console.error('Error sending transaction:', error);
        return null;
    }
}

export function bufferFromUInt64(value: number | string) {
    let buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
}

export function generatePubKey({
    fromPublicKey,
    programId = TOKEN_PROGRAM_ID,
  }: {
    fromPublicKey: PublicKey
    programId: PublicKey
  }) {
    const seed =Keypair.generate().publicKey.toBase58().slice(0, 32)
    
    const publicKey = createWithSeed(fromPublicKey, seed, programId)
    return { publicKey, seed }
  }
  
  function createWithSeed(fromPublicKey: PublicKey, seed: string, programId: PublicKey) {
    const buffer = Buffer.concat([fromPublicKey.toBuffer(), Buffer.from(seed), programId.toBuffer()])
    const publicKeyBytes = sha256(buffer)
    return new PublicKey(publicKeyBytes)
  }
  
  export function bufferFromString(value: string) {
    const buffer = Buffer.alloc(4 + value.length);
    buffer.writeUInt32LE(value.length, 0);
    buffer.write(value, 4);
    return buffer;
}


  export async function getPumpURI(name: string, symbol: string,twitter: string, image: Blob ) {
    const formData = new FormData();
    //@notice: Handle Image here 
    //formData.append("file", await fs.openAsBlob("./example.png")),
    formData.append("file", image);
    formData.append("name", `${name}`),
    formData.append("symbol", `${symbol}`),
    formData.append("description", `Launched via @${USERNAME}`),
    formData.append("twitter", `${twitter}`),
    formData.append("telegram", ``),
    formData.append("website", ``),
    formData.append("showName", "true");

    const metadataResponse = await axios.post(
      'https://pump.fun/api/ipfs',
      formData,
      {
        headers: formData.getHeaders(),
      }
    );
    const response = metadataResponse.data.metadataUri;
    return response;

  }

const PINATA_API_KEY = process.env.PINATA_API_KEY!;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY!;

export async function getBonkUri(name: string, symbol: string, twitter: string, image: Blob) {

  const formData = new FormData();
  //@notice: Handle Image here 
  // formData.append('file', fs.createReadStream('./kun.png'));
  formData.append("file", image);

  const imageUploadResponse = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    formData,
    {
      maxContentLength: Infinity,
      headers: {
        ...formData.getHeaders(),
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_API_KEY,
      },
    }
  );

  const imageCID = imageUploadResponse.data.IpfsHash;
  const imageUrl = `https://ipfs.io/ipfs/${imageCID}`;

  console.log('✅ Image uploaded:', imageUrl);

  const metadata = {
    name: `${name}`,
    symbol: `${symbol}`,
    description: `Launched via @${USERNAME}`,
    createdOn: 'https://bonk.fun',
    image: imageUrl,
    twitter: `${twitter}`,
  };

  const metadataUploadResponse = await axios.post(
    'https://api.pinata.cloud/pinning/pinJSONToIPFS',
    metadata,
    {
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_API_KEY,
      },
    }
  );

  const metadataCID = metadataUploadResponse.data.IpfsHash;
  const metadataUrl = `https://ipfs.io/ipfs/${metadataCID}`;

  console.log('✅ Metadata uploaded:', metadataUrl);
  return metadataUrl
}

