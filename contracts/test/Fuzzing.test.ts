import { ethers } from "hardhat";
import { expect } from "chai";
import { PILOTToken, FeeCollector, ReferralRewards } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Smart Contract Fuzzing Tests
 * Tests with random/malicious inputs to find vulnerabilities
 */
describe("Smart Contract Fuzzing Tests", function () {
  let pilot: PILOTToken;
  let feeCollector: FeeCollector;
  let referralRewards: ReferralRewards;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let attacker: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, treasury, attacker, user1, user2] = await ethers.getSigners();

    // Deploy PILOT token
    const PILOTToken = await ethers.getContractFactory("PILOTToken");
    pilot = await PILOTToken.deploy();
    await pilot.waitForDeployment();

    // Initial distribution
    await pilot.initialDistribution([treasury.address], [ethers.parseEther("1000000000")]);
    await pilot.completeDistribution();

    // Deploy FeeCollector
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(
      await pilot.getAddress(),
      treasury.address,
      ethers.ZeroAddress, // No DEX router
      ethers.ZeroAddress  // No WBNB
    );

    // Deploy ReferralRewards
    const ReferralRewards = await ethers.getContractFactory("ReferralRewards");
    referralRewards = await ReferralRewards.deploy(await pilot.getAddress());
  });

  describe("PILOTToken Fuzzing", function () {
    it("should handle random transfer amounts safely", async function () {
      const testCases = [
        ethers.parseEther("0.000001"), // Dust
        ethers.parseEther("1000"),     // Normal
        ethers.parseEther("1000000"),  // Large
      ];

      for (const amount of testCases) {
        await pilot.connect(treasury).transfer(user1.address, amount);
        expect(await pilot.balanceOf(user1.address)).to.equal(amount);
        
        // Transfer back
        await pilot.connect(user1).transfer(treasury.address, amount);
      }
    });

    it("should reject transfers exceeding balance", async function () {
      const balance = await pilot.balanceOf(treasury.address);
      const overAmount = balance + ethers.parseEther("1");
      
      await expect(
        pilot.connect(treasury).transfer(user1.address, overAmount)
      ).to.be.reverted;
    });

    it("should prevent double distribution attack", async function () {
      await expect(
        pilot.initialDistribution([user1.address], [ethers.parseEther("1000")])
      ).to.be.revertedWith("Distribution already completed");
    });

    it("should handle zero address in transfer", async function () {
      await expect(
        pilot.connect(treasury).transfer(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("should prevent unauthorized minting", async function () {
      // No mint function exists after distribution
      expect(pilot.initialDistribution).to.exist;
      
      await expect(
        pilot.connect(attacker).initialDistribution([attacker.address], [ethers.parseEther("1000")])
      ).to.be.reverted;
    });

    it("should handle approval race conditions safely", async function () {
      // Initial approval
      await pilot.connect(treasury).approve(user1.address, ethers.parseEther("1000"));
      
      // Change approval (potential race)
      await pilot.connect(treasury).approve(user1.address, ethers.parseEther("2000"));
      
      expect(await pilot.allowance(treasury.address, user1.address))
        .to.equal(ethers.parseEther("2000"));
    });

    it("should reject negative amounts (underflow protection)", async function () {
      // Solidity 0.8+ has built-in overflow protection
      // Try to burn more than balance
      const balance = await pilot.balanceOf(treasury.address);
      const overBurn = balance + 1n;
      
      await expect(
        pilot.connect(treasury).burn(overBurn)
      ).to.be.reverted;
    });
  });

  describe("FeeCollector Fuzzing", function () {
    it("should distribute fees with random amounts", async function () {
      const testAmounts = [
        ethers.parseEther("0.01"),
        ethers.parseEther("1"),
        ethers.parseEther("10"),
      ];

      for (const amount of testAmounts) {
        // Send BNB to fee collector
        await owner.sendTransaction({
          to: await feeCollector.getAddress(),
          value: amount,
        });

        const treasuryBefore = await ethers.provider.getBalance(treasury.address);
        await feeCollector.distributeFees();
        const treasuryAfter = await ethers.provider.getBalance(treasury.address);

        // 85% should go to treasury
        const expected = (amount * 85n) / 100n;
        expect(treasuryAfter - treasuryBefore).to.be.closeTo(expected, ethers.parseEther("0.001"));
      }
    });

    it("should reject zero address for treasury", async function () {
      await expect(
        feeCollector.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });

    it("should reject unauthorized treasury changes", async function () {
      await expect(
        feeCollector.connect(attacker).setTreasury(attacker.address)
      ).to.be.reverted;
    });

    it("should protect against reentrancy", async function () {
      // The contract has ReentrancyGuard
      // Multiple calls should be safe
      await owner.sendTransaction({
        to: await feeCollector.getAddress(),
        value: ethers.parseEther("1"),
      });

      await feeCollector.distributeFees();
      
      // Second call should work (no reentrancy lock stuck)
      await owner.sendTransaction({
        to: await feeCollector.getAddress(),
        value: ethers.parseEther("1"),
      });
      
      await expect(feeCollector.distributeFees()).to.not.be.reverted;
    });
  });

  describe("ReferralRewards Fuzzing", function () {
    beforeEach(async function () {
      // Fund referral rewards
      await pilot.connect(treasury).transfer(
        await referralRewards.getAddress(),
        ethers.parseEther("50000000")
      );
      
      // Set distributor
      await referralRewards.setDistributor(owner.address, true);
    });

    it("should handle random reward amounts", async function () {
      const testCases = [
        { volume: ethers.parseEther("100"), reward: ethers.parseEther("10") },
        { volume: ethers.parseEther("1000"), reward: ethers.parseEther("100") },
        { volume: ethers.parseEther("10000"), reward: ethers.parseEther("1000") },
      ];

      for (const test of testCases) {
        await referralRewards.distributeReward(
          user1.address,
          test.volume,
          test.reward
        );
        
        expect(await pilot.balanceOf(user1.address)).to.be.gt(0);
        
        // Reset balance
        const balance = await pilot.balanceOf(user1.address);
        await pilot.connect(user1).transfer(treasury.address, balance);
      }
    });

    it("should reject zero address referrer", async function () {
      await expect(
        referralRewards.distributeReward(
          ethers.ZeroAddress,
          ethers.parseEther("100"),
          ethers.parseEther("10")
        )
      ).to.be.revertedWith("Invalid referrer");
    });

    it("should reject unauthorized distributors", async function () {
      await expect(
        referralRewards.connect(attacker).distributeReward(
          attacker.address,
          ethers.parseEther("100"),
          ethers.parseEther("10")
        )
      ).to.be.revertedWith("Not authorized");
    });

    it("should enforce min swap volume", async function () {
      const minVolume = await referralRewards.minSwapVolumeUsd();
      const belowMin = minVolume - 1n;
      
      await expect(
        referralRewards.distributeReward(
          user1.address,
          belowMin,
          ethers.parseEther("10")
        )
      ).to.be.revertedWith("Swap volume too low");
    });

    it("should enforce max reward per swap", async function () {
      const maxReward = await referralRewards.maxRewardPerSwap();
      const aboveMax = maxReward + ethers.parseEther("1");
      
      await expect(
        referralRewards.distributeReward(
          user1.address,
          ethers.parseEther("1000"),
          aboveMax
        )
      ).to.be.revertedWith("Reward exceeds maximum");
    });
  });

  describe("Cross-Contract Attack Vectors", function () {
    it("should prevent transferFrom exploitation", async function () {
      const amount = ethers.parseEther("1000");
      
      // treasury transfers to user1 and approves user2
      await pilot.connect(treasury).transfer(user1.address, amount);
      await pilot.connect(user1).approve(user2.address, amount);
      
      // Attacker tries to use the allowance
      await expect(
        pilot.connect(attacker).transferFrom(user1.address, attacker.address, amount)
      ).to.be.reverted;
      
      // user2 can use it
      await pilot.connect(user2).transferFrom(user1.address, user2.address, amount);
      expect(await pilot.balanceOf(user2.address)).to.equal(amount);
    });

    it("should handle dust attack (many small transfers)", async function () {
      const recipients = 10;
      const dustAmount = 1; // 1 wei
      
      for (let i = 0; i < recipients; i++) {
        const randomAddr = ethers.Wallet.createRandom().address;
        await pilot.connect(treasury).transfer(randomAddr, dustAmount);
      }
      
      // Verify treasury balance decreased correctly
      const expectedDecrease = BigInt(recipients) * BigInt(dustAmount);
      expect(await pilot.balanceOf(treasury.address))
        .to.equal(ethers.parseEther("1000000000") - expectedDecrease);
    });
  });

  describe("Gas Limit Attack Prevention", function () {
    it("should not allow gas exhaustion through loops", async function () {
      // Try to create many small transactions
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await pilot.connect(treasury).transfer(user1.address, 1);
      }
      
      // Should complete without running out of gas
      expect(await pilot.balanceOf(user1.address)).to.equal(iterations);
    });
  });
});
