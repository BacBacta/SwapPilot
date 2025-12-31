// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PILOT Token
 * @notice Governance and utility token for SwapPilot DEX aggregator
 * 
 * Utility:
 * - Hold PILOT to get fee discounts on swaps (10-20% off)
 * - 15% of platform fees are used to buy and burn PILOT (deflationary)
 * - Future: Governance voting on protocol parameters
 * 
 * Tokenomics:
 * - Max Supply: 1,000,000,000 PILOT (1 billion)
 * - No mint function after initial distribution
 * - Deflationary via burn mechanism
 */
contract PILOTToken is ERC20, ERC20Burnable, Ownable {
    /// @notice Maximum total supply (1 billion tokens with 18 decimals)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    /// @notice Whether initial distribution has been completed
    bool public distributionCompleted;

    /// @notice Emitted when tokens are burned via platform fees
    event FeeBurn(address indexed burner, uint256 amount);

    constructor() ERC20("SwapPilot", "PILOT") Ownable(msg.sender) {
        // Initial mint to deployer for distribution
        // Distribution will be done in separate transactions
    }

    /**
     * @notice Mint tokens for initial distribution (only callable once)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint to each recipient
     */
    function initialDistribution(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(!distributionCompleted, "Distribution already completed");
        require(recipients.length == amounts.length, "Arrays length mismatch");

        uint256 totalToMint = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalToMint += amounts[i];
        }

        require(totalSupply() + totalToMint <= MAX_SUPPLY, "Exceeds max supply");

        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Complete the initial distribution (locks minting forever)
     */
    function completeDistribution() external onlyOwner {
        distributionCompleted = true;
    }

    /**
     * @notice Burn tokens from platform fee collection
     * @dev Called by the fee collector contract after buying PILOT on market
     * @param amount Amount of PILOT to burn
     */
    function feeBurn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit FeeBurn(msg.sender, amount);
    }

    /**
     * @notice Check if an address qualifies for fee discount
     * @param account Address to check
     * @return tier The discount tier (0 = none, 1 = 10%, 2 = 15%, 3 = 20%)
     * @return discountBps Discount in basis points
     */
    function getDiscountTier(address account) external view returns (uint8 tier, uint16 discountBps) {
        uint256 balance = balanceOf(account);
        
        if (balance >= 10_000 * 10**18) {
            return (3, 2000); // Gold: 20% discount
        } else if (balance >= 1_000 * 10**18) {
            return (2, 1500); // Silver: 15% discount
        } else if (balance >= 100 * 10**18) {
            return (1, 1000); // Bronze: 10% discount
        }
        
        return (0, 0); // No discount
    }
}
