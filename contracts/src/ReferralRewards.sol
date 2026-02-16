// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapPilot Referral Rewards
 * @notice Manages referral rewards paid in PILOT tokens
 * 
 * Tokenomics:
 * - 5% of PILOT total supply (50,000,000 PILOT) allocated for referral rewards
 * - Referrers earn PILOT when their referrals make swaps
 * - Rewards are distributed based on swap volume
 * 
 * How it works:
 * 1. Referrer generates a referral code (off-chain, verified on-chain)
 * 2. New user signs up with referral code
 * 3. When referred user swaps, referrer earns PILOT rewards
 * 4. Rewards accrue and can be claimed at any time
 */
contract ReferralRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice PILOT token
    IERC20 public immutable pilotToken;

    /// @notice Total PILOT allocated for referrals (5% of 1B = 50M)
    uint256 public constant REFERRAL_ALLOCATION = 50_000_000 * 10**18;

    /// @notice Reward rate: PILOT tokens per $1 of swap volume
    /// Default: 0.1 PILOT per $1 swapped (adjustable by owner)
    uint256 public rewardRatePerDollar = 0.1 * 10**18;

    /// @notice Minimum swap volume in USD (scaled by 1e18) to trigger reward
    uint256 public minSwapVolumeUsd = 10 * 10**18; // $10 minimum

    /// @notice Maximum reward per swap (prevents exploitation)
    uint256 public maxRewardPerSwap = 1000 * 10**18; // 1000 PILOT max

    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;

    /// @notice Authorized distributors (API backend)
    mapping(address => bool) public distributors;

    /// @notice Referral links: referrer => referral code hash
    mapping(address => bytes32) public referrerCodes;

    /// @notice Reverse lookup: code hash => referrer
    mapping(bytes32 => address) public codeToReferrer;

    /// @notice Track referred users: user => referrer
    mapping(address => address) public userReferrer;

    /// @notice Pending rewards per referrer
    mapping(address => uint256) public pendingRewards;

    /// @notice Total earned by referrer (historical)
    mapping(address => uint256) public totalEarned;

    /// @notice Total volume referred by referrer (in USD, scaled 1e18)
    mapping(address => uint256) public referredVolume;

    /// @notice Number of users referred
    mapping(address => uint256) public referralCount;

    // Events
    event ReferralCodeCreated(address indexed referrer, bytes32 codeHash);
    event UserReferred(address indexed user, address indexed referrer);
    event RewardAccrued(address indexed referrer, address indexed user, uint256 swapVolumeUsd, uint256 rewardAmount);
    event RewardsClaimed(address indexed referrer, uint256 amount);
    event DistributorUpdated(address indexed distributor, bool authorized);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);

    modifier onlyDistributor() {
        require(distributors[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address _pilotToken) Ownable(msg.sender) {
        require(_pilotToken != address(0), "Invalid PILOT address");
        pilotToken = IERC20(_pilotToken);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REFERRAL CODE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a referral code for a referrer
     * @param code The referral code (e.g., "ALICE123")
     */
    function registerReferralCode(string calldata code) external {
        require(bytes(code).length >= 3 && bytes(code).length <= 20, "Code must be 3-20 chars");
        
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        require(codeToReferrer[codeHash] == address(0), "Code already taken");
        
        // Clear old code if exists
        bytes32 oldCode = referrerCodes[msg.sender];
        if (oldCode != bytes32(0)) {
            delete codeToReferrer[oldCode];
        }
        
        referrerCodes[msg.sender] = codeHash;
        codeToReferrer[codeHash] = msg.sender;
        
        emit ReferralCodeCreated(msg.sender, codeHash);
    }

    /**
     * @notice Link a user to a referrer using a referral code
     * @param user The user being referred
     * @param code The referral code
     */
    function linkUserToReferrer(address user, string calldata code) external onlyDistributor {
        require(userReferrer[user] == address(0), "User already has referrer");
        
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        address referrer = codeToReferrer[codeHash];
        require(referrer != address(0), "Invalid referral code");
        require(referrer != user, "Cannot refer yourself");
        
        userReferrer[user] = referrer;
        referralCount[referrer]++;
        
        emit UserReferred(user, referrer);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REWARD DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Accrue referral reward for a swap
     * @param user The user who made the swap
     * @param swapVolumeUsd Swap volume in USD (scaled by 1e18)
     */
    function accrueReward(address user, uint256 swapVolumeUsd) external onlyDistributor {
        address referrer = userReferrer[user];
        if (referrer == address(0)) return; // No referrer, no reward
        if (swapVolumeUsd < minSwapVolumeUsd) return; // Below minimum
        
        // Check allocation remaining
        uint256 remaining = getRemainingAllocation();
        if (remaining == 0) return;
        
        // Calculate reward
        uint256 reward = (swapVolumeUsd * rewardRatePerDollar) / 10**18;
        if (reward > maxRewardPerSwap) {
            reward = maxRewardPerSwap;
        }
        if (reward > remaining) {
            reward = remaining;
        }
        
        // Accrue reward
        pendingRewards[referrer] += reward;
        totalEarned[referrer] += reward;
        referredVolume[referrer] += swapVolumeUsd;
        totalRewardsDistributed += reward;
        
        emit RewardAccrued(referrer, user, swapVolumeUsd, reward);
    }

    /**
     * @notice Claim pending rewards
     */
    function claimRewards() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards to claim");
        
        pendingRewards[msg.sender] = 0;
        pilotToken.safeTransfer(msg.sender, amount);
        
        emit RewardsClaimed(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get remaining PILOT allocation for referrals
     */
    function getRemainingAllocation() public view returns (uint256) {
        uint256 balance = pilotToken.balanceOf(address(this));
        if (balance > REFERRAL_ALLOCATION) {
            return REFERRAL_ALLOCATION - totalRewardsDistributed;
        }
        return balance;
    }

    /**
     * @notice Get referrer stats
     */
    function getReferrerStats(address referrer) external view returns (
        uint256 pending,
        uint256 totalEarnedAmount,
        uint256 volumeReferred,
        uint256 usersReferred,
        bytes32 codeHash
    ) {
        return (
            pendingRewards[referrer],
            totalEarned[referrer],
            referredVolume[referrer],
            referralCount[referrer],
            referrerCodes[referrer]
        );
    }

    /**
     * @notice Check if a referral code is available
     */
    function isCodeAvailable(string calldata code) external view returns (bool) {
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        return codeToReferrer[codeHash] == address(0);
    }

    /**
     * @notice Get referrer address from code
     */
    function getReferrerFromCode(string calldata code) external view returns (address) {
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        return codeToReferrer[codeHash];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set distributor authorization
     */
    function setDistributor(address distributor, bool authorized) external onlyOwner {
        distributors[distributor] = authorized;
        emit DistributorUpdated(distributor, authorized);
    }

    /**
     * @notice Update reward rate
     * @param newRatePerDollar New rate in PILOT per $1 (scaled 1e18)
     */
    function setRewardRate(uint256 newRatePerDollar) external onlyOwner {
        uint256 oldRate = rewardRatePerDollar;
        rewardRatePerDollar = newRatePerDollar;
        emit RewardRateUpdated(oldRate, newRatePerDollar);
    }

    /**
     * @notice Update minimum swap volume
     */
    function setMinSwapVolume(uint256 minVolumeUsd) external onlyOwner {
        minSwapVolumeUsd = minVolumeUsd;
    }

    /**
     * @notice Update maximum reward per swap
     */
    function setMaxRewardPerSwap(uint256 maxReward) external onlyOwner {
        maxRewardPerSwap = maxReward;
    }

    /**
     * @notice Emergency withdraw (owner only, for migration)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }
}
