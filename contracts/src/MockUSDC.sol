// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Mintable ERC-20 used on the Labelo testnet rollup.
///         Identical ABI to real USDC (6 decimals). Owner can mint freely.
contract MockUSDC is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("Mock USDC", "USDC")
        Ownable(initialOwner)
    {}

    /// @notice 6 decimals to match real USDC
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any address. Only callable by owner.
    /// @param to    Recipient address
    /// @param amount Amount in USDC micro-units (1 USDC = 1_000_000)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
