import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { tasksRouter } from './routes/tasks'
import { bountiesRouter } from './routes/bounties'

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }))
app.use(express.json({ limit: '10mb' })) // allow large task JSON uploads

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'labelo-backend', timestamp: new Date().toISOString() })
})

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/tasks',    tasksRouter)
app.use('/api/bounties', bountiesRouter)

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`🚀 Labelo backend running on http://localhost:${PORT}`)
  console.log(`   Oracle: ${process.env.ORACLE_PRIVATE_KEY ? 'configured ✓' : 'NOT SET ✗'}`)
  console.log(`   RPC:    ${process.env.LABELO_RPC_URL ?? 'NOT SET'}`)
  console.log(`   Escrow: ${process.env.BOUNTY_ESCROW_ADDRESS ?? 'NOT SET'}`)
})

export default app
