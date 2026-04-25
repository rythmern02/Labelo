// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/BountyEscrow.sol";

/// @notice Deploy MockUSDC + BountyEscrow to the Labelo rollup.
/// @dev Run with:
///   forge script script/Deploy.s.sol \
///     --rpc-url $LABELO_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast \
///     --legacy \
///     -vvvv
contract DeployScript is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address oracle   = vm.envAddress("ORACLE_ADDRESS");

        vm.startBroadcast();

        // 1. Deploy MockUSDC — deployer is the owner and can mint
        MockUSDC usdc = new MockUSDC(deployer);
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Mint some tokens to the deployer for testing
        usdc.mint(deployer, 100_000 * 1e6); // 100,000 USDC
        console.log("Minted 100,000 USDC to deployer");

        // 3. Deploy BountyEscrow
        BountyEscrow escrow = new BountyEscrow(
            address(usdc),
            deployer, // admin
            oracle    // backend oracle address
        );
        console.log("BountyEscrow deployed at:", address(escrow));

        vm.stopBroadcast();

        // Print summary
        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("MockUSDC:    ", address(usdc));
        console.log("BountyEscrow:", address(escrow));
        console.log("Admin:       ", deployer);
        console.log("Oracle:      ", oracle);
    }
}
