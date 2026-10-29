import { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
import contractABI from "./abi.json";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export default function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [guesses, setGuesses] = useState([]); // Stores { word: "APPLE", result: [2, 0, 1, 0, 0] }
  const [currentGuess, setCurrentGuess] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize Ethers.js and Request Wallet Access
// const connectWallet = async () => {
//   if (!window.ethereum) return alert("Please install MetaMask!");

//   try {
//     const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

//     const provider = new BrowserProvider(window.ethereum);
//     const signer = await provider.getSigner();
//     const abi = contractABI.abi || contractABI;
//     const wordleContract = new Contract(CONTRACT_ADDRESS, abi, signer)

//     // Set contract first, then set account
//     setContract(wordleContract);
//     setAccount(accounts[0]);
//   } catch (error) {
//     console.error("Wallet connection failed:", error);
//     alert("Contract connection failed. Check CONTRACT_ADDRESS in App.jsx and open browser console!");
//   }
// };

const connectWallet = async () => {
  if (!window.ethereum) return alert("Please install MetaMask!");

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Ensure 'abi' is explicitly resolved to an Array
    const abi = Array.isArray(contractABI) 
      ? contractABI 
      : contractABI.abi 
      ? contractABI.abi 
      : contractABI.default;

    const wordleContract = new Contract(CONTRACT_ADDRESS, abi, signer);

    setContract(wordleContract);
    setAccount(accounts[0]);
  } catch (error) {
    console.error("Wallet connection failed:", error);
    alert("Contract connection failed. Check browser console for details.");
  }
};

  // Listen for the GuessSubmitted event to update the UI
  useEffect(() => {
    if (!contract || !account) return;

    const onGuessSubmitted = (player, round, guess, result, isCorrect, attemptsUsed) => {
      // Only process events triggered by the connected player
      if (player.toLowerCase() === account.toLowerCase()) {
        setGuesses((prev) => [...prev, { word: guess, result: Array.from(result) }]);
        setLoading(false);
        if (isCorrect) alert("You won!");
        else if (attemptsUsed >= 6) alert("Game Over! Max attempts reached.");
      }
    };

    contract.on("GuessSubmitted", onGuessSubmitted);

    // Cleanup listener on unmount
    return () => {
      contract.off("GuessSubmitted", onGuessSubmitted);
    };
  }, [contract, account]);

  // Submit the user's typed guess to the blockchain
  const submitGuess = async () => {
    if (currentGuess.length !== 5) return alert("Guess must be exactly 5 letters!");
    if (!contract) return alert("Connect wallet first!");

    setLoading(true);
    try {
      const tx = await contract.submitGuess(currentGuess.toUpperCase());
      await tx.wait(); // Wait for network confirmation
      setCurrentGuess("");
    } catch (error) {
      console.error(error);
      alert("Transaction failed. Check console for details.");
      setLoading(false);
    }
  };

  // Helper to assign CSS colors based on the uint8 Enum (0 = Gray, 1 = Yellow, 2 = Green)
const getTileColor = (status) => {
  const val = Number(status); // Converts 2n -> 2, 1n -> 1, 0n -> 0
  if (val === 2) return "#538d4e"; // Green
  if (val === 1) return "#b59f3b"; // Yellow
  if (val === 0) return "#3a3a3c"; // Gray
  return "transparent";
};

  return (
    <div style={{ textAlign: "center", fontFamily: "Arial", color: "white", backgroundColor: "#121213", minHeight: "100vh", padding: "20px" }}>
      <h1>On-Chain Wordle</h1>
      
      {!account ? (
        <button onClick={connectWallet} style={{ padding: "10px 20px", cursor: "pointer" }}>
          Connect Wallet
        </button>
      ) : (
        <p>Connected: {account.substring(0, 6)}...{account.substring(38)}</p>
      )}

      {/* 5x6 Game Grid */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", margin: "20px 0" }}>
        {[...Array(6)].map((_, rowIndex) => {
          const guessData = guesses[rowIndex];
          const word = guessData?.word || "";
          
          return (
            <div key={rowIndex} style={{ display: "flex", gap: "5px" }}>
              {[...Array(5)].map((_, colIndex) => {
                const letter = word[colIndex] || "";
                const bgColor = guessData ? getTileColor(guessData.result[colIndex]) : "transparent";

                return (
                  <div
                    key={colIndex}
                    style={{
                      width: "50px", height: "50px", border: "2px solid #3a3a3c",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "24px", fontWeight: "bold", textTransform: "uppercase",
                      backgroundColor: bgColor
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Input Controls */}
      {account && (
        <div style={{ marginTop: "20px" }}>
          <input
            type="text"
            maxLength={5}
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value)}
            disabled={loading}
            style={{ padding: "10px", fontSize: "16px", width: "150px", textTransform: "uppercase" }}
          />
          <button 
            onClick={submitGuess} 
            disabled={loading} 
            style={{ padding: "10px 20px", marginLeft: "10px", cursor: "pointer" }}
          >
            {loading ? "Confirming..." : "Submit Guess"}
          </button>
        </div>
      )}
    </div>
  );
}