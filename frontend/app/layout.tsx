import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Labelo – Decentralized RLHF Network',
  description:
    'Earn crypto by labeling AI data. The decentralized Scale AI built on Initia — stream micro-payments with every swipe.',
  keywords: ['RLHF', 'AI labeling', 'Initia', 'crypto', 'data labeling', 'Web3'],
  openGraph: {
    title: 'Labelo',
    description: 'Earn USDC labeling AI data on the Initia AppChain',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen text-white antialiased relative selection:bg-[--color-brand-primary] selection:text-white">
        {/* Fixed Background Video */}
        <div className="fixed inset-0 z-[-1] overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          >
            <source src="/AI_Labelling_Platform_Video_Asset.mp4" type="video/mp4" />
          </video>
          {/* Subtle overlay to enhance contrast without hiding the video */}
          <div className="absolute inset-0 bg-black/10 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
        </div>

        <div className="relative z-0 min-h-screen">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}
