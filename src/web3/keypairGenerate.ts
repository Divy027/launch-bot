import { Keypair } from "@solana/web3.js";

export async function findVanityAddress() {
    const desiredSuffix = 'bonk';
    console.log(`Searching for a Solana address ending with '${desiredSuffix}'...`);
    
    let keypair: Keypair;
    let address: string;
    let attempts = 0;

    // This is an infinite loop that will run until a match is found
    while (true) {
        keypair = Keypair.generate();
        address = keypair.publicKey.toBase58();
        attempts++;

        if (attempts % 100000 === 0) {
            console.log(`[${new Date().toLocaleTimeString()}] Attempts: ${attempts.toLocaleString()}`);
        }

        if (address.toLowerCase().endsWith(desiredSuffix)) {
            console.log("\n🎉 Found a match! 🎉\n");
            console.log(`Address: ${address}`);
            console.log(`Public Key: ${keypair.publicKey.toBase58()}`);
            
            
            return keypair;
        
        }
    }
}
