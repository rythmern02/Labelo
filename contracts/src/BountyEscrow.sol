// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BountyEscrow
/// @notice Core settlement contract for the Labelo decentralized RLHF protocol.
///
/// Flow:
///   1. Enterprise calls depositBounty() → USDC locked in escrow, Bounty created
///   2. Backend oracle calls distributePayment() each time a worker completes a task
///   3. Worker calls claimBalance() to sweep their accumulated USDC to their wallet
///
/// Roles:
///   DEFAULT_ADMIN_ROLE  – deployer; can grant/revoke roles
///   ORACLE_ROLE         – trusted backend signer that triggers micro-payments
///
/// AppChain fee:
///   A flat protocol fee (default 3%) is retained in the contract on each deposit.
///   The admin can withdraw accumulated fees via withdrawFees().
contract BountyEscrow is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // ─── State ───────────────────────────────────────────────────────────────
    IERC20 public immutable usdc;

    /// @dev Protocol fee in basis points (300 = 3%)
    uint256 public feeBps = 300;

    struct Bounty {
        address enterprise;
        uint256 totalDeposit;    // gross USDC deposited
        uint256 remaining;       // USDC left to distribute (after fee)
        uint256 rewardPerTask;   // USDC per completed task (6 decimals)
        uint256 totalTasks;
        uint256 completedTasks;
        bool    active;
    }

    /// @dev datasetId (keccak256 hash of dataset identifier) → Bounty
    mapping(bytes32 => Bounty) public bounties;

    /// @dev worker address → claimable USDC balance
    mapping(address => uint256) public workerBalance;

    /// @dev accumulated protocol fees
    uint256 public protocolFees;

    // ─── Events ──────────────────────────────────────────────────────────────
    event BountyDeposited(
        bytes32 indexed datasetId,
        address indexed enterprise,
        uint256 amount,
        uint256 rewardPerTask,
        uint256 totalTasks
    );
    event TaskCompleted(
        bytes32 indexed datasetId,
        address indexed worker,
        uint256 reward,
        uint256 completedTasks
    );
    event PaymentDistributed(address indexed worker, uint256 amount);
    event BalanceClaimed(address indexed worker, uint256 amount);
    event BountyClosed(bytes32 indexed datasetId, uint256 refunded);
    event FeeWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _usdc, address _admin, address _oracle) {
        require(_usdc    != address(0), "BountyEscrow: zero usdc");
        require(_admin   != address(0), "BountyEscrow: zero admin");
        require(_oracle  != address(0), "BountyEscrow: zero oracle");

        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _oracle);
    }

    // ─── Enterprise Functions ────────────────────────────────────────────────

    /// @notice Deposit USDC and create a new labeling bounty.
    /// @param datasetId     Unique identifier for this dataset (keccak256 hash)
    /// @param amount        Total USDC to deposit (6 decimals). Must include protocol fee.
    /// @param rewardPerTask USDC paid per completed task (6 decimals)
    /// @param totalTasks    Number of tasks in this dataset
    function depositBounty(
        bytes32 datasetId,
        uint256 amount,
        uint256 rewardPerTask,
        uint256 totalTasks
    ) external nonReentrant {
        require(amount > 0,             "BountyEscrow: zero amount");
        require(rewardPerTask > 0,      "BountyEscrow: zero reward");
        require(totalTasks > 0,         "BountyEscrow: zero tasks");
        require(!bounties[datasetId].active, "BountyEscrow: dataset exists");

        // Verify that the deposit covers the expected payout + fee
        uint256 fee = (amount * feeBps) / 10_000;
        uint256 net = amount - fee;
        require(net >= rewardPerTask * totalTasks, "BountyEscrow: insufficient funds");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        protocolFees += fee;

        bounties[datasetId] = Bounty({
            enterprise:     msg.sender,
            totalDeposit:   amount,
            remaining:      net,
            rewardPerTask:  rewardPerTask,
            totalTasks:     totalTasks,
            completedTasks: 0,
            active:         true
        });

        emit BountyDeposited(datasetId, msg.sender, amount, rewardPerTask, totalTasks);
    }

    // ─── Oracle Functions ────────────────────────────────────────────────────

    /// @notice Called by the backend oracle when a worker completes a task.
    ///         Credits the reward to the worker's claimable balance.
    /// @param datasetId Dataset the task belongs to
    /// @param worker    Address of the worker who completed the task
    function distributePayment(bytes32 datasetId, address worker)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
    {
        require(worker != address(0), "BountyEscrow: zero worker");
        Bounty storage b = bounties[datasetId];
        require(b.active,                         "BountyEscrow: bounty inactive");
        require(b.completedTasks < b.totalTasks,  "BountyEscrow: all tasks done");
        require(b.remaining >= b.rewardPerTask,   "BountyEscrow: funds exhausted");

        b.remaining      -= b.rewardPerTask;
        b.completedTasks += 1;
        workerBalance[worker] += b.rewardPerTask;

        emit TaskCompleted(datasetId, worker, b.rewardPerTask, b.completedTasks);
        emit PaymentDistributed(worker, b.rewardPerTask);

        // Auto-close when all tasks are done
        if (b.completedTasks == b.totalTasks) {
            b.active = false;
            // Refund any rounding remainder to enterprise
            if (b.remaining > 0) {
                uint256 refund = b.remaining;
                b.remaining = 0;
                usdc.safeTransfer(b.enterprise, refund);
                emit BountyClosed(datasetId, refund);
            }
        }
    }

    // ─── Worker Functions ────────────────────────────────────────────────────

    /// @notice Worker sweeps their entire claimable balance.
    function claimBalance() external nonReentrant {
        uint256 amount = workerBalance[msg.sender];
        require(amount > 0, "BountyEscrow: nothing to claim");
        workerBalance[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit BalanceClaimed(msg.sender, amount);
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────

    /// @notice Emergency close a bounty and refund remaining funds to enterprise.
    function closeBounty(bytes32 datasetId) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        Bounty storage b = bounties[datasetId];
        require(b.active, "BountyEscrow: already inactive");
        b.active = false;
        uint256 refund = b.remaining;
        b.remaining = 0;
        if (refund > 0) {
            usdc.safeTransfer(b.enterprise, refund);
        }
        emit BountyClosed(datasetId, refund);
    }

    /// @notice Withdraw accumulated protocol fees.
    function withdrawFees(address to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0), "BountyEscrow: zero to");
        uint256 amount = protocolFees;
        require(amount > 0, "BountyEscrow: no fees");
        protocolFees = 0;
        usdc.safeTransfer(to, amount);
        emit FeeWithdrawn(to, amount);
    }

    /// @notice Update the protocol fee. Max 10%.
    function setFeeBps(uint256 _feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 1_000, "BountyEscrow: fee too high");
        feeBps = _feeBps;
    }

    // ─── View Helpers ────────────────────────────────────────────────────────

    /// @notice Returns full bounty details.
    function getBounty(bytes32 datasetId) external view returns (Bounty memory) {
        return bounties[datasetId];
    }

    /// @notice Returns worker's pending claimable balance.
    function pendingBalance(address worker) external view returns (uint256) {
        return workerBalance[worker];
    }
}
