// ============================================================
// SIXTEEN — apps/web/src/app/token/[address]/page.tsx
// Token detail page
// ============================================================

import { createServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { BondingCurveBar } from '@/components/token/BondingCurveBar'
import { TradingPanel } from '@/components/token/TradingPanel'

interface Props {
  params: { address: string }
}

async function getToken(address: string) {
  const db = createServerClient()
  const { data, error } = await db
    .from('meme_tokens')
    .select(`*, agents ( name, type, wallet_address )`)
    .eq('token_address', address)
    .single()
  if (error || !data) return null
  return data
}

async function getTokenTrades(address: string) {
  const db = createServerClient()
  const { data } = await db
    .from('agent_trades')
    .select(`*, agents ( name )`)
    .eq('token_address', address)
    .order('created_at', { ascending: false })
    .limit(20)
  return data ?? []
}

export default async function TokenPage({ params }: Props) {
  const [token, trades] = await Promise.all([
    getToken(params.address),
    getTokenTrades(params.address),
  ])
  if (!token) notFound()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: media + info */}
      <div className="lg:col-span-2 space-y-4">
        {/* Media */}
        <div className="card overflow-hidden">
          {token.asset_type === 'video' && token.video_url ? (
            <video
              src={token.video_url}
              poster={token.image_url}
              controls
              className="w-full aspect-video bg-gray-900"
            />
          ) : (
            <div className="relative aspect-video bg-gray-900">
              <Image src={token.image_url} alt={token.name} fill className="object-contain" />
            </div>
          )}
        </div>

        {/* Token info */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{token.name}</h1>
              <span className="text-gray-400 font-mono">${token.symbol}</span>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs text-gray-500">Sixteen Score</div>
              <div className="text-2xl font-bold text-brand-purple">
                ★ {Math.round(token.sixteen_score)}
              </div>
            </div>
          </div>
          <p className="text-gray-300 text-sm">{token.description}</p>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-800">
            <div>
              <div className="stat-label">Virality score</div>
              <div className="stat-value text-brand-teal">{token.virality_score}/100</div>
            </div>
            <div>
              <div className="stat-label">Phase</div>
              <div className="stat-value capitalize">{token.phase}</div>
            </div>
            <div>
              <div className="stat-label">Label</div>
              <div className="stat-value">{token.label}</div>
            </div>
          </div>

          {/* Bonding curve */}
          <BondingCurveBar pct={token.bonding_curve_pct} />

          {/* Creator info */}
          <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-800">
            <div className="text-gray-400">
              Created by agent <span className="text-white">{token.agents?.name}</span>
            </div>
            <a
              href={`https://testnet.bscscan.com/token/${token.token_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-purple hover:underline text-xs font-mono"
            >
              {token.token_address.slice(0, 6)}…{token.token_address.slice(-4)} ↗
            </a>
          </div>

          {/* Tax info */}
          <div className="bg-gray-950 rounded-lg p-3 space-y-1 text-xs">
            <div className="text-gray-500 font-medium mb-2">Token tax breakdown (per trade)</div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total fee</span>
              <span className="text-white">{token.tax_fee_rate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Creator royalty</span>
              <span className="text-brand-teal">{token.recipient_rate}% of fee</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Holder dividends</span>
              <span className="text-white">{token.divide_rate}% of fee</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Burn</span>
              <span className="text-white">{token.burn_rate}% of fee</span>
            </div>
          </div>
        </div>

        {/* Trade history */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Recent trades</h2>
          {trades.length === 0 ? (
            <p className="text-gray-600 text-sm">No trades yet</p>
          ) : (
            <div className="space-y-2">
              {trades.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={t.action === 'buy' ? 'text-green-400' : 'text-red-400'}>
                      {t.action === 'buy' ? '▲ BUY' : '▼ SELL'}
                    </span>
                    <span className="text-gray-400">{(t as { agents?: { name: string } }).agents?.name}</span>
                  </div>
                  <div className="text-gray-300 font-mono">
                    {(Number(BigInt(t.amount_wei)) / 1e18).toFixed(4)} BNB
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: trading panel */}
      <div className="space-y-4">
        <TradingPanel
          tokenAddress={token.token_address}
          tokenName={token.name}
          symbol={token.symbol}
          phase={token.phase}
        />
      </div>
    </div>
  )
}
