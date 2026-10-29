import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers"; // <-- Add this line

describe("OnChainWordle Smart Contract Tests", function () {
  async function deployWordleFixture() {
    // FIX: Use hre.ethers explicitly instead of a destructured ethers variable
    const [owner, player1, player2] = await hre.ethers.getSigners();
    const WordleFactory = await hre.ethers.getContractFactory("OnChainWordle");
    
    const wordle = await WordleFactory.deploy("APPLE");
    await wordle.waitForDeployment();

    return { wordle, owner, player1, player2 };
  }

  // =========================================================================
  // 1. DEPLOYMENT & INITIAL STATE CHECKS
  // =========================================================================
  describe("Deployment & Initialization", function () {
    it("Should set the deployer as owner", async function () {
      const { wordle, owner } = await deployWordleFixture();
      expect(await wordle.owner()).to.equal(owner.address);
    });

    it("Should initialize round number to 1", async function () {
      const { wordle } = await deployWordleFixture();
      expect(await wordle.currentRound()).to.equal(1);
    });

    it("Should revert deployment if the initial word length is not 5", async function () {
      const WordleFactory = await ethers.getContractFactory("OnChainWordle");
      await expect(WordleFactory.deploy("FOUR")).to.be.revertedWith(
        "Word must be of size 5"
      );
    });
  });

  // =========================================================================
  // 2. CORE GAME LOGIC & WORD MATCHING (PASS 1 & PASS 2)
  // =========================================================================
  describe("Word Matching & Scoring Engine", function () {
    it("Should evaluate an exact win (all Greens = [2, 2, 2, 2, 2])", async function () {
      const { wordle, player1 } = await deployWordleFixture();

      const tx = await wordle.connect(player1).submitGuess("APPLE");
      const receipt = await tx.wait();

      // Extract emitted event (FIXED: replaced '=e>' with '=>')
      const event = receipt?.logs
        .map((l) => wordle.interface.parseLog(l))
        .find((p) => p?.name === "GuessSubmitted");

      expect(event?.args.isCorrect).to.equal(true);
      expect(event?.args.result.map(Number)).to.deep.equal([2, 2, 2, 2, 2]);
      
      // Verify database updated win state (FIXED: replaced '.qual' with '.equal')
      expect(await wordle.hasWon(player1.address, 1)).to.equal(true);
    });

    it("Should evaluate misplaced letters (Yellows & Grays = [1, 1, 1, 1, 0])", async function () {
      const { wordle, player1 } = await deployWordleFixture();

      // Secret: APPLE | Guess: PLEAD -> P(1), L(1), E(1), A(1), D(0)
      const tx = await wordle.connect(player1).submitGuess("PLEAD");
      const receipt = await tx.wait();

      const event = receipt?.logs
        .map((l) => wordle.interface.parseLog(l))
        .find((p) => p?.name === "GuessSubmitted");

      expect(event?.args.isCorrect).to.equal(false);
      expect(event?.args.result.map(Number)).to.deep.equal([1, 1, 1, 1, 0]);
    });

    it("Should handle duplicate letters correctly without over-crediting Yellows", async function () {
      const { wordle, owner, player1 } = await deployWordleFixture();
      
      // Set word to SMART (only one 'A')
      await wordle.connect(owner).setSecretWord("SMART");
      
      // Player guesses AAAAA against SMART
      const tx = await wordle.connect(player1).submitGuess("AAAAA");
      const receipt = await tx.wait();

      const event = receipt?.logs
        .map((l) => wordle.interface.parseLog(l))
        .find((p) => p?.name === "GuessSubmitted");

      // Only index 2 is exact Green match; others should be Gray (0), not Yellow (1)
      expect(event?.args.result.map(Number)).to.deep.equal([0, 0, 2, 0, 0]);
    });
  });

  // =========================================================================
  // 3. SECURITY & RULE ENFORCEMENT (REVERTS & LIMITS)
  // =========================================================================
  describe("Game Rule Enforcement & Reverts", function () {
    it("Should revert if guess length is not exactly 5 letters", async function () {
      const { wordle, player1 } = await deployWordleFixture();

      await expect(wordle.connect(player1).submitGuess("SHORT")).to.not.be.reverted;
      await expect(wordle.connect(player1).submitGuess("FAIL")).to.be.revertedWith(
        "Length of the guessed word must be 5"
      );
      await expect(wordle.connect(player1).submitGuess("LONGER")).to.be.revertedWith(
        "Length of the guessed word must be 5"
      );
    });

    it("Should prevent a player from guessing again after winning the round", async function () {
      const { wordle, player1 } = await deployWordleFixture();

      // First guess wins
      await wordle.connect(player1).submitGuess("APPLE");

      // Second guess must revert
      await expect(
        wordle.connect(player1).submitGuess("APPLE")
      ).to.be.revertedWith("Player has already won the Current Round");
    });

    it("Should enforce the 6-attempt cap and block 7th try", async function () {
      const { wordle, player1 } = await deployWordleFixture();

      // Submit 6 wrong guesses
      for (let i = 1; i <= 6; i++) {
        await wordle.connect(player1).submitGuess("WRONG");
        expect(await wordle.attempts(player1.address, 1)).to.equal(i);
      }

      // 7th guess must revert
      await expect(
        wordle.connect(player1).submitGuess("WRONG")
      ).to.be.revertedWith("Player has already used all of his 6 attempt");
    });
  });

  // =========================================================================
  // 4. ADMIN CONTROL & DAILY ROUND RESETS
  // =========================================================================
  describe("Admin Round Updates & Player Resets", function () {
    it("Should revert if non-owner tries to update the secret word", async function () {
      const { wordle, player1 } = await deployWordleFixture();

      await expect(
        wordle.connect(player1).setSecretWord("SMART")
      ).to.be.revertedWith("Only owner are allowed");
    });

    it("Should increment round and emit SecretWordUpdate event on word update", async function () {
      const { wordle, owner } = await deployWordleFixture();

      await expect(wordle.connect(owner).setSecretWord("SMART"))
        .to.emit(wordle, "SecretWordUpdate");

      expect(await wordle.currentRound()).to.equal(2);
    });

    it("Should grant fresh 6 attempts to a previously capped player when a new round starts", async function () {
      const { wordle, owner, player1 } = await deployWordleFixture();

      // Player exhausts 6 attempts in Round 1
      for (let i = 0; i < 6; i++) {
        await wordle.connect(player1).submitGuess("WRONG");
      }
      
      // Blocked on 7th try in Round 1
      await expect(
        wordle.connect(player1).submitGuess("WRONG")
      ).to.be.revertedWith("Player has already used all of his 6 attempt");

      // Admin sets new word for Round 2
      await wordle.connect(owner).setSecretWord("SMART");

      // Player can successfully guess again in Round 2
      await expect(wordle.connect(player1).submitGuess("SMART")).to.not.be.reverted;
      expect(await wordle.hasWon(player1.address, 2)).to.equal(true);
      expect(await wordle.attempts(player1.address, 2)).to.equal(1);
    });
  });
});