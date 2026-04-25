import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL not set')
if (!process.env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY not set')

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

// ── Database types ─────────────────────────────────────────────────────────

export interface DbBounty {
  id: string              // UUID
  dataset_id: string      // keccak256 hex (bytes32)
  enterprise_address: string
  name: string
  description: string | null
  reward_per_task: number // in USDC micro-units (6 decimals)
  total_tasks: number
  completed_tasks: number
  asset_urls: string[]    // S3/IPFS URLs for images or prompt text
  status: 'active' | 'completed' | 'closed'
  created_at: string
}

export interface DbTask {
  id: string              // UUID
  bounty_id: string       // FK → bounties.id
  dataset_id: string      // bytes32 hex
  prompt_a: string        // first option text or image URL
  prompt_b: string        // second option text or image URL
  assigned_to: string | null   // worker address
  assigned_at: string | null
  completed_at: string | null
  winner: 'A' | 'B' | null
  worker_address: string | null
  tx_hash: string | null  // on-chain tx hash from oracle
  status: 'pending' | 'assigned' | 'completed'
}
