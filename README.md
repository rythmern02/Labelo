# Labelo

**The decentralized RLHF marketplace built on Initia.**

AI companies need humans to label data. Humans want to get paid instantly, without paperwork, banks, or a middleman taking a 60% cut. Labelo fixes this — workers earn real USDC per task, on-chain, immediately. Enterprises get high-quality labeled data at 40% less than Scale AI.

> Built on an Initia MiniEVM appchain (`labelo-1`) for the Initia Hackathon — **AI track**.

---

## What It Does

Two sides. One protocol.

**Workers** — Open the app, connect wallet, swipe left or right to pick the better AI response. Earn $0.10 USDC per task. No forms. No waiting. No bank account required.

**Enterprises** — Post a labeling bounty. Upload your dataset. Deposit USDC into escrow. Workers label it. You get results. Funds auto-settle on-chain.

The entire payment layer runs on a custom Initia appchain with 0-gas fees, session key auto-signing (so workers never see a gas prompt), and escrow contracts that can't be rugged.

---

## Demo

[![Watch the demo](https://img.shields.io/badge/Demo%20Video-Watch%20Now-red?style=for-the-badge)]([https://your-demo-link-here](https://youtu.be/sFbP8MftqH0))

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        LABELO STACK                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FRONTEND — Next.js + InterwovenKit                              │
│  ├── Worker App  → swipe UI, session keys, live balance          │
│  └── Enterprise  → bounty creation, USDC bridge, dashboard       │
│                                                                  │
│  BACKEND — Node.js / Express                                     │
│  ├── Task router  → serves next unassigned task                  │
│  └── Oracle signer → calls distributePayment() on-chain          │
│                                                                  │
│  SMART CONTRACTS — Solidity (MiniEVM appchain)                   │
│  ├── BountyEscrow.sol → locks USDC, pays workers, auto-closes    │
│  └── MockUSDC.sol     → testnet ERC-20 (6 decimals, mintable)    │
│                                                                  │
│  DATABASE — Supabase PostgreSQL                                  │
│  ├── bounties — metadata, progress                               │
│  └── tasks    — pairs, assignments, completion status            │
│                                                                  │
│  CHAIN — Initia MiniEVM Appchain (labelo-1)                      │
│  └── 0-gas fees, EVM-compatible, no EIP-1559 (legacy txs)        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### How a single label flows end-to-end

```
Worker swipes →  POST /api/tasks/:id/submit
                        │
                        ▼
              Oracle backend verifies
                        │
                        ▼
        distributePayment(datasetId, workerAddr)  ← on-chain tx
                        │
                        ▼
        workerBalance[worker] += 0.1 USDC  (BountyEscrow.sol)
                        │
                        ▼
        Frontend refetches pendingBalance()  every 3s
                        │
                        ▼
              Balance ticker animates  ✓
```

---

## Initia Integration

| Requirement | How Labelo uses it |
|---|---|
| **InterwovenKit** | Wallet connection, session keys, bridge UI — all via `@initia/interwovenkit-react` |
| **Auto-signing** | Workers approve a session key once. Every subsequent swipe is gasless — no popups, no friction |
| **Interwoven Bridge** | Enterprise portal has a one-click bridge button: USDC from Ethereum → Labelo appchain |
| **Initia Usernames** | Worker header shows `.init` username instead of `0xdeadbeef...` via `useInterwovenKit()` |
| **MiniEVM Appchain** | Entire protocol deployed on `labelo-1` rollup — its own chain ID, RPC, and explorer |

### Session Key Auto-Signing

This is the killer UX feature. Normal Web3 apps show a wallet popup for every single transaction. Labelo workers swipe hundreds of tasks per session — that would be unusable.

InterwovenKit's `enableAutoSign={true}` creates a short-lived session key on first connect. After one approval, every label submission goes through gaslessly. The worker never sees another popup until the session expires.

```tsx
// providers.tsx
<InterwovenKitProvider
  chainId={process.env.NEXT_PUBLIC_IW_CHAIN_ID}
  enableAutoSign={true}
>
```

---

## Features

### Worker Side
- Connect wallet with InterwovenKit (one click)
- Swipe-based A/B comparison UI — choose the better AI response
- Session key auto-signing — zero gas friction after first approval
- Live USDC balance ticker — updates every 3 seconds
- Animated flash effect when balance increases
- Streak counter for consecutive completions
- One-click `claimBalance()` to sweep earnings to wallet

### Enterprise Side
- Create labeling bounties with a name, description, and JSON task dataset
- Multi-step bounty creation: approve USDC → deposit to escrow → register off-chain
- Live progress dashboard — completed/total tasks, auto-refreshes every 5s
- One-click USDC bridge from Ethereum via Interwoven Bridge
- 3% protocol fee shown transparently at deposit time
- Funds auto-refund to enterprise when all tasks complete

### Smart Contract
- **Escrow** — USDC locked on deposit, can't be withdrawn by anyone except workers who earned it
- **Auto-close** — bounty closes itself when `completedTasks == totalTasks`, refunds remainder
- **Role-based access** — `ORACLE_ROLE` for backend signer, `DEFAULT_ADMIN_ROLE` for protocol
- **Reentrancy-safe** — all state-mutating functions use OpenZeppelin's `nonReentrant`
- **Fee model** — 3% default, adjustable up to 10%, admin-withdrawable

---

## Smart Contracts

### `BountyEscrow.sol`

The core of the protocol. Three roles, three flows.

```
Enterprise  →  depositBounty(datasetId, amount, rewardPerTask, totalTasks)
Oracle      →  distributePayment(datasetId, workerAddress)
Worker      →  claimBalance()
```

Key behaviors:
- Deposit validates `net_amount >= rewardPerTask * totalTasks` (no underfunded bounties)
- Each `distributePayment()` call credits `rewardPerTask` to a worker's claimable balance
- `claimBalance()` sweeps the full balance to the caller in one tx
- Bounty auto-closes when all tasks finish; remainder refunded to enterprise instantly

### `MockUSDC.sol`

Standard ERC-20 with 6 decimals, owner-mintable. Used for hackathon demo on testnet.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Wallet | `@initia/interwovenkit-react` 2.8.0 |
| Chain interaction | Wagmi 2, Viem 2 |
| Data fetching | TanStack React Query 5 |
| Backend | Node.js 20, Express 5, TypeScript |
| Oracle signer | Ethers.js 6 |
| Database | Supabase (PostgreSQL) |
| Smart contracts | Solidity ^0.8.20, Foundry |
| Contract libs | OpenZeppelin (AccessControl, ReentrancyGuard, SafeERC20) |
| Chain | Initia MiniEVM appchain |

---

## Repo Structure

```
labelo/
├── contracts/
│   ├── src/
│   │   ├── BountyEscrow.sol      core protocol (214 lines)
│   │   └── MockUSDC.sol          testnet token
│   ├── test/
│   │   └── BountyEscrow.t.sol    Foundry tests (~15 test cases)
│   └── script/
│       └── Deploy.s.sol          deployment script
│
├── backend/
│   └── src/
│       ├── index.ts              Express app
│       ├── routes/
│       │   ├── tasks.ts          GET /next, POST /submit
│       │   └── bounties.ts       CRUD for bounties
│       └── lib/
│           ├── chain.ts          ethers provider + oracle signer
│           └── supabase.ts       DB client
│
└── frontend/
    ├── app/
    │   ├── page.tsx              worker app
    │   ├── providers.tsx         Wagmi + InterwovenKit setup
    │   └── enterprise/
    │       └── page.tsx          enterprise dashboard
    ├── components/
    │   ├── WorkerCard.tsx        swipe card
    │   ├── BalanceTicker.tsx     live balance display
    │   └── BountyModal.tsx       bounty creation flow
    └── lib/
        ├── api.ts                typed API client
        └── contracts.ts          ABIs + addresses
```

---

## Running Locally

### 1. Smart Contracts

```bash
cd contracts

# Install dependencies
forge install

# Run tests
forge test -vv

# Deploy (requires Initia MiniEVM RPC + funded wallet)
# MiniEVM does NOT support EIP-1559 — --legacy flag is required
forge script script/Deploy.s.sol \
  --rpc-url $LABELO_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --legacy -vvvv
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in: LABELO_RPC_URL, ORACLE_PRIVATE_KEY, BOUNTY_ESCROW_ADDRESS,
#          MOCK_USDC_ADDRESS, SUPABASE_URL, SUPABASE_SERVICE_KEY
npm run dev   # starts on :4000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_CHAIN_ID, NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_IW_CHAIN_ID,
#          NEXT_PUBLIC_MOCK_USDC_ADDRESS, NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS,
#          NEXT_PUBLIC_API_URL
npm run dev   # starts on :3000
```

### End-to-End Flow

1. Deploy contracts → note `BountyEscrow` and `MockUSDC` addresses
2. Start backend (`npm run dev` in `backend/`)
3. Start frontend (`npm run dev` in `frontend/`)
4. Open `localhost:3000/enterprise` → mint USDC → create bounty
5. Open `localhost:3000` → connect wallet → session key auto-signs → swipe tasks
6. Watch balance tick up in real time
7. Hit "Claim" → USDC transfers to your wallet on-chain

---

## Why Initia

Labelo needed a chain where:
- **Gas is effectively free** — workers can't be charged per label
- **EVM-compatible** — Solidity contracts, no new language to learn
- **Session keys exist natively** — InterwovenKit's auto-sign is the only viable UX for micro-payment workflows
- **Bridge is built in** — enterprises bring capital from Ethereum without CEX detours

Initia MiniEVM checks every box. The appchain model means Labelo controls its own execution environment — no shared congestion, no protocol constraints baked in by someone else's roadmap.

---

## Track

**AI** — Labelo is infrastructure for AI development. RLHF (Reinforcement Learning from Human Feedback) is how models like GPT-4 and Claude are aligned to human preferences. Right now that process is centralized, slow, and expensive. Labelo puts the payment layer on-chain and the feedback layer in the hands of anyone with a wallet.

---

## License

MIT
