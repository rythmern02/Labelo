import { Request, Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

export const bountiesRouter = Router()

export const memBounties: any[] = []

bountiesRouter.post('/', async (req: Request, res: Response) => {
  const { datasetId, enterpriseAddress, name, description, rewardPerTask, tasks } = req.body
  const newBounty = {
    id: uuidv4(),
    dataset_id: datasetId,
    name,
    description,
    reward_per_task: rewardPerTask,
    total_tasks: tasks.length,
    completed_tasks: 0,
    status: 'active',
    progressPct: 0,
    remaining: rewardPerTask * tasks.length,
    tasks: tasks,           // store the actual task pairs
    taskIndex: 0,           // round-robin cursor
  }
  memBounties.unshift(newBounty)
  res.json({ bountyId: newBounty.id, datasetId, totalTasks: tasks.length, message: 'Bounty registered' })
})

bountiesRouter.get('/', async (req: Request, res: Response) => {
  res.json(memBounties)
})

bountiesRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const bounty = memBounties.find(b => b.dataset_id === id)
  if (!bounty) return res.status(404).json({ error: 'Not found' })
  res.json(bounty)
})
