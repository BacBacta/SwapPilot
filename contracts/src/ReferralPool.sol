// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapPilot Referral Pool
 * @notice Manages referral rewards distribution and claiming
 * @dev Receives BNB from FeeCollector and allows referrers to claim their share
 */
contract ReferralPool is Ownable, ReentrancyGuard {
    
    /// @notice Pending rewards per referrer (in wei)
    mapping(address => uint256) public pendingRewards;
    
    /// @notice Total claimed by each referrer
    mapping(address => uint256) public totalClaimed;
    
    /// @notice Total rewards allocated
    uint256 public totalAllocated;
    
    /// @notice Total rewards claimed
    uint256 public totalClaimedAmount;
    
    /// @notice Minimum claim amount (to prevent dust claims, default 0.001 BNB)
    uint256 public minClaimAmount = 0.001 ether;
    
    /// @notice Referral code to address mapping
    mapping(bytes32 => address) public referralCodes;
    
    /// @notice Address to referral code mapping (reverse lookup)
    mapping(address => bytes32) public addressToCode;
    
    /// @notice Emitted when rewards are allocated to a referrer
    event RewardsAllocated(address indexed referrer, uint256 amount);
    
    /// @notice Emitted when a referrer claims their rewards
    event RewardsClaimed(address indexed referrer, uint256 amount);
    
    /// @notice Emitted when a referral code is registered
    event ReferralCodeRegistered(address indexed referrer, bytes32 code);
    
    /// @notice Emitted when BNB is received
    event Received(address indexed from, uint256 amount);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Receive BNB (from FeeCollector or direct deposits)
     */
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
    
    /**
     * @notice Register a referral code for the caller
     * @param code The referral code (keccak256 hash of the code string)
     */
    function registerReferralCode(bytes32 code) external {
        require(code != bytes32(0), "Invalid code");
        require(referralCodes[code] == address(0), "Code already registered");
        require(addressToCode[msg.sender] == bytes32(0), "Already has a code");
        
        referralCodes[code] = msg.sender;
        addressToCode[msg.sender] = code;
        
        emit ReferralCodeRegistered(msg.sender, code);
    }
    
    /**
     * @notice Allocate rewards to a referrer (owner only)
     * @param referrer The referrer's address
     * @param amount The amount of BNB (wei) to allocate
     */
    function allocateRewards(address referrer, uint256 amount) external onlyOwner {
        require(referrer != address(0), "Invalid referrer");
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= totalAllocated - totalClaimedAmount + amount, "Insufficient balance");
        
        pendingRewards[referrer] += amount;
        totalAllocated += amount;
        
        emit RewardsAllocated(referrer, amount);
    }
    
    /**
     * @notice Batch allocate rewards to multiple referrers
     * @param referrers Array of referrer addresses
     * @param amounts Array of amounts to allocate
     */
    function batchAllocateRewards(
        address[] calldata referrers, 
        uint256[] calldata amounts
    ) external onlyOwner {
        require(referrers.length == amounts.length, "Length mismatch");
        
        uint256 totalToAllocate = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalToAllocate += amounts[i];
        }
        
        require(
            address(this).balance >= totalAllocated - totalClaimedAmount + totalToAllocate, 
            "Insufficient balance"
        );
        
        for (uint256 i = 0; i < referrers.length; i++) {
            require(referrers[i] != address(0), "Invalid referrer");
            pendingRewards[referrers[i]] += amounts[i];
            totalAllocated += amounts[i];
            emit RewardsAllocated(referrers[i], amounts[i]);
        }
    }
    
    /**
     * @notice Claim pending rewards
     */
    function claim() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount >= minClaimAmount, "Amount below minimum");
        
        pendingRewards[msg.sender] = 0;
        totalClaimed[msg.sender] += amount;
        totalClaimedAmount += amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit RewardsClaimed(msg.sender, amount);
    }
    
    /**
     * @notice Get referrer info
     * @param referrer The referrer's address
     * @return pending Pending rewards
     * @return claimed Total claimed
     * @return code Referral code
     */
    function getReferrerInfo(address referrer) external view returns (
        uint256 pending,
        uint256 claimed,
        bytes32 code
    ) {
        return (
            pendingRewards[referrer],
            totalClaimed[referrer],
            addressToCode[referrer]
        );
    }
    
    /**
     * @notice Get pool stats
     * @return balance Current BNB balance
     * @return allocated Total allocated
     * @return claimed Total claimed
     * @return available Available to allocate
     */
    function getPoolStats() external view returns (
        uint256 balance,
        uint256 allocated,
        uint256 claimed,
        uint256 available
    ) {
        uint256 _balance = address(this).balance;
        uint256 _pending = totalAllocated - totalClaimedAmount;
        return (
            _balance,
            totalAllocated,
            totalClaimedAmount,
            _balance > _pending ? _balance - _pending : 0
        );
    }
    
    /**
     * @notice Set minimum claim amount
     * @param _minClaimAmount New minimum (in wei)
     */
    function setMinClaimAmount(uint256 _minClaimAmount) external onlyOwner {
        minClaimAmount = _minClaimAmount;
    }
    
    /**
     * @notice Emergency withdraw (owner only)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Lookup referrer by code
     * @param code The referral code
     * @return The referrer's address (address(0) if not found)
     */
    function getReferrerByCode(bytes32 code) external view returns (address) {
        return referralCodes[code];
    }
}
