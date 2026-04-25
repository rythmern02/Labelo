'use client'

import { useState, useRef } from 'react'
import { useAccount, useConfig, useSendTransaction } from 'wagmi'
import { waitForTransactionReceipt, readContract } from 'wagmi/actions'
import { keccak256, toBytes, encodeFunctionData } from 'viem'
import {
  BOUNTY_ESCROW_ABI, BOUNTY_ESCROW_ADDRESS,
  MOCK_USDC_ABI, MOCK_USDC_ADDRESS,
  REWARD_PER_TASK,
} from '@/lib/contracts'
import { createBounty } from '@/lib/api'

interface BountyModalProps {
  onClose: () => void
  onSuccess: () => void
}

type Step = 'form' | 'approve' | 'deposit' | 'register' | 'done'

interface TaskRow {
  promptA: string
  promptB: string
}

export default function BountyModal({ onClose, onSuccess }: BountyModalProps) {
  const { address } = useAccount()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tasks, setTasks] = useState<TaskRow[]>([{ promptA: '', promptB: '' }])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const config = useConfig()
  const { sendTransactionAsync } = useSendTransaction()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const totalTasks = tasks.filter((t) => t.promptA && t.promptB).length
  const rewardPerTask = REWARD_PER_TASK // 0.1 USDC
  const netCost = rewardPerTask * BigInt(totalTasks)
  const grossCost = (netCost * 10_000n) / 9_700n + 1n // account for 3% fee

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as TaskRow[]
        if (Array.isArray(parsed)) setTasks(parsed)
      } catch {
        setError('Invalid JSON file. Expected array of {promptA, promptB}.')
      }
    }
    reader.readAsText(file)
  }

  const handleSubmit = async () => {
    if (!address) return
    setError(null)

    const validTasks = tasks.filter((t) => t.promptA && t.promptB)
    if (validTasks.length === 0) return setError('Add at least one task pair.')
    if (!name.trim()) return setError('Dataset name is required.')

    const datasetId = keccak256(toBytes(`${name}-${Date.now()}`))

    try {
      setStep('approve')
      const currentAllowance = await readContract(config, {
        address: MOCK_USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: 'allowance',
        args: [address, BOUNTY_ESCROW_ADDRESS],
      })

      if (currentAllowance < grossCost) {
        const approveData = encodeFunctionData({
          abi: MOCK_USDC_ABI,
          functionName: 'approve',
          args: [BOUNTY_ESCROW_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
        })
        const approveHash = await sendTransactionAsync({
          to: MOCK_USDC_ADDRESS,
          data: approveData,
          gas: 500000n,
          type: 'legacy',
          gasPrice: 0n,
        })
        await waitForTransactionReceipt(config, { hash: approveHash })
      }

      setStep('deposit')
      const depositData = encodeFunctionData({
        abi: BOUNTY_ESCROW_ABI,
        functionName: 'depositBounty',
        args: [datasetId, grossCost, rewardPerTask, BigInt(validTasks.length)],
      })
      const depositHash = await sendTransactionAsync({
        to: BOUNTY_ESCROW_ADDRESS,
        data: depositData,
        gas: 500000n,
        type: 'legacy',
        gasPrice: 0n,
      })
      await waitForTransactionReceipt(config, { hash: depositHash })
      setTxHash(depositHash)

      // Register in backend
      setStep('register')
      await createBounty({
        datasetId,
        enterpriseAddress: address,
        name: name.trim(),
        description: description.trim() || undefined,
        rewardPerTask: Number(rewardPerTask),
        tasks: validTasks,
      })

      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setStep('form')
    }
  }

  const stepLabels: Record<Step, string> = {
    form: 'Create Bounty',
    approve: 'Approving USDC…',
    deposit: 'Depositing to Escrow…',
    register: 'Registering dataset…',
    done: 'Done!',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="bounty-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass-card w-full max-w-lg p-6 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">New Labeling Bounty</h2>
          <button
            id="modal-close"
            onClick={onClose}
            className="text-[--color-text-muted] hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {step === 'done' ? (
          <div className="text-center py-8 animate-fade-in">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold mb-2">Bounty Live!</h3>
            <p className="text-[--color-text-secondary] mb-6">
              Workers are already completing your tasks on-chain.
            </p>
            <button id="done-btn" onClick={onSuccess} className="btn-primary">
              View Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-[--color-text-secondary] mb-2">
                Dataset Name *
              </label>
              <input
                id="bounty-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer Sentiment v1"
                className="w-full bg-[--color-bg-glass] border border-[--color-bg-glass-border] rounded-xl px-4 py-3 text-white placeholder:text-[--color-text-muted] focus:outline-none focus:border-[--color-brand-primary] transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[--color-text-secondary] mb-2">
                Description
              </label>
              <textarea
                id="bounty-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Instructions for workers…"
                className="w-full bg-[--color-bg-glass] border border-[--color-bg-glass-border] rounded-xl px-4 py-3 text-white placeholder:text-[--color-text-muted] focus:outline-none focus:border-[--color-brand-primary] transition-colors resize-none"
              />
            </div>

            {/* Upload JSON */}
            <div>
              <label className="block text-sm font-medium text-[--color-text-secondary] mb-2">
                Upload Tasks (JSON)
              </label>
              <input
                id="bounty-file"
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[--color-bg-glass-border] rounded-xl py-4 text-[--color-text-muted] hover:border-[--color-brand-primary] hover:text-[--color-brand-secondary] transition-all text-sm"
              >
                {tasks.filter((t) => t.promptA).length > 0
                  ? `✓ ${tasks.filter((t) => t.promptA && t.promptB).length} task pairs loaded`
                  : 'Click to upload tasks.json'}
              </button>
              <p className="text-xs text-[--color-text-muted] mt-1">
                Format: {'[{"promptA": "...", "promptB": "..."}, ...]'}
              </p>
            </div>

            {/* Summary */}
            <div className="glass-card p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[--color-text-secondary]">Tasks</span>
                <span className="font-medium">{totalTasks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[--color-text-secondary]">Reward / task</span>
                <span className="font-medium text-[--color-success]">0.1 USDC</span>
              </div>
              <div className="h-px bg-[--color-bg-glass-border] my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Total (incl. 3% fee)</span>
                <span className="text-[--color-brand-secondary]">
                  {totalTasks > 0
                    ? `~${(Number(grossCost) / 1e6).toFixed(2)} USDC`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[--color-error] text-sm bg-[--color-error]/10 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            {/* Progress steps */}
            {step !== 'form' && (
              <div className="flex items-center gap-2 text-sm text-[--color-text-secondary]">
                <div className="w-4 h-4 border-2 border-[--color-brand-primary] border-t-transparent rounded-full animate-spin" />
                {stepLabels[step]}
              </div>
            )}

            {/* Submit */}
            <button
              id="create-bounty-btn"
              onClick={handleSubmit}
              disabled={step !== 'form' || totalTasks === 0 || !address}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {step === 'form' ? 'Deposit & Launch Bounty' : stepLabels[step]}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
