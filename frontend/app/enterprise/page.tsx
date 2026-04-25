'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { truncate } from '@initia/utils'
import BountyModal from '@/components/BountyModal'
import { fetchAllBounties, BountyProgress } from '@/lib/api'

export default function EnterpriseDashboard() {
  const { address } = useAccount()
  const { username, openConnect, openWallet, openBridge } = useInterwovenKit()

  const [showModal, setShowModal] = useState(false)
  const [bounties, setBounties] = useState<BountyProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [totalPaid, setTotalPaid] = useState(0)

  const loadBounties = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllBounties()
      setBounties(data)
      const paid = data.reduce((sum, b) => sum + b.completed_tasks * b.reward_per_task, 0)
      setTotalPaid(paid)
    } catch {
      // silently fail — backend may not be running yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBounties()
    // Poll every 5s
    const interval = setInterval(loadBounties, 5_000)
    return () => clearInterval(interval)
  }, [loadBounties])

  const bridgeDetails = {
    srcChainId: 'ethereum',
    srcDenom: 'USDC',
    dstChainId: process.env.NEXT_PUBLIC_IW_CHAIN_ID ?? 'labelo-1',
    dstDenom: 'USDC',
  }

  return (
    <div className="gradient-bg min-h-screen text-white">
      {/* Navbar */}
      <nav className="border-b border-[--color-bg-glass-border] backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[--color-brand-primary] to-[--color-brand-accent] flex items-center justify-center">
                🏷️
              </div>
              Labelo
            </Link>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-[--color-brand-primary]/15 text-[--color-brand-secondary] border border-[--color-brand-primary]/20">
              Enterprise
            </span>
          </div>

          <div className="flex items-center gap-3">
            {address ? (
              <>
                <button
                  id="bridge-btn"
                  onClick={() => openBridge(bridgeDetails)}
                  className="text-sm font-medium text-[--color-brand-accent] hover:text-[--color-brand-secondary] transition-colors"
                >
                  Bridge USDC →
                </button>
                <button id="wallet-btn" onClick={openWallet} className="glass-card text-sm px-4 py-2 rounded-full hover:border-[--color-brand-primary]/50 transition-all">
                  {truncate(username ?? address)}
                </button>
              </>
            ) : (
              <button id="connect-btn" onClick={openConnect} className="btn-primary text-sm py-2">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-4xl font-black mb-3">
            Data Labeling at{' '}
            <span className="bg-gradient-to-r from-[--color-brand-primary] to-[--color-brand-accent] bg-clip-text text-transparent">
              Web3 Speed
            </span>
          </h1>
          <p className="text-[--color-text-secondary] text-lg max-w-xl">
            Deploy labeling bounties directly to a global crypto workforce. 40% cheaper than Scale AI.
            Instant USDC micro-payments on-chain.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Bounties', value: bounties.filter((b) => b.status === 'active').length.toString() },
            { label: 'Total Tasks Posted', value: bounties.reduce((s, b) => s + b.total_tasks, 0).toLocaleString() },
            { label: 'Completed Tasks', value: bounties.reduce((s, b) => s + b.completed_tasks, 0).toLocaleString() },
            { label: 'USDC Distributed', value: `$${(totalPaid / 1e6).toFixed(2)}` },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-5">
              <div className="text-2xl font-black text-[--color-brand-secondary] mb-1">{stat.value}</div>
              <div className="text-xs text-[--color-text-muted]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            id="new-bounty-btn"
            onClick={() => (address ? setShowModal(true) : openConnect())}
            className="btn-primary"
          >
            + New Bounty
          </button>
          <button
            onClick={() => address && openBridge(bridgeDetails)}
            className="glass-card text-sm font-medium px-5 py-3 rounded-full hover:border-[--color-brand-primary]/50 transition-all"
          >
            Bridge USDC from Ethereum
          </button>
          <Link
            href="/"
            className="glass-card text-sm font-medium px-5 py-3 rounded-full hover:border-[--color-brand-accent]/50 transition-all text-[--color-brand-accent]"
          >
            View Worker App ↗
          </Link>
        </div>

        {/* Bounties Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[--color-bg-glass-border] flex items-center justify-between">
            <h2 className="font-bold text-lg">Active Bounties</h2>
            <div className="flex items-center gap-2 text-xs text-[--color-text-muted]">
              {loading && <div className="w-3 h-3 border border-[--color-brand-primary] border-t-transparent rounded-full animate-spin" />}
              Live · refreshes every 5s
            </div>
          </div>

          {bounties.length === 0 ? (
            <div className="text-center py-16 text-[--color-text-muted]">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-sm">No bounties yet. Create your first one above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[--color-text-muted] text-xs border-b border-[--color-bg-glass-border]">
                    <th className="text-left px-5 py-3 font-medium">Dataset</th>
                    <th className="text-right px-5 py-3 font-medium">Progress</th>
                    <th className="text-right px-5 py-3 font-medium">Reward / Task</th>
                    <th className="text-right px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bounties.map((b, i) => (
                    <tr
                      key={b.id}
                      className={`border-b border-[--color-bg-glass-border] hover:bg-[--color-bg-glass] transition-colors ${
                        i === bounties.length - 1 ? 'border-none' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">{b.name}</div>
                        {b.description && (
                          <div className="text-xs text-[--color-text-muted] mt-0.5 line-clamp-1">
                            {b.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="text-right mb-1.5 text-xs text-[--color-text-secondary]">
                          {b.completed_tasks}/{b.total_tasks} ({b.progressPct}%)
                        </div>
                        <div className="progress-track w-32 ml-auto">
                          <div className="progress-fill" style={{ width: `${b.progressPct}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-[--color-success]">
                        ${(b.reward_per_task / 1e6).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                            b.status === 'active'
                              ? 'bg-[--color-success]/10 text-[--color-success]'
                              : b.status === 'completed'
                              ? 'bg-[--color-brand-primary]/10 text-[--color-brand-secondary]'
                              : 'bg-[--color-text-muted]/10 text-[--color-text-muted]'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Value prop cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {[
            {
              icon: '⚡',
              title: '10,000+ Workers',
              desc: 'Global mobile-first workforce earning daily crypto income.',
            },
            {
              icon: '🔐',
              title: 'On-Chain Escrow',
              desc: 'Your funds locked in an audited smart contract. Released only on task completion.',
            },
            {
              icon: '🌉',
              title: 'Bridge from Ethereum',
              desc: 'Deposit USDC from any EVM chain via Initia\'s Interwoven Bridge in one click.',
            },
          ].map((card) => (
            <div key={card.title} className="glass-card rounded-2xl p-5">
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="font-bold mb-1">{card.title}</h3>
              <p className="text-sm text-[--color-text-secondary]">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bounty Modal */}
      {showModal && (
        <BountyModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            loadBounties()
          }}
        />
      )}
    </div>
  )
}
