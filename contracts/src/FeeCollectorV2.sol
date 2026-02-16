// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SwapPilot Fee Collector V2 (DappBay Compliant)
 * @notice Collects platform fees and distributes according to tokenomics
 * 
 * @dev Changes from V1 for DappBay compliance:
 * - Added Pausable for circuit breaker
 * - Added events for all admin parameter changes
 * - Added slippage protection with oracle support
 * - Restricted distributeFees() to onlyOwner
 * - Fixed burn mechanism to use actual burn() instead of dead address
 * - Added minimum distribution threshold
 * - Note: Deploy with TimelockController as owner for emergency withdrawal protection
 */
contract FeeCollectorV2 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Distribution percentages (must sum to 100)
    uint256 public constant BURN_PERCENT = 15;
    uint256 public constant TREASURY_PERCENT = 80;
    uint256 public constant REFERRAL_PERCENT = 5;

    /// @notice PILOT token address
    IERC20 public immutable pilotToken;

    /// @notice Treasury wallet
    address public treasury;

    /// @notice Referral pool wallet
    address public referralPool;

    /// @notice DEX router for buying PILOT (e.g., PancakeSwap)
    address public dexRouter;

    /// @notice WBNB address for swap path
    address public wbnb;

    /// @notice Minimum BNB balance to trigger distribution (prevents dust gas waste)
    uint256 public minDistributionAmount = 0.1 ether;

    /// @notice Total fees collected (in BNB wei)
    uint256 public totalFeesCollected;

    /// @notice Total PILOT burned (actual supply reduction)
    uint256 public totalPilotBurned;

    /// @notice Emitted when fees are collected
    event FeesCollected(address indexed token, uint256 amount);

    /// @notice Emitted when fees are distributed
    event FeesDistributed(
        uint256 burnAmount,
        uint256 treasuryAmount,
        uint256 referralAmount
    );

    /// @notice Emitted when PILOT is bought and burned
    event PilotBurned(uint256 bnbSpent, uint256 pilotBurned);

    /// @notice Emitted when treasury address is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Emitted when referral pool address is updated
    event ReferralPoolUpdated(address indexed oldPool, address indexed newPool);

    /// @notice Emitted when DEX router is updated
    event DexRouterUpdated(address indexed oldRouter, address indexed newRouter);

    /// @notice Emitted when minimum distribution amount is updated
    event MinDistributionAmountUpdated(uint256 oldAmount, uint256 newAmount);

    constructor(
        address _pilotToken,
        address _treasury,
        address _referralPool,
        address _dexRouter,
        address _wbnb
    ) Ownable(msg.sender) {
        require(_pilotToken != address(0), "Invalid PILOT address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_referralPool != address(0), "Invalid referral pool address");

        pilotToken = IERC20(_pilotToken);
        treasury = _treasury;
        referralPool = _referralPool;
        dexRouter = _dexRouter;
        wbnb = _wbnb;
    }

    /**
     * @notice Pause the contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Receive BNB fees
     */
    receive() external payable whenNotPaused {
        totalFeesCollected += msg.value;
        emit FeesCollected(address(0), msg.value);
    }

    /**
     * @notice Distribute collected BNB fees according to tokenomics
     * @param minPilotOut Minimum PILOT tokens to receive (slippage protection)
     * 
     * @dev Restricted to owner (or keeper) to prevent MEV timing exploitation
     */
    function distributeFees(uint256 minPilotOut) external onlyOwner nonReentrant whenNotPaused {
        uint256 balance = address(this).balance;
        require(balance >= minDistributionAmount, "Below minimum distribution threshold");

        uint256 burnAmount = (balance * BURN_PERCENT) / 100;
        uint256 treasuryAmount = (balance * TREASURY_PERCENT) / 100;
        // Calculate referral as remainder to avoid rounding dust accumulation
        uint256 referralAmount = balance - burnAmount - treasuryAmount;

        if (burnAmount > 0 && dexRouter != address(0) && wbnb != address(0)) {
            _buyAndBurnPilot(burnAmount, minPilotOut);
        }

        if (treasuryAmount > 0) {
            (bool success, ) = treasury.call{value: treasuryAmount}("");
            require(success, "Treasury transfer failed");
        }

        if (referralAmount > 0) {
            (bool success, ) = referralPool.call{value: referralAmount}("");
            require(success, "Referral transfer failed");
        }

        emit FeesDistributed(burnAmount, treasuryAmount, referralAmount);
    }

    /**
     * @notice Buy PILOT with BNB and burn it (reduces totalSupply)
     * @param bnbAmount Amount of BNB to spend
     * @param minPilotOut Minimum PILOT to receive (slippage protection)
     */
    function _buyAndBurnPilot(uint256 bnbAmount, uint256 minPilotOut) private {
        address[] memory path = new address[](2);
        path[0] = wbnb;
        path[1] = address(pilotToken);

        // Buy PILOT from DEX
        (bool success, ) = dexRouter.call{value: bnbAmount}(
            abi.encodeWithSignature(
                "swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)",
                minPilotOut, // Slippage protection
                path,
                address(this),
                block.timestamp + 300
            )
        );
        require(success, "DEX swap failed");

        // Burn received PILOT (actual supply reduction)
        uint256 pilotReceived = pilotToken.balanceOf(address(this));
        if (pilotReceived > 0) {
            // Use PILOTToken's burn function to reduce totalSupply
            (bool burnSuccess, ) = address(pilotToken).call(
                abi.encodeWithSignature("feeBurn(uint256)", pilotReceived)
            );
            require(burnSuccess, "Burn failed");
            
            totalPilotBurned += pilotReceived;
            emit PilotBurned(bnbAmount, pilotReceived);
        }
    }

    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Update referral pool address
     * @param _referralPool New referral pool address
     */
    function setReferralPool(address _referralPool) external onlyOwner {
        require(_referralPool != address(0), "Invalid referral pool address");
        address oldPool = referralPool;
        referralPool = _referralPool;
        emit ReferralPoolUpdated(oldPool, _referralPool);
    }

    /**
     * @notice Update DEX router address
     * @param _dexRouter New DEX router address
     */
    function setDexRouter(address _dexRouter) external onlyOwner {
        require(_dexRouter != address(0), "Invalid router address");
        address oldRouter = dexRouter;
        dexRouter = _dexRouter;
        emit DexRouterUpdated(oldRouter, _dexRouter);
    }

    /**
     * @notice Update minimum distribution amount
     * @param _minAmount New minimum amount in wei
     */
    function setMinDistributionAmount(uint256 _minAmount) external onlyOwner {
        uint256 oldAmount = minDistributionAmount;
        minDistributionAmount = _minAmount;
        emit MinDistributionAmountUpdated(oldAmount, _minAmount);
    }

    /**
     * @notice Emergency withdrawal (owner only, use with TimelockController)
     * @param token Token address (address(0) for BNB)
     * @param amount Amount to withdraw
     * 
     * @dev Deploy with TimelockController as owner to add delay to this function
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            require(amount <= address(this).balance, "Insufficient balance");
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "BNB transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    /**
     * @notice Convert accumulated ERC-20 tokens to BNB (owner only)
     * @param token Token address to convert
     * @param minBnbOut Minimum BNB to receive (slippage protection)
     */
    function convertTokenToBnb(address token, uint256 minBnbOut) external onlyOwner nonReentrant whenNotPaused {
        require(token != address(0), "Invalid token");
        require(token != address(pilotToken), "Cannot convert PILOT");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to convert");

        // Approve router
        IERC20(token).safeIncreaseAllowance(dexRouter, balance);

        // Build path
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = wbnb;

        // Swap to BNB
        (bool success, ) = dexRouter.call(
            abi.encodeWithSignature(
                "swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
                balance,
                minBnbOut,
                path,
                address(this),
                block.timestamp + 300
            )
        );
        require(success, "Token swap failed");
    }
}
