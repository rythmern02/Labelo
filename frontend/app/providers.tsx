'use client'

import { PropsWithChildren, useEffect } from 'react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  initiaPrivyWalletConnector,
  injectStyles,
  InterwovenKitProvider,
  TESTNET,
} from '@initia/interwovenkit-react'
import interwovenKitStyles from '@initia/interwovenkit-react/styles.js'

// ── Labelo Custom Rollup Chain Definition ─────────────────────────────────
// Replace these values with output from `weave rollup launch`
const labeloChain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 0),          // numeric chain ID from weave
  name: 'Labelo',
  nativeCurrency: { name: 'LAB', symbol: 'LAB', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL ?? 'https://YOUR-ROLLUP-RPC.initia.xyz'],
    },
  },
}

const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [labeloChain],
  transports: {
    [labeloChain.id]: http(),
  },
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 5_000 } },
})

export default function Providers({ children }: PropsWithChildren) {
  useEffect(() => {
    // Inject styles into the Initia Wallet shadow DOM
    injectStyles(interwovenKitStyles)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={process.env.NEXT_PUBLIC_IW_CHAIN_ID ?? 'labelo-1'}
          // Session key auto-signing: worker approves once per session,
          // all subsequent task submissions go through silently
          enableAutoSign={true}
        >
          {children}
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
