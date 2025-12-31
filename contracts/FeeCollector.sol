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
 *         - 80% -> Treasury
 *         - 5% -> Referral pool
 */
contract FeeCollector is Ownable, ReentrancyGuard {
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

    /// @notice Total fees collected (in BNB wei)
    uint256 public totalFeesCollected;

    /// @notice Total PILOT burned
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

        // Calculate distribution
        uint256 burnAmount = (balance * BURN_PERCENT) / 100;
        uint256 treasuryAmount = (balance * TREASURY_PERCENT) / 100;
        uint256 referralAmount = balance - burnAmount - treasuryAmount;

        // Send to treasury
        (bool treasurySuccess, ) = treasury.call{value: treasuryAmount}("");
        require(treasurySuccess, "Treasury transfer failed");

        // Send to referral pool
        (bool referralSuccess, ) = referralPool.call{value: referralAmount}("");
        require(referralSuccess, "Referral transfer failed");

        // Buy and burn PILOT with remaining
        if (burnAmount > 0 && dexRouter != address(0)) {
            _buyAndBurnPilot(burnAmount);
        }

        emit FeesDistributed(burnAmount, treasuryAmount, referralAmount);
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
     * @notice Update referral pool address
     */
    function setReferralPool(address _referralPool) external onlyOwner {
        require(_referralPool != address(0), "Invalid address");
        referralPool = _referralPool;
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
}
