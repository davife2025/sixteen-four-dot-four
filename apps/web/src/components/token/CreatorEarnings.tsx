'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/token/CreatorEarnings.tsx
// Shows real-time creator royalty data from the TaxToken
// contract. Lets creator claim their accumulated fees directly.
// ============================================================

import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'

const TAX_TOKEN_ABI = [
  'function claimableFee(address account) view returns (uint256)',
  'function claimedFee(address account) view returns (uint256)',
  'function feeRate() view returns (uint256)',
  'function rateFounder() view returns (uint256)',
  'function founder() view returns (address)',
  'function claimFee() external',
]

interface Props {
  tokenAddress: string
  creatorWallet: string
}

export function CreatorEarnings({ tokenAddress, creatorWallet }: Props) {
  const wallet = useWallet()

  const [claimable, setClaimable] = useState<string | null>(null)
  const [claimed,   setClaimed]   = useState<string | null>(null)
  const [feeRate,   setFeeRate]   = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [txHash,    setTxHash]    = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const provider  = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545')
        const contract  = new ethers.Contract(tokenAddress, TAX_TOKEN_ABI, provider)

        const [claimableWei, claimedWei, feeRateRaw] = await Promise.all([
          (contract['claimableFee'] as (a: string) => Promise<bigint>)(creatorWallet),
          (contract['claimedFee']   as (a: string) => Promise<bigint>)(creatorWallet),
          contract['feeRate']() as Promise<bigint>,
        ])

        setClaimable(parseFloat(ethers.formatEther(claimableWei)).toFixed(6))
        setClaimed(parseFloat(ethers.formatEther(claimedWei)).toFixed(6))
        // feeRate is in basis points (10000 = 100%)
        setFeeRate((Number(feeRateRaw) / 100).toFixed(1))
      } catch {
        // Token may not be a TaxToken — silently skip
      }
    }
    void load()
    const interval = setInterval(() => void load(), 30_000)
    return () => clearInterval(interval)
  }, [tokenAddress, creatorWallet])

  async function handleClaim() {
    if (!wallet.connected) { await wallet.connect(); return }
    if (wallet.wrongNetwork) { await wallet.switchNetwork(); return }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const browserProvider = wallet.getSigner()!
      const signer   = await browserProvider.getSigner()
      const contract = new ethers.Contract(tokenAddress, TAX_TOKEN_ABI, signer)
      const tx       = await (contract['claimFee'] as () => Promise<ethers.ContractTransactionResponse>)()
      setTxHash(tx.hash)
      await tx.wait()
      // Refresh claimable
      setClaimable('0.000000')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed'
      setError(msg.includes('user rejected') ? 'Rejected in MetaMask' : msg)
    } finally {
      setLoading(false)
    }
  }

  if (!claimable) return null

  const isCreator = wallet.address?.toLowerCase() === creatorWallet.toLowerCase()
  const hasFees   = parseFloat(claimable ?? '0') > 0

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Creator Royalties</h3>
        {feeRate && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">
            {feeRate}% fee on every trade
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Claimable now</p>
          <p className={`text-lg font-bold tabular-nums ${hasFees ? 'text-green-400' : 'text-gray-400'}`}>
            {claimable} BNB
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Total claimed</p>
          <p className="text-lg font-bold tabular-nums text-gray-300">
            {claimed} BNB
          </p>
        </div>
      </div>

      {isCreator && hasFees && (
        <button
          onClick={handleClaim}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/20 text-sm font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-40"
        >
          {loading ? 'Claiming…' : `Claim ${claimable} BNB`}
        </button>
      )}

      {isCreator && !hasFees && (
        <p className="text-xs text-gray-500 text-center">
          No claimable royalties yet — earnings accumulate as your token gets traded
        </p>
      )}

      {!isCreator && (
        <p className="text-xs text-gray-500 text-center">
          Royalties go to creator: {creatorWallet.slice(0, 10)}…{creatorWallet.slice(-4)}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}
      {txHash && (
        <a
          href={`https://testnet.bscscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-2 rounded-xl hover:bg-teal-500/20 transition-colors"
        >
          ✓ Claimed — view on BscScan ↗
        </a>
      )}
    </div>
  )
}
