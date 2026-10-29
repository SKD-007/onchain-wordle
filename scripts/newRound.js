import { JsonRpcProvider, Wallet, Contract } from "ethers";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Hardhat Account #0 private key (contract owner)
const OWNER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const ABI = [
  "function setSecretWord(string memory _newSecretWord) external",
  "function currentRound() view returns (uint256)"
];

async function main() {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const ownerWallet = new Wallet(OWNER_PRIVATE_KEY, provider);
  const wordle = new Contract(CONTRACT_ADDRESS, ABI, ownerWallet);

  console.log("Setting new secret word to 'SMART'...");
  const tx = await wordle.setSecretWord("SMART");
  await tx.wait();

  const round = await wordle.currentRound();
  console.log("SUCCESS! Active Round is now:", round.toString());
}

main().catch(console.error);