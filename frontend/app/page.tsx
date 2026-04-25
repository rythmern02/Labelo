'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useAccount, useSendTransaction } from 'wagmi'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { truncate } from '@initia/utils'
import BalanceTicker from '@/components/BalanceTicker'
import WorkerCard from '@/components/WorkerCard'
import { fetchNextTask, submitLabel, Task } from '@/lib/api'
import { BOUNTY_ESCROW_ABI, BOUNTY_ESCROW_ADDRESS } from '@/lib/contracts'
import { encodeFunctionData } from 'viem'

type AppState = 'connect' | 'idle' | 'labeling' | 'loading' | 'no-tasks'

export default function WorkerApp() {
  const { address } = useAccount()
  const { username, openConnect, openWallet } = useInterwovenKit()
  const { sendTransactionAsync } = useSendTransaction()

  const [appState, setAppState] = useState<AppState>('connect')
  const [currentTask, setCurrentTask] = useState<Task | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [streak, setStreak] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [claimPending, setClaimPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNextTask = useCallback(async () => {
    if (!address) return
    setError(null)
    setAppState('loading')
    try {
      const task = await fetchNextTask(address)
      setCurrentTask(task)
      setAppState('labeling')
    } catch {
      setAppState('no-tasks')
      setCurrentTask(null)
    }
  }, [address])

  // Called when user connects wallet
  const handleConnect = async () => {
    openConnect()
  }

  // Once address is detected, move to idle/labeling
  const handleStartLabeling = () => {
    loadNextTask()
  }

  // Submit a label choice
  const handleSelect = async (winner: 'A' | 'B') => {
    if (!currentTask || !address) return
    setIsSubmitting(true)
    try {
      await submitLabel(currentTask.taskId, address, winner, currentTask.datasetId)
      setStreak((s) => s + 1)
      setSessionCount((c) => c + 1)
      // Load next immediately
      await loadNextTask()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setAppState('labeling')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClaim = async () => {
    setClaimPending(true)
    try {
      const data = encodeFunctionData({
        abi: BOUNTY_ESCROW_ABI,
        functionName: 'claimBalance',
      })
      await sendTransactionAsync({
        to: BOUNTY_ESCROW_ADDRESS,
        data,
        gas: 200000n,
        type: 'legacy',
        gasPrice: 0n,
      })
    } finally {
      setClaimPending(false)
    }
  }

  // Show connect screen if not connected
  if (!address) {
    return (
      <main className="gradient-bg min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-8 animate-fade-in">
          {/* Logo */}
          <div>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[--color-brand-primary] to-[--color-brand-accent] mb-5 animate-float glow-purple">
              <span className="text-3xl">🏷️</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-2">Labelo</h1>
            <p className="text-[--color-text-secondary] text-base leading-relaxed">
              Label AI data. Earn USDC.<br />
              <span className="text-[--color-brand-secondary]">$0.10 per swipe, instantly on-chain.</span>
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Workers', value: '2,847' },
              { label: 'Paid Out', value: '$48K' },
              { label: 'Tasks/hr', value: '12K' },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl py-3 px-2 text-center">
                <div className="text-lg font-bold text-[--color-brand-secondary]">{stat.value}</div>
                <div className="text-xs text-[--color-text-muted] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <button
              id="connect-wallet-btn"
              onClick={handleConnect}
              className="btn-primary w-full text-base py-4"
            >
              <span>Connect Wallet to Start</span>
              <span>→</span>
            </button>
            <div className="flex items-center justify-between text-xs px-2">
              <span className="text-[--color-text-muted]">Powered by Initia · Auto-signing ✓</span>
              <Link href="/enterprise" className="font-medium text-[--color-brand-accent] hover:text-[--color-brand-secondary] transition-colors">
                Enterprise Portal ↗
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="gradient-bg min-h-screen flex flex-col max-w-md mx-auto p-4">
      {/* Header */}
      <header className="flex items-center justify-between py-4 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[--color-brand-primary] to-[--color-brand-accent] flex items-center justify-center text-sm">
            🏷️
          </div>
          <span className="font-bold text-sm">Labelo</span>
          <Link href="/enterprise" className="ml-1 text-xs text-[--color-text-muted] hover:text-[--color-brand-accent] transition-colors">
            Enterprise ↗
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Streak badge */}
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-[--color-brand-gold]/10 border border-[--color-brand-gold]/30 rounded-full px-3 py-1 text-xs font-medium text-[--color-brand-gold]">
              🔥 {streak}
            </div>
          )}
          {/* Wallet */}
          <button
            id="wallet-btn"
            onClick={openWallet}
            className="text-xs font-medium glass-card px-3 py-2 rounded-full hover:border-[--color-brand-primary]/50 transition-all"
          >
            {truncate(username ?? address ?? '')}
          </button>
        </div>
      </header>

      {/* Balance */}
      <div className="glass-card rounded-2xl p-5 mb-5 text-center glow-purple relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[--color-brand-primary]/5 to-transparent pointer-events-none" />
        <BalanceTicker workerAddress={address as `0x${string}`} />
        <button
          id="claim-btn"
          onClick={handleClaim}
          disabled={claimPending}
          className="mt-4 text-xs font-semibold text-[--color-brand-accent] hover:text-[--color-brand-secondary] transition-colors disabled:opacity-50"
        >
          {claimPending ? 'Claiming…' : 'Claim to Wallet →'}
        </button>
      </div>

      {/* Session counter */}
      {sessionCount > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-[--color-text-muted] mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[--color-success] animate-pulse" />
          {sessionCount} task{sessionCount !== 1 ? 's' : ''} completed this session
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col justify-center">
        {appState === 'connect' && (
          <div className="text-center">
            <button id="start-btn" onClick={handleStartLabeling} className="btn-primary px-10">
              Start Earning →
            </button>
          </div>
        )}

        {appState === 'loading' && (
          <div className="text-center text-[--color-text-secondary] space-y-3">
            <div className="w-8 h-8 border-2 border-[--color-brand-primary] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Finding next task…</p>
          </div>
        )}

        {appState === 'labeling' && currentTask && (
          <WorkerCard
            task={currentTask}
            onSelect={handleSelect}
            isSubmitting={isSubmitting}
          />
        )}

        {appState === 'no-tasks' && (
          <div className="text-center glass-card rounded-2xl p-8 space-y-4 animate-fade-in">
            <div className="text-4xl">🎉</div>
            <h2 className="text-xl font-bold">All caught up!</h2>
            <p className="text-[--color-text-secondary] text-sm">
              No tasks available right now. Check back soon — enterprises post new datasets daily.
            </p>
            <button id="refresh-btn" onClick={loadNextTask} className="btn-primary">
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-6 left-4 right-4 max-w-sm mx-auto bg-[--color-error]/10 border border-[--color-error]/30 text-[--color-error] text-sm px-4 py-3 rounded-xl animate-fade-in z-50">
          {error}
          <button onClick={() => setError(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Bottom nav hint */}
      {appState !== 'connect' && (
        <div className="text-center text-xs text-[--color-text-muted] py-4">
          Session key active · Gasless signing ✓
        </div>
      )}
    </main>
  )
}
