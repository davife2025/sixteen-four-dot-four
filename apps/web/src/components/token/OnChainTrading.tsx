'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/token/OnChainTrading.tsx
// Real on-chain buy/sell panel — calls four.meme TokenManager2
// directly via MetaMask. Uses TokenManagerHelper3 for quotes.
// ============================================================

import { useState } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '@/hooks/useWallet'

// four.meme TokenManagerHelper3 — for quote functions
const HELPER3_ADDRESS   = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
const HELPER3_ABI = [
  'function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)',
  'function tryBuy(address token, uint256 funds) view returns (address tokenManager, address quote, uint256 amount, uint256 fee)',
  'function trySell(address token, uint256 amount) view returns (address tokenManager, address quote, uint256 funds, uint256 fee)',
]

const TOKEN_MANAGER2_ABI = [
  'function buyTokenAMAP(address token, uint256 minAmount) external payable returns (uint256)',
  'function sellToken(address token, uint256 amount, uint256 minFunds) external returns (uint256)',
]

interface Props {
  tokenAddress: string
  tokenName:    string
  symbol:       string
  phase:        string
}

export function OnChainTrading({ tokenAddress, tokenName, symbol, phase }: Props) {
  const wallet = useWallet()

  const [tab, setTab]           = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount]     = useState('')
  const [quote, setQuote]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [txHash, setTxHash]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function getReadProvider(): Promise<ethers.JsonRpcProvider> {
    return new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545')
  }

  async function fetchBuyQuote(bnbAmount: string): Promise<void> {
    if (!bnbAmount || isNaN(parseFloat(bnbAmount))) return
    try {
      const provider = await getReadProvider()
      const helper   = new ethers.Contract(HELPER3_ADDRESS, HELPER3_ABI, provider)
      const funds    = ethers.parseEther(bnbAmount)
      const result   = await (helper['tryBuy'] as (
        token: string, funds: bigint
      ) => Promise<{ amount: bigint; fee: bigint }>)(tokenAddress, funds)
      const tokens   = parseFloat(ethers.formatEther(result.amount))
      setQuote(`≈ ${tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${symbol}`)
    } catch {
      setQuote(null)
    }
  }

  async function fetchSellQuote(tokenAmount: string): Promise<void> {
    if (!tokenAmount || isNaN(parseFloat(tokenAmount))) return
    try {
      const provider = await getReadProvider()
      const helper   = new ethers.Contract(HELPER3_ADDRESS, HELPER3_ABI, provider)
      const amt      = ethers.parseEther(tokenAmount)
      const result   = await (helper['trySell'] as (
        token: string, amount: bigint
      ) => Promise<{ funds: bigint; fee: bigint }>)(tokenAddress, amt)
      const bnb      = parseFloat(ethers.formatEther(result.funds))
      setQuote(`≈ ${bnb.toFixed(4)} tBNB`)
    } catch {
      setQuote(null)
    }
  }

  async function handleAmountChange(val: string) {
    setAmount(val)
    setQuote(null)
    setError(null)
    if (!val) return
    if (tab === 'buy')  await fetchBuyQuote(val)
    if (tab === 'sell') await fetchSellQuote(val)
  }

  async function executeBuy() {
    if (!wallet.connected || !wallet.getSigner()) {
      await wallet.connect(); return
    }
    if (wallet.wrongNetwork) { await wallet.switchNetwork(); return }
    if (!amount) { setError('Enter an amount'); return }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const browserProvider = wallet.getSigner()!
      const signer = await browserProvider.getSigner()
      const provider = await getReadProvider()
      const helper   = new ethers.Contract(HELPER3_ADDRESS, HELPER3_ABI, provider)

      // Get token manager address
      const info = await (helper['getTokenInfo'] as (
        token: string
      ) => Promise<{ tokenManager: string; version: bigint }>)(tokenAddress)

      if (Number(info.version) !== 2) throw new Error('Only TokenManager V2 supported')

      // Get buy quote for min amount (slippage: accept 5% less)
      const funds  = ethers.parseEther(amount)
      const quoteRes = await (helper['tryBuy'] as (
        token: string, funds: bigint
      ) => Promise<{ amount: bigint }>)(tokenAddress, funds)
      const minAmount = (quoteRes.amount * 95n) / 100n  // 5% slippage

      // Execute buy via MetaMask
      const tm2 = new ethers.Contract(info.tokenManager, TOKEN_MANAGER2_ABI, signer)
      const tx  = await (tm2['buyTokenAMAP'] as (
        token: string, minAmount: bigint, opts: { value: bigint }
      ) => Promise<ethers.ContractTransactionResponse>)(
        tokenAddress, minAmount, { value: funds }
      )

      setTxHash(tx.hash)
      await tx.wait()
      setAmount('')
      setQuote(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setError(msg.includes('user rejected') ? 'Transaction rejected in MetaMask' : msg)
    } finally {
      setLoading(false)
    }
  }

  async function executeSell() {
    if (!wallet.connected || !wallet.getSigner()) {
      await wallet.connect(); return
    }
    if (wallet.wrongNetwork) { await wallet.switchNetwork(); return }
    if (!amount) { setError('Enter token amount to sell'); return }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const browserProvider = wallet.getSigner()!
      const signer = await browserProvider.getSigner()
      const provider = await getReadProvider()
      const helper   = new ethers.Contract(HELPER3_ADDRESS, HELPER3_ABI, provider)

      const info = await (helper['getTokenInfo'] as (
        token: string
      ) => Promise<{ tokenManager: string; version: bigint }>)(tokenAddress)

      if (Number(info.version) !== 2) throw new Error('Only TokenManager V2 supported')

      const tokenAmt = ethers.parseEther(amount)
      const quoteRes = await (helper['trySell'] as (
        token: string, amount: bigint
      ) => Promise<{ funds: bigint }>)(tokenAddress, tokenAmt)
      const minFunds = (quoteRes.funds * 95n) / 100n

      const tm2 = new ethers.Contract(info.tokenManager, TOKEN_MANAGER2_ABI, signer)
      const tx  = await (tm2['sellToken'] as (
        token: string, amount: bigint, minFunds: bigint
      ) => Promise<ethers.ContractTransactionResponse>)(
        tokenAddress, tokenAmt, minFunds
      )

      setTxHash(tx.hash)
      await tx.wait()
      setAmount('')
      setQuote(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setError(msg.includes('user rejected') ? 'Transaction rejected in MetaMask' : msg)
    } finally {
      setLoading(false)
    }
  }

  const isInsider = phase === 'insider'

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <h3 className="font-semibold text-white">Trade {symbol}</h3>

      {/* Insider phase notice */}
      {isInsider && (
        <div className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-2 rounded-xl">
          🔒 Insider Phase — only EIP-8004 registered agent wallets can trade right now
        </div>
      )}

      {/* Buy / Sell tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-800">
        {(['buy', 'sell'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(''); setQuote(null); setError(null) }}
            className={`flex-1 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? t === 'buy'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-500">
          {tab === 'buy' ? 'Amount (tBNB)' : `Amount (${symbol})`}
        </label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step={tab === 'buy' ? '0.001' : '1'}
            value={amount}
            onChange={(e) => void handleAmountChange(e.target.value)}
            placeholder={tab === 'buy' ? '0.01' : '1000'}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-purple transition-colors pr-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">
            {tab === 'buy' ? 'tBNB' : symbol}
          </span>
        </div>
        {quote && (
          <p className="text-xs text-gray-400 pl-1">{quote}</p>
        )}
      </div>

      {/* Quick amount buttons */}
      {tab === 'buy' && (
        <div className="flex gap-2">
          {['0.01', '0.05', '0.1', '0.2'].map((v) => (
            <button
              key={v}
              onClick={() => void handleAmountChange(v)}
              className="flex-1 text-xs py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Action button */}
      <button
        onClick={tab === 'buy' ? executeBuy : executeSell}
        disabled={loading || !amount}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
          tab === 'buy'
            ? 'bg-green-500/20 text-green-400 border border-green-500/20 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30'
        }`}
      >
        {loading ? 'Confirming in MetaMask…' :
          !wallet.connected ? 'Connect Wallet to Trade' :
          wallet.wrongNetwork ? 'Switch to BNB Testnet' :
          tab === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`
        }
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      {/* Success */}
      {txHash && (
        <a
          href={`https://testnet.bscscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-2 rounded-xl hover:bg-teal-500/20 transition-colors"
        >
          ✓ Transaction confirmed — view on BscScan ↗
        </a>
      )}

      {/* Slippage note */}
      <p className="text-xs text-gray-600 text-center">5% slippage tolerance · 1% buy fee · 1% sell fee</p>
    </div>
  )
}
