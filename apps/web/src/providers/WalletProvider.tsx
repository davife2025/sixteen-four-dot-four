'use client'
// ============================================================
// SIXTEEN — apps/web/src/providers/WalletProvider.tsx
// React context wrapper — shares wallet state across entire app
// so any component can call useWalletContext() to get
// address, balance, connected status without prop drilling
// ============================================================

import { createContext, useContext, type ReactNode } from 'react'
import { useWallet, type WalletState, type WalletActions } from '@/hooks/useWallet'

type WalletContextValue = WalletState & WalletActions

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used inside WalletProvider')
  return ctx
}
