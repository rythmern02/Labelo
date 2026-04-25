'use client'

import { useEffect, useRef, useState } from 'react'
import { useReadContract } from 'wagmi'
import { BOUNTY_ESCROW_ABI, BOUNTY_ESCROW_ADDRESS, USDC_DECIMALS } from '@/lib/contracts'

interface BalanceTickerProps {
  workerAddress: `0x${string}` | undefined
}

export default function BalanceTicker({ workerAddress }: BalanceTickerProps) {
  const [displayBalance, setDisplayBalance] = useState('0.000000')
  const [flash, setFlash] = useState(false)
  const prevBalance = useRef(0n)

  const { data: rawBalance } = useReadContract({
    address: BOUNTY_ESCROW_ADDRESS,
    abi: BOUNTY_ESCROW_ABI,
    functionName: 'workerBalance',
    args: workerAddress ? [workerAddress] : undefined,
    query: {
      enabled: !!workerAddress,
      refetchInterval: 3_000,
    },
  })

  useEffect(() => {
    if (rawBalance === undefined) return
    const balance = rawBalance as bigint

    if (balance > prevBalance.current) {
      // Flash animation on balance increase
      setFlash(true)
      setTimeout(() => setFlash(false), 600)
    }

    prevBalance.current = balance
    const formatted = (Number(balance) / 10 ** USDC_DECIMALS).toFixed(6)
    setDisplayBalance(formatted)
  }, [rawBalance])

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium tracking-widest uppercase text-[--color-text-muted]">
        Earned Today
      </span>
      <div
        className={`text-4xl font-bold balance-glow transition-all duration-300 ${
          flash ? 'animate-ticker scale-110' : ''
        }`}
        aria-label={`Balance: ${displayBalance} USDC`}
      >
        ${displayBalance}
      </div>
      <span className="text-xs text-[--color-text-secondary]">USDC · Claimable anytime</span>
    </div>
  )
}
