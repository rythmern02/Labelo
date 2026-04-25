import { Request, Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { distributePayment } from '../lib/chain'
import { ethers } from 'ethers'


export const tasksRouter = Router()

// In-memory store for demo
const memTasks: any[] = []

import { memBounties } from './bounties'

tasksRouter.get('/next', async (req: Request, res: Response) => {
  const { worker } = req.query
  const activeBounty = memBounties.find(b => b.status === 'active')
  if (!activeBounty) return res.status(404).json({ error: 'No active bounties' })

  // Serve real task pairs from the uploaded JSON in round-robin order
  const taskPairs = activeBounty.tasks
  if (!taskPairs || taskPairs.length === 0) {
    return res.status(404).json({ error: 'No tasks in bounty' })
  }
  const idx = activeBounty.taskIndex
  if (idx >= activeBounty.total_tasks) {
    return res.status(404).json({ error: 'No more tasks available' })
  }
  
  activeBounty.taskIndex = idx + 1
  const pair = taskPairs[idx % taskPairs.length]

  res.json({
    taskId: uuidv4(),
    datasetId: activeBounty.dataset_id,
    promptA: pair.promptA,
    promptB: pair.promptB,
  })
})

tasksRouter.post('/:id/submit', async (req: Request, res: Response) => {
  const { id } = req.params
  const { worker, winner } = req.body

  try {
    console.log(`[Oracle] Distributing 0.1 USDC to ${worker} for task ${id}...`)
    const datasetId = req.body.datasetId || ethers.id('mock-dataset-1')
    const txHash = await distributePayment(datasetId, worker)

    const bounty = memBounties.find(b => b.dataset_id === datasetId)
    if (bounty) {
      bounty.completed_tasks += 1
      bounty.progressPct = Math.floor((bounty.completed_tasks / bounty.total_tasks) * 100)
      if (bounty.completed_tasks >= bounty.total_tasks) {
        bounty.status = 'completed'
      }
    }

    res.json({ success: true, txHash, message: 'Payment distributed' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})
