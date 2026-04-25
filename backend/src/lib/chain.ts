import { ethers } from 'ethers'

if (!process.env.LABELO_RPC_URL) throw new Error('LABELO_RPC_URL not set')
if (!process.env.ORACLE_PRIVATE_KEY) throw new Error('ORACLE_PRIVATE_KEY not set')

export const provider = new ethers.JsonRpcProvider(process.env.LABELO_RPC_URL)
export const oracleSigner = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, provider)

// ── Contract ABIs (minimal — only what the backend calls) ─────────────────

export const BOUNTY_ESCROW_ABI = [
  'function distributePayment(bytes32 datasetId, address worker) external',
  'function getBounty(bytes32 datasetId) external view returns (tuple(address enterprise, uint256 totalDeposit, uint256 remaining, uint256 rewardPerTask, uint256 totalTasks, uint256 completedTasks, bool active))',
  'function workerBalance(address worker) external view returns (uint256)',
  'event TaskCompleted(bytes32 indexed datasetId, address indexed worker, uint256 reward, uint256 completedTasks)',
] as const

export const MOCK_USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
] as const

// ── Contract instances ─────────────────────────────────────────────────────

function getEscrowContract() {
  const addr = process.env.BOUNTY_ESCROW_ADDRESS
  if (!addr) throw new Error('BOUNTY_ESCROW_ADDRESS not set')
  return new ethers.Contract(addr, BOUNTY_ESCROW_ABI, oracleSigner)
}

export const escrowContract = getEscrowContract()

export async function distributePayment(datasetId: string, worker: string) {
  // Use legacy transaction type to support minievm without EIP-1559
  const tx = await escrowContract.distributePayment(datasetId, worker, { type: 0 })
  const receipt = await tx.wait()
  return receipt.hash
}
