import { launchBonkToken } from "./web3/letsBonk";
import { BN } from "@coral-xyz/anchor";


async function Execute () {
  await launchBonkToken("sample", "sp", "https://ipfs.io/ipfs/bafkreibbm2vo4y4brfspefxhwtmaf3qflq3vbon6zqojlcp5573qlmdbyq", new BN(1000))
}

async function main () {
  Execute()
}

main()
.then(()=> {
  console.log("THE SCRIPT STARTED")
})
.catch((e: any) => {
  console.log("ERROR:",e);
})
