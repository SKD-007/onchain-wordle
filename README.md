# On-Chain Wordle

A decentralized application (dApp) implementation of the popular Wordle game, built on Ethereum/EVM local networks. 

This project utilizes a glossary of Blockchain/Web3 terminology for its secret words. Because every guess requires a smart contract interaction, the game serves as an effective mechanism for users to accumulate on-chain transactions in a short period.

## Tech Stack

* **Smart Contracts:** Solidity (`^0.8.20`), Hardhat, Hardhat Ignition
* **Frontend:** React, Vite, Ethers.js (v6)
* **Wallet Integration:** MetaMask

## Local Development Setup

### 1. Prerequisites
* Node.js (v18+)
* MetaMask Browser Extension

### 2. Installation
Clone the repository and install dependencies for both the root Hardhat project and the React frontend.

```bash
npm install
cd frontend
npm install
cd ..
```

### 3. Start Local Node & Deploy
In your primary terminal, start the local Hardhat node. Keep this process running.
```bash
npx hardhat node
```

Open a second terminal window and deploy the smart contract to the local network:
```bash
npx hardhat ignition deploy ./ignition/modules/OnChainWordle.ts --network localhost
```
*Note: Verify that the deployed contract address matches the `CONTRACT_ADDRESS` constant in `frontend/src/App.jsx`.*

### 4. Configure MetaMask
Add the local Hardhat network to MetaMask:
* **Network Name:** Hardhat Localhost
* **RPC URL:** `http://127.0.0.1:8545`
* **Chain ID:** `31337`
* **Currency Symbol:** ETH

Import one of the private keys provided by the `npx hardhat node` output into MetaMask to fund your test account.

### 5. Run the Frontend
In your second terminal, navigate to the frontend directory and start the Vite development server.
```bash
cd frontend
npm run dev
```
Navigate to `http://localhost:5173` to interact with the dApp.

## Smart Contract Architecture & Gas Optimization

This project is built around a single, globally shared smart contract. To handle thousands of players simultaneously without creating separate contract instances, it relies heavily on gas-optimized state management and mathematical evaluation.

### 1. State Management via Nested Mappings
Instead of maintaining arrays of player data, the contract uses nested mappings, which function as a two-dimensional hash map:
`mapping(address => mapping(uint256 => uint256)) public attempts;`

* **Outer Key:** The player's cryptographic wallet address (`msg.sender`), ensuring total isolation of player sessions.
* **Inner Key:** The specific game round (`currentRound`).
* **Value:** The number of attempts used in that round.

### 2. O(1) Gas-Efficient Round Resets
Smart contracts cannot execute scheduled tasks autonomously. Therefore, the transition to a new game round is handled manually via the contract owner executing `setSecretWord()`. 

When the round advances, `currentRound` is incremented by 1. Because player attempts are tracked using the nested mapping structure mapped to the round ID, incrementing the round inherently resets all players' attempt counts to 0. This gives all players 6 fresh attempts instantly without needing to execute costly $O(N)$ loops to wipe out old data from previous rounds.

To simulate a round transition locally, run:
```bash
node scripts/newRound.js
```

### 3. Evaluation Algorithm & Memory Management
The `submitGuess` function processes the player's 5-letter guess in two distinct passes to prevent double-counting duplicate letters:
* **Pass 1 (Green Check):** Identifies exact index matches.
* **Pass 2 (Yellow Check):** Identifies misplaced letters. 

**Preventing False Positives:** The algorithm utilizes two boolean arrays in memory (`guessMatched` and `secretMatched`). Once a letter in the secret word is paired with a letter in the guess, its index is flagged. This ensures that if the secret word has only one 'A', a user guessing "AAAAA" will not receive 5 Yellow tiles.

**Gas Savings on Gray Tiles:** The EVM automatically initializes memory arrays to zero. Because the `LetterStatus` enum assigns `Gray = 0`, `Yellow = 1`, and `Green = 2`, the contract only spends gas modifying memory for Green and Yellow matches. Unmatched letters are left untouched, inherently defaulting to Gray without redundant operations.

## Security Considerations (MVP vs. Production)

In this MVP implementation, the active secret word is stored in standard contract state (`bytes5 public secretWord`) to allow for simple on-chain character evaluation in a single transaction. 

**Production Note:** If deployed to a public mainnet, storing the answer in plaintext state allows users to read the solution via blockchain explorers prior to guessing. A production-ready architecture would utilize a Zero-Knowledge Proof (ZK-SNARK) circuit where the contract stores only a `bytes32` hash of the word, and the client submits a cryptographic proof of their guess evaluation.
