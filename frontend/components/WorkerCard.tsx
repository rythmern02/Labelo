'use client'

import { useState } from 'react'
import { Task } from '@/lib/api'

interface WorkerCardProps {
  task: Task
  onSelect: (winner: 'A' | 'B') => Promise<void>
  isSubmitting: boolean
}

export default function WorkerCard({ task, onSelect, isSubmitting }: WorkerCardProps) {
  const [selected, setSelected] = useState<'A' | 'B' | null>(null)

  const isImageUrl = (s: string) =>
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(s) || s.startsWith('http')

  const handleSelect = async (winner: 'A' | 'B') => {
    if (isSubmitting || selected) return
    setSelected(winner)
    await onSelect(winner)
    // Reset after brief delay so user sees the selection
    setTimeout(() => setSelected(null), 400)
  }

  const renderContent = (text: string) => {
    if (isImageUrl(text)) {
      return (
        <img
          src={text}
          alt="AI output"
          className="w-full h-full object-cover rounded-xl"
          draggable={false}
        />
      )
    }
    return (
      <p className="text-sm leading-relaxed text-[--color-text-primary] text-center px-2 line-clamp-6">
        {text}
      </p>
    )
  }

  return (
    <div className="w-full animate-fade-in">
      {/* Instruction */}
      <p className="text-center text-sm text-[--color-text-secondary] mb-5">
        Which AI response is{' '}
        <span className="text-[--color-brand-secondary] font-semibold">better?</span>
      </p>

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Option A */}
        <button
          id="option-a"
          onClick={() => handleSelect('A')}
          disabled={isSubmitting || !!selected}
          className={`btn-option ${selected === 'A' ? 'selected-a' : ''}`}
          aria-label="Choose option A"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[--color-brand-primary] text-white text-xs font-bold mb-3 shrink-0">
            A
          </span>
          <div className="w-full flex-1 flex items-center justify-center overflow-hidden">
            {renderContent(task.promptA)}
          </div>
        </button>

        {/* Option B */}
        <button
          id="option-b"
          onClick={() => handleSelect('B')}
          disabled={isSubmitting || !!selected}
          className={`btn-option ${selected === 'B' ? 'selected-b' : ''}`}
          aria-label="Choose option B"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[--color-brand-accent] text-[--color-bg-base] text-xs font-bold mb-3 shrink-0">
            B
          </span>
          <div className="w-full flex-1 flex items-center justify-center overflow-hidden">
            {renderContent(task.promptB)}
          </div>
        </button>
      </div>

      {/* Submitting indicator */}
      {isSubmitting && (
        <div className="flex items-center justify-center gap-2 mt-4 text-[--color-text-secondary] text-sm">
          <div className="w-4 h-4 border-2 border-[--color-brand-primary] border-t-transparent rounded-full animate-spin" />
          Recording on-chain…
        </div>
      )}
    </div>
  )
}
