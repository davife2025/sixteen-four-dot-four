'use client'
// ============================================================
// SIXTEEN — apps/web/src/hooks/useWallet.ts
// Wallet connect hook — MetaMask / injected provider
// Handles: connect, disconnect, network switch to BNB testnet,
// balance fetch, and persists connection across page refreshes
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'

export const BSC_TESTNET = {
  chainId:         '0x61',   // 97 in hex
  chainName:       'BNB Smart Chain Testnet',
  nativeCurrency:  { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls:         ['https://data-seed-prebsc-1-s1.binance.org:8545'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

export interface WalletState {
  address:   string | null
  balance:   string | null       // formatted BNB balance
  chainId:   number | null
  connected: boolean
  wrongNetwork: boolean
  loading:   boolean
}

export interface WalletActions {
  connect:       () => Promise<void>
  disconnect:    () => void
  switchNetwork: () => Promise<void>
  getSigner:     () => ethers.BrowserProvider | null
}

export function useWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    address:      null,
    balance:      null,
    chainId:      null,
    connected:    false,
    wrongNetwork: false,
    loading:      false,
  })

  const getProvider = useCallback((): ethers.BrowserProvider | null => {
    if (typeof window === 'undefined') return null
    const win = window as Window & { ethereum?: ethers.Eip1193Provider }
    if (!win.ethereum) return null
    return new ethers.BrowserProvider(win.ethereum)
  }, [])

  const getSigner = useCallback((): ethers.BrowserProvider | null => {
    return getProvider()
  }, [getProvider])

  const fetchBalance = useCallback(async (address: string, provider: ethers.BrowserProvider) => {
    try {
      const raw = await provider.getBalance(address)
      return parseFloat(ethers.formatEther(raw)).toFixed(4)
    } catch {
      return null
    }
  }, [])

  const updateState = useCallback(async (provider: ethers.BrowserProvider) => {
    const network  = await provider.getNetwork()
    const accounts = await provider.listAccounts()
    const address  = accounts[0]?.address ?? null
    const chainId  = Number(network.chainId)
    const wrongNetwork = chainId !== 97  // BNB testnet

    const balance = address && !wrongNetwork
      ? await fetchBalance(address, provider)
      : null

    setState({
      address,
      balance,
      chainId,
      connected:    !!address,
      wrongNetwork,
      loading:      false,
    })
  }, [fetchBalance])

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    const wasConnected = localStorage.getItem('sixteen_wallet_connected') === 'true'
    if (wasConnected) {
      void updateState(provider)
    }

    const win = window as Window & { ethereum?: { on: (e: string, cb: (...args: unknown[]) => void) => void; removeListener: (e: string, cb: (...args: unknown[]) => void) => void } }
    if (!win.ethereum) return

    const handleAccountsChanged = () => void updateState(provider)
    const handleChainChanged    = () => void updateState(provider)

    win.ethereum.on('accountsChanged', handleAccountsChanged)
    win.ethereum.on('chainChanged',    handleChainChanged)

    return () => {
      win.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      win.ethereum?.removeListener('chainChanged',    handleChainChanged)
    }
  }, [getProvider, updateState])

  const connect = useCallback(async () => {
    const provider = getProvider()
    if (!provider) {
      alert('MetaMask not found. Please install MetaMask to connect.')
      return
    }

    setState((s) => ({ ...s, loading: true }))

    try {
      await provider.send('eth_requestAccounts', [])
      await updateState(provider)
      localStorage.setItem('sixteen_wallet_connected', 'true')
    } catch (err) {
      console.error('[wallet] Connect failed:', err)
      setState((s) => ({ ...s, loading: false }))
    }
  }, [getProvider, updateState])

  const disconnect = useCallback(() => {
    localStorage.removeItem('sixteen_wallet_connected')
    setState({
      address: null, balance: null, chainId: null,
      connected: false, wrongNetwork: false, loading: false,
    })
  }, [])

  const switchNetwork = useCallback(async () => {
    const win = window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
    if (!win.ethereum) return

    try {
      await win.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_TESTNET.chainId }],
      })
    } catch (switchErr: unknown) {
      // Chain not added yet — add it
      if ((switchErr as { code?: number }).code === 4902) {
        await win.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_TESTNET],
        })
      }
    }
  }, [])

  return { ...state, connect, disconnect, switchNetwork, getSigner }
}
