// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MockUSDC.sol";
import "../src/BountyEscrow.sol";

contract BountyEscrowTest is Test {
    MockUSDC    internal usdc;
    BountyEscrow internal escrow;

    address internal admin    = makeAddr("admin");
    address internal oracle   = makeAddr("oracle");
    address internal enterprise = makeAddr("enterprise");
    address internal worker1  = makeAddr("worker1");
    address internal worker2  = makeAddr("worker2");

    bytes32 internal constant DATASET_ID = keccak256("test-dataset-001");
    uint256 internal constant REWARD     = 100_000;   // 0.1 USDC (6 decimals)
    uint256 internal constant TOTAL_TASKS = 10;

    function setUp() public {
        vm.startPrank(admin);
        usdc   = new MockUSDC(admin);
        escrow = new BountyEscrow(address(usdc), admin, oracle);
        vm.stopPrank();

        // Mint USDC to enterprise
        vm.prank(admin);
        usdc.mint(enterprise, 10_000 * 1e6); // 10,000 USDC
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// @dev Calculates the gross deposit needed so that after the 3% fee,
    ///      net >= rewardPerTask * totalTasks
    function _grossDeposit(uint256 rewardPerTask, uint256 totalTasks)
        internal
        view
        returns (uint256)
    {
        uint256 net = rewardPerTask * totalTasks;
        // net = gross - (gross * feeBps / 10000)  →  gross = net * 10000 / (10000 - feeBps)
        uint256 feeBps = escrow.feeBps();
        return (net * 10_000 + (10_000 - feeBps - 1)) / (10_000 - feeBps); // ceiling div
    }

    // ─── depositBounty ────────────────────────────────────────────────────────

    function test_depositBounty_success() public {
        uint256 gross = _grossDeposit(REWARD, TOTAL_TASKS);

        vm.startPrank(enterprise);
        usdc.approve(address(escrow), gross);
        escrow.depositBounty(DATASET_ID, gross, REWARD, TOTAL_TASKS);
        vm.stopPrank();

        BountyEscrow.Bounty memory b = escrow.getBounty(DATASET_ID);
        assertEq(b.enterprise,    enterprise);
        assertEq(b.totalTasks,    TOTAL_TASKS);
        assertEq(b.rewardPerTask, REWARD);
        assertTrue(b.active);
    }

    function test_depositBounty_revert_duplicateDataset() public {
        uint256 gross = _grossDeposit(REWARD, TOTAL_TASKS);

        vm.startPrank(enterprise);
        usdc.approve(address(escrow), gross * 2);
        escrow.depositBounty(DATASET_ID, gross, REWARD, TOTAL_TASKS);
        vm.expectRevert("BountyEscrow: dataset exists");
        escrow.depositBounty(DATASET_ID, gross, REWARD, TOTAL_TASKS);
        vm.stopPrank();
    }

    function test_depositBounty_revert_insufficientFunds() public {
        uint256 tooLow = REWARD * TOTAL_TASKS - 1; // one micro-unit short (before fee)
        vm.startPrank(enterprise);
        usdc.approve(address(escrow), tooLow);
        vm.expectRevert("BountyEscrow: insufficient funds");
        escrow.depositBounty(DATASET_ID, tooLow, REWARD, TOTAL_TASKS);
        vm.stopPrank();
    }

    // ─── distributePayment ────────────────────────────────────────────────────

    function _setupBounty() internal {
        uint256 gross = _grossDeposit(REWARD, TOTAL_TASKS);
        vm.startPrank(enterprise);
        usdc.approve(address(escrow), gross);
        escrow.depositBounty(DATASET_ID, gross, REWARD, TOTAL_TASKS);
        vm.stopPrank();
    }

    function test_distributePayment_creditsWorker() public {
        _setupBounty();
        vm.prank(oracle);
        escrow.distributePayment(DATASET_ID, worker1);
        assertEq(escrow.workerBalance(worker1), REWARD);
    }

    function test_distributePayment_onlyOracle() public {
        _setupBounty();
        vm.prank(enterprise); // not the oracle
        vm.expectRevert();
        escrow.distributePayment(DATASET_ID, worker1);
    }

    function test_distributePayment_autoClosesWhenAllTasksDone() public {
        _setupBounty();
        vm.startPrank(oracle);
        for (uint256 i = 0; i < TOTAL_TASKS; i++) {
            escrow.distributePayment(DATASET_ID, worker1);
        }
        vm.stopPrank();

        BountyEscrow.Bounty memory b = escrow.getBounty(DATASET_ID);
        assertFalse(b.active);
        assertEq(b.completedTasks, TOTAL_TASKS);
    }

    function test_distributePayment_revert_allTasksDone() public {
        _setupBounty();
        vm.startPrank(oracle);
        for (uint256 i = 0; i < TOTAL_TASKS; i++) {
            escrow.distributePayment(DATASET_ID, worker1);
        }
        vm.expectRevert("BountyEscrow: bounty inactive");
        escrow.distributePayment(DATASET_ID, worker1);
        vm.stopPrank();
    }

    // ─── claimBalance ─────────────────────────────────────────────────────────

    function test_claimBalance_transfersUSDC() public {
        _setupBounty();
        vm.prank(oracle);
        escrow.distributePayment(DATASET_ID, worker1);

        uint256 balBefore = usdc.balanceOf(worker1);
        vm.prank(worker1);
        escrow.claimBalance();
        uint256 balAfter = usdc.balanceOf(worker1);

        assertEq(balAfter - balBefore, REWARD);
        assertEq(escrow.workerBalance(worker1), 0);
    }

    function test_claimBalance_revert_nothingToClaim() public {
        vm.prank(worker2);
        vm.expectRevert("BountyEscrow: nothing to claim");
        escrow.claimBalance();
    }

    // ─── Protocol fees ────────────────────────────────────────────────────────

    function test_protocolFees_accrue() public {
        uint256 gross = _grossDeposit(REWARD, TOTAL_TASKS);
        vm.startPrank(enterprise);
        usdc.approve(address(escrow), gross);
        escrow.depositBounty(DATASET_ID, gross, REWARD, TOTAL_TASKS);
        vm.stopPrank();

        uint256 expectedFee = (gross * escrow.feeBps()) / 10_000;
        assertEq(escrow.protocolFees(), expectedFee);
    }

    function test_withdrawFees_onlyAdmin() public {
        _setupBounty();
        vm.prank(oracle); // not admin
        vm.expectRevert();
        escrow.withdrawFees(admin);
    }

    function test_withdrawFees_success() public {
        uint256 gross = _grossDeposit(REWARD, TOTAL_TASKS);
        vm.startPrank(enterprise);
        usdc.approve(address(escrow), gross);
        escrow.depositBounty(DATASET_ID, gross, REWARD, TOTAL_TASKS);
        vm.stopPrank();

        uint256 fees = escrow.protocolFees();
        uint256 balBefore = usdc.balanceOf(admin);
        vm.prank(admin);
        escrow.withdrawFees(admin);
        assertEq(usdc.balanceOf(admin) - balBefore, fees);
        assertEq(escrow.protocolFees(), 0);
    }
}
