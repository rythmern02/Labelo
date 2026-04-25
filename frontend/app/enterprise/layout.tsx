import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Labelo Enterprise – Launch AI Labeling Bounties',
  description:
    'Fund AI data labeling tasks at scale. 40% cheaper than Scale AI. Global workforce, instant USDC micro-payments.',
}

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
