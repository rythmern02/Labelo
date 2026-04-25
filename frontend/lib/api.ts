const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export interface Task {
  taskId: string
  datasetId: string
  promptA: string
  promptB: string
}

export interface SubmitResult {
  success: boolean
  txHash: string
  message: string
}

export function fetchNextTask(workerAddress: string): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/next?worker=${workerAddress}`)
}

export function submitLabel(
  taskId: string,
  worker: string,
  winner: 'A' | 'B',
  datasetId: string
): Promise<SubmitResult> {
  return apiFetch<SubmitResult>(`/api/tasks/${taskId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ worker, winner, datasetId }),
  })
}

// ── Bounties ──────────────────────────────────────────────────────────────

export interface BountyProgress {
  id: string
  dataset_id: string
  name: string
  description: string | null
  reward_per_task: number
  total_tasks: number
  completed_tasks: number
  status: string
  progressPct: number
  remaining: number
  created_at: string
}

export interface CreateBountyPayload {
  datasetId: string
  enterpriseAddress: string
  name: string
  description?: string
  rewardPerTask: number
  tasks: Array<{ promptA: string; promptB: string }>
}

export interface CreateBountyResult {
  bountyId: string
  datasetId: string
  totalTasks: number
  message: string
}

export function createBounty(payload: CreateBountyPayload): Promise<CreateBountyResult> {
  return apiFetch<CreateBountyResult>('/api/bounties', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchBountyProgress(datasetId: string): Promise<BountyProgress> {
  return apiFetch<BountyProgress>(`/api/bounties/${datasetId}`)
}

export function fetchAllBounties(): Promise<BountyProgress[]> {
  return apiFetch<BountyProgress[]>('/api/bounties')
}
