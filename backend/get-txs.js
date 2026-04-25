const { ethers } = require("ethers");
async function run() {
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  const blockNumber = await provider.getBlockNumber();
  for (let i = blockNumber; i > 0; i--) {
    const block = await provider.getBlock(i, true);
    if (block && block.prefetchedTransactions) {
      for (const tx of block.prefetchedTransactions) {
        if (tx.from.toLowerCase() === "0xa562Df3FB8d41299C5D1C9ac5789347bdaC11008".toLowerCase()) {
          console.log("Found TX in block", i, "Hash:", tx.hash);
          const receipt = await provider.getTransactionReceipt(tx.hash);
          console.log("Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
          console.log("To:", tx.to);
          console.log("Data:", tx.data.slice(0, 10));
          console.log("Nonce:", tx.nonce);
        }
      }
    }
  }
}
run().catch(console.error);
