import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OnChainWordleModule = buildModule("OnChainWordleModule", (m) => {
  // Deploy the contract with the initial secret word "APPLE"
  const wordle = m.contract("OnChainWordle", ["APPLE"]);
  return { wordle };
});

export default OnChainWordleModule;