// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapPilot Fee Collector
 * @notice Collects platform fees and distributes according to tokenomics:
 *         - 15% -> Buy and burn PILOT
 *         - 85% -> Treasury
 *         
 * Note: Referral rewards are paid in PILOT tokens from a separate allocation
 *       (5% of total PILOT supply), managed by the ReferralRewards contract.
 */
contract FeeCollector is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Distribution percentages (must sum to 100)
    uint256 public constant BURN_PERCENT = 15;
    uint256 public constant TREASURY_PERCENT = 85;

    /// @notice PILOT token address
    IERC20 public immutable pilotToken;

    /// @notice Treasury wallet
    address public treasury;

    /// @notice DEX router for buying PILOT (e.g., PancakeSwap)
    address public dexRouter;

    /// @notice WBNB address for swap path
    address public wbnb;

    /// @notice Total fees collected (in BNB wei)
    uint256 public totalFeesCollected;

    /// @notice Total PILOT burned
    uint256 public totalPilotBurned;

    /// @notice Emitted when fees are collected
    event FeesCollected(address indexed token, uint256 amount);

    /// @notice Emitted when fees are distributed
    event FeesDistributed(
        uint256 burnAmount,
        uint256 treasuryAmount
    );

    /// @notice Emitted when PILOT is bought and burned
    event PilotBurned(uint256 bnbSpent, uint256 pilotBurned);

    constructor(
        address _pilotToken,
        address _treasury,
        address _dexRouter,
        address _wbnb
    ) Ownable(msg.sender) {
        require(_pilotToken != address(0), "Invalid PILOT address");
        require(_treasury != address(0), "Invalid treasury address");

        pilotToken = IERC20(_pilotToken);
        treasury = _treasury;
        dexRouter = _dexRouter;
        wbnb = _wbnb;
    }

    /**
     * @notice Receive BNB fees
     */
    receive() external payable {
        totalFeesCollected += msg.value;
        emit FeesCollected(address(0), msg.value);
    }

    /**
     * @notice Distribute collected BNB fees according to tokenomics
     */
    function distributeFees() external nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to distribute");

        // Calculate distribution: 85% treasury, 15% buy & burn
        uint256 burnAmount = (balance * BURN_PERCENT) / 100;
        uint256 treasuryAmount = balance - burnAmount;

        // Send to treasury
        (bool treasurySuccess, ) = treasury.call{value: treasuryAmount}("");
        require(treasurySuccess, "Treasury transfer failed");

        // Buy and burn PILOT with remaining
        if (burnAmount > 0 && dexRouter != address(0)) {
            _buyAndBurnPilot(burnAmount);
        }

        emit FeesDistributed(burnAmount, treasuryAmount);
    }

    /**
     * @notice Buy PILOT on DEX and burn it
     * @param bnbAmount Amount of BNB to spend
     */
    function _buyAndBurnPilot(uint256 bnbAmount) internal {
        // Build swap path: BNB -> PILOT
        address[] memory path = new address[](2);
        path[0] = wbnb;
        path[1] = address(pilotToken);

        // Get router interface
        IPancakeRouter router = IPancakeRouter(dexRouter);

        // Swap BNB for PILOT
        uint256 pilotBefore = pilotToken.balanceOf(address(this));
        
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: bnbAmount}(
            0, // Accept any amount
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 pilotReceived = pilotToken.balanceOf(address(this)) - pilotBefore;

        // Burn the PILOT
        if (pilotReceived > 0) {
            // Transfer to burn address
            pilotToken.safeTransfer(0x000000000000000000000000000000000000dEaD, pilotReceived);
            totalPilotBurned += pilotReceived;
            emit PilotBurned(bnbAmount, pilotReceived);
        }
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    /**
     * @notice Update DEX router
     */
    function setDexRouter(address _dexRouter) external onlyOwner {
        dexRouter = _dexRouter;
    }

    /**
     * @notice Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    /**
     * @notice Convert ERC-20 token fees to BNB
     * @param token The token to convert
     * @param minBnbOut Minimum BNB to receive (slippage protection)
     */
    function convertTokenToBnb(address token, uint256 minBnbOut) external nonReentrant {
        require(token != address(0), "Use BNB directly");
        require(token != address(pilotToken), "Cannot convert PILOT");
        require(dexRouter != address(0), "DEX router not set");
        
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        require(tokenBalance > 0, "No tokens to convert");
        
        // Approve router
        IERC20(token).safeIncreaseAllowance(dexRouter, tokenBalance);
        
        // Build swap path: Token -> WBNB
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = wbnb;
        
        // Swap tokens for BNB
        IPancakeRouter(dexRouter).swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenBalance,
            minBnbOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        emit FeesCollected(token, tokenBalance);
    }

    /**
     * @notice Collect ERC-20 token fees (tokens sent directly to this contract)
     * @param token The token that was sent
     */
    function collectTokenFees(address token) external {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            emit FeesCollected(token, balance);
        }
    }
}

/**
 * @notice Minimal PancakeSwap Router interface
 */
interface IPancakeRouter {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
    
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}
