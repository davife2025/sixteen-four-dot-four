'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/token/TradingPanel.tsx
// Buy/Sell panel on token detail page
// In Session 5 this connects to wallet — for now shows UI
// ============================================================

import { useState } from 'react'

interface TradingPanelProps {
  tokenAddress: string
  tokenName: string
  symbol: string
  phase: string
}

export function TradingPanel({ tokenAddress, tokenName, symbol, phase }: TradingPanelProps) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')

  const isInsider = phase === 'insider'

  return (
    <div className="card p-4 space-y-4 sticky top-20">
      <h2 className="text-sm font-semibold text-gray-300">Trade {symbol}</h2>

      {/* Insider phase notice */}
      {isInsider && (
        <div className="bg-purple-900/20 border border-purple-800/40 rounded-lg p-3 text-xs text-purple-300">
          🔒 <strong>Insider Phase</strong> — only registered agent wallets can trade right now.
          Public phase opens when the insider period ends.
        </div>
      )}

      {/* Buy / Sell tabs */}
      <div className="flex rounded-lg overflow-hidden border border-gray-800">
        <button
          onClick={() => setTab('buy')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            tab === 'buy'
              ? 'bg-green-900/40 text-green-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setTab('sell')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            tab === 'sell'
              ? 'bg-red-900/40 text-red-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500">
          {tab === 'buy' ? 'Amount (BNB)' : `Amount ($${symbol})`}
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm pr-16 focus:outline-none focus:border-brand-purple"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {tab === 'buy' ? 'BNB' : symbol}
          </span>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2">
          {['0.01', '0.05', '0.1', '0.2'].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="flex-1 text-xs py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Action button */}
      <button
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
          tab === 'buy'
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white'
        }`}
        onClick={() => alert('Connect wallet to trade')}
      >
        {tab === 'buy' ? `Buy $${symbol}` : `Sell $${symbol}`}
      </button>

      {/* Fee info */}
      <div className="text-xs text-gray-600 text-center">
        5% trading fee · 40% goes to creator
      </div>

      {/* Contract link */}
      <div className="text-center">
        <a
          href={`https://testnet.bscscan.com/token/${tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:text-gray-400 font-mono"
        >
          {tokenAddress.slice(0, 10)}…{tokenAddress.slice(-6)} ↗
        </a>
      </div>
    </div>
  )
}
