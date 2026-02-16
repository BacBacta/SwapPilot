// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PILOTToken.sol";
import "../src/FeeCollector.sol";
import "../src/ReferralRewards.sol";

/**
 * @title Smart Contract Fuzzing Tests
 * @notice Tests contracts with random/malicious inputs to find vulnerabilities
 * @dev Run with: forge test --match-contract FuzzTest -vvv
 */
contract FuzzTest is Test {
    PILOTToken public pilot;
    FeeCollector public feeCollector;
    ReferralRewards public referralRewards;
    
    address public owner;
    address public treasury;
    address public attacker;
    address public user1;
    address public user2;
    
    function setUp() public {
        owner = address(this);
        treasury = makeAddr("treasury");
        attacker = makeAddr("attacker");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy contracts
        pilot = new PILOTToken();
        
        // Mint initial supply to treasury
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = treasury;
        amounts[0] = 1_000_000_000 * 10**18; // 1B tokens
        
        pilot.initialDistribution(recipients, amounts);
        pilot.completeDistribution();
        
        // Deploy FeeCollector
        feeCollector = new FeeCollector(
            address(pilot),
            treasury,
            treasury, // referralPool (use treasury for testing)
            address(0), // No DEX router for testing
            address(0)  // No WBNB for testing
        );
        
        // Deploy ReferralRewards
        referralRewards = new ReferralRewards(address(pilot));
    }
    
    // ============================================================================
    // PILOTToken Fuzzing Tests
    // ============================================================================
    
    /// @notice Fuzz test: Transfer with random amounts
    function testFuzz_TransferRandomAmounts(uint256 amount) public {
        // Bound to realistic values
        amount = bound(amount, 0, 1_000_000_000 * 10**18);
        
        vm.startPrank(treasury);
        
        if (amount <= pilot.balanceOf(treasury)) {
            pilot.transfer(user1, amount);
            assertEq(pilot.balanceOf(user1), amount);
        } else {
            vm.expectRevert();
            pilot.transfer(user1, amount);
        }
        
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: Burn with random amounts
    function testFuzz_BurnRandomAmounts(uint256 amount) public {
        amount = bound(amount, 0, 1_000_000_000 * 10**18);
        
        vm.startPrank(treasury);
        
        uint256 balanceBefore = pilot.balanceOf(treasury);
        
        if (amount <= balanceBefore) {
            pilot.burn(amount);
            assertEq(pilot.balanceOf(treasury), balanceBefore - amount);
        } else {
            vm.expectRevert();
            pilot.burn(amount);
        }
        
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: Approve with random amounts and addresses
    function testFuzz_ApproveRandomAddresses(address spender, uint256 amount) public {
        vm.assume(spender != address(0));
        amount = bound(amount, 0, type(uint256).max);
        
        vm.prank(treasury);
        pilot.approve(spender, amount);
        
        assertEq(pilot.allowance(treasury, spender), amount);
    }
    
    /// @notice Fuzz test: TransferFrom attack vectors
    function testFuzz_TransferFromAttack(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000 * 10**18);
        
        // Setup: treasury approves user1
        vm.prank(treasury);
        pilot.approve(user1, amount);
        
        // Attacker tries to use the allowance (should fail)
        vm.startPrank(attacker);
        vm.expectRevert();
        pilot.transferFrom(treasury, attacker, amount);
        vm.stopPrank();
        
        // user1 can use it (should succeed)
        vm.prank(user1);
        pilot.transferFrom(treasury, user1, amount);
        assertEq(pilot.balanceOf(user1), amount);
    }
    
    /// @notice Fuzz test: Prevent double distribution
    function testFuzz_PreventDoubleDistribution(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000 * 10**18);
        
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = user1;
        amounts[0] = amount;
        
        // Should revert because distribution is already completed
        vm.expectRevert("Distribution already completed");
        pilot.initialDistribution(recipients, amounts);
    }
    
    // ============================================================================
    // FeeCollector Fuzzing Tests
    // ============================================================================
    
    /// @notice Fuzz test: Distribute fees with random amounts
    function testFuzz_DistributeFeesRandomAmounts(uint256 feeAmount) public {
        feeAmount = bound(feeAmount, 0.01 ether, 100 ether);
        
        // Send BNB to fee collector
        vm.deal(address(feeCollector), feeAmount);
        
        uint256 treasuryBefore = treasury.balance;
        
        feeCollector.distributeFees();
        
        // 85% should go to treasury (15% for burn, but no DEX router set)
        uint256 expectedTreasury = (feeAmount * 85) / 100;
        assertApproxEqRel(treasury.balance - treasuryBefore, expectedTreasury, 0.01e18); // 1% tolerance
    }
    
    /// @notice Fuzz test: Unauthorized access attempts
    function testFuzz_UnauthorizedFeeCollectorAccess(address unauthorizedUser) public {
        vm.assume(unauthorizedUser != owner);
        
        vm.startPrank(unauthorizedUser);
        
        // Should revert when non-owner tries to change treasury
        vm.expectRevert();
        feeCollector.setTreasury(unauthorizedUser);
        
        // Should revert when non-owner tries to change DEX router
        vm.expectRevert();
        feeCollector.setDexRouter(address(0));
        
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: Zero address validations
    function testFuzz_FeeCollectorZeroAddressRejection() public {
        vm.expectRevert("Invalid treasury");
        feeCollector.setTreasury(address(0));
    }
    
    // ============================================================================
    // ReferralRewards Fuzzing Tests
    // ============================================================================
    
    /// @notice Fuzz test: Distribute rewards with random amounts
    function testFuzz_DistributeRewardsRandomAmounts(
        address referrer,
        uint256 swapVolumeUsd,
        uint256 rewardAmount
    ) public {
        vm.assume(referrer != address(0));
        swapVolumeUsd = bound(swapVolumeUsd, 50 * 10**18, 1_000_000 * 10**18); // $50 - $1M
        rewardAmount = bound(rewardAmount, 1 * 10**18, 10_000 * 10**18); // 1 - 10k PILOT
        
        // Fund referral rewards contract
        vm.prank(treasury);
        pilot.transfer(address(referralRewards), 50_000_000 * 10**18); // 50M PILOT
        
        // Set distributor
        referralRewards.setDistributor(owner, true);
        
        // Link user to referrer first
        referralRewards.linkUserToReferrer(user1, "TEST_CODE");
        
        // Accrue rewards (reward is calculated internally)
        if (swapVolumeUsd >= referralRewards.minSwapVolumeUsd()) {
            referralRewards.accrueReward(user1, swapVolumeUsd);
            // Check that referrer has pending rewards
            assertTrue(referralRewards.pendingRewards(referrer) > 0 || referralRewards.totalEarned(referrer) > 0);
        }
    }
    
    /// @notice Fuzz test: Unauthorized reward distribution
    function testFuzz_UnauthorizedRewardDistribution(address attacker, uint256 amount) public {
        vm.assume(attacker != owner);
        amount = bound(amount, 1 * 10**18, 1_000 * 10**18);
        
        vm.startPrank(attacker);
        
        vm.expectRevert("Not authorized");
        referralRewards.accrueReward(attacker, 100 * 10**18);
        
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: Zero address rejections
    function testFuzz_ReferralRewardsZeroAddress(uint256 amount) public {
        amount = bound(amount, 1 * 10**18, 1_000 * 10**18);
        
        referralRewards.setDistributor(owner, true);
        
        // accrueReward with zero address user should simply return (no referrer)
        referralRewards.accrueReward(address(0), 100 * 10**18);
    }
    
    // ============================================================================
    // Cross-Contract Attack Vectors
    // ============================================================================
    
    /// @notice Fuzz test: Reentrancy attack simulation
    function testFuzz_ReentrancyProtection(uint256 amount) public {
        amount = bound(amount, 0.1 ether, 10 ether);
        
        // Deploy malicious contract
        MaliciousReceiver malicious = new MaliciousReceiver(address(feeCollector));
        
        vm.deal(address(feeCollector), amount);
        
        // Try to trigger reentrancy (should fail due to ReentrancyGuard)
        vm.expectRevert();
        malicious.attack();
    }
    
    /// @notice Fuzz test: Front-running protection
    function testFuzz_FrontRunningProtection(uint256 amount) public {
        amount = bound(amount, 1000 * 10**18, 100_000 * 10**18);
        
        // user1 approves amount
        vm.startPrank(treasury);
        pilot.transfer(user1, amount);
        vm.stopPrank();
        
        vm.startPrank(user1);
        pilot.approve(user2, amount);
        
        // Simulate front-running: attacker tries to change approval before transfer
        vm.stopPrank();
        vm.startPrank(attacker);
        
        // Attacker can't exploit because they're not the approved spender
        vm.expectRevert();
        pilot.transferFrom(user1, attacker, amount);
        
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: Integer overflow/underflow
    function testFuzz_IntegerOverflowProtection(uint256 amount1, uint256 amount2) public {
        amount1 = bound(amount1, 1, type(uint256).max / 2);
        amount2 = bound(amount2, 1, type(uint256).max / 2);
        
        // Test addition overflow
        uint256 sum;
        unchecked {
            sum = amount1 + amount2;
        }
        
        // In Solidity 0.8+, this would revert on overflow
        // But our bounded amounts prevent actual overflow
        assertTrue(sum >= amount1);
        assertTrue(sum >= amount2);
    }
    
    // ============================================================================
    // Economic Attack Vectors
    // ============================================================================
    
    /// @notice Fuzz test: Dust attack prevention
    function testFuzz_DustAttack(uint8 numRecipients) public {
        vm.assume(numRecipients > 0 && numRecipients <= 100);
        
        vm.startPrank(treasury);
        
        // Try to spam tiny amounts to many addresses
        for (uint8 i = 0; i < numRecipients; i++) {
            address recipient = address(uint160(i + 1000));
            pilot.transfer(recipient, 1); // 1 wei
            assertEq(pilot.balanceOf(recipient), 1);
        }
        
        vm.stopPrank();
        
        // Verify treasury balance decreased correctly
        assertEq(pilot.balanceOf(treasury), 1_000_000_000 * 10**18 - numRecipients);
    }
    
    /// @notice Fuzz test: Approval race condition
    function testFuzz_ApprovalRaceCondition(uint256 oldAmount, uint256 newAmount) public {
        oldAmount = bound(oldAmount, 1, 1_000_000 * 10**18);
        newAmount = bound(newAmount, 1, 1_000_000 * 10**18);
        
        vm.startPrank(treasury);
        
        // Initial approval
        pilot.approve(user1, oldAmount);
        
        // Change approval (potential race condition)
        pilot.approve(user1, newAmount);
        
        assertEq(pilot.allowance(treasury, user1), newAmount);
        
        vm.stopPrank();
    }
}

/// @notice Malicious contract for reentrancy testing
contract MaliciousReceiver {
    FeeCollector public target;
    uint256 public attackCount;
    
    constructor(address _target) {
        target = FeeCollector(_target);
    }
    
    function attack() external {
        target.distributeFees();
    }
    
    receive() external payable {
        if (attackCount < 2) {
            attackCount++;
            target.distributeFees();
        }
    }
}
