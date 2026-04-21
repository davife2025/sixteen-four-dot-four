'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/token/PriceChart.tsx
// Real-time price chart for a meme token
// Fetches OHLC data from Bitquery GraphQL
// Renders using lightweight recharts
// ============================================================

import { useEffect, useState } from 'react'

interface Candle {
  time:   string
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

interface Props {
  tokenAddress: string
  symbol:       string
}

type TimeRange = '1H' | '6H' | '24H' | '7D'

const RANGE_CONFIG: Record<TimeRange, { intervalMins: number; limit: number; label: string }> = {
  '1H':  { intervalMins: 1,    limit: 60,  label: '1 min'  },
  '6H':  { intervalMins: 5,    limit: 72,  label: '5 mins' },
  '24H': { intervalMins: 15,   limit: 96,  label: '15 mins'},
  '7D':  { intervalMins: 60,   limit: 168, label: '1 hour' },
}

export function PriceChart({ tokenAddress, symbol }: Props) {
  const [candles,   setCandles]   = useState<Candle[]>([])
  const [range,     setRange]     = useState<TimeRange>('24H')
  const [loading,   setLoading]   = useState(true)
  const [hovered,   setHovered]   = useState<Candle | null>(null)

  useEffect(() => {
    async function fetchCandles() {
      setLoading(true)
      try {
        const res  = await fetch(`/api/analytics/price?token=${tokenAddress}&range=${range}`)
        const data = await res.json() as { candles: Candle[] }
        setCandles(data.candles ?? [])
      } catch {
        setCandles([])
      } finally {
        setLoading(false)
      }
    }
    void fetchCandles()
    const id = setInterval(() => void fetchCandles(), 30_000)
    return () => clearInterval(id)
  }, [tokenAddress, range])

  // Compute chart dimensions
  const prices    = candles.map((c) => c.close)
  const minPrice  = Math.min(...prices)
  const maxPrice  = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 1

  const W = 600
  const H = 160
  const PAD = { top: 10, bottom: 20, left: 10, right: 10 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  function xPos(i: number) {
    return PAD.left + (i / Math.max(candles.length - 1, 1)) * chartW
  }
  function yPos(price: number) {
    return PAD.top + chartH - ((price - minPrice) / priceRange) * chartH
  }

  // Build SVG path for line chart
  const linePath = candles.length
    ? candles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yPos(c.close)}`).join(' ')
    : ''

  // Build fill path (area under line)
  const areaPath = candles.length
    ? `${linePath} L ${xPos(candles.length - 1)} ${H - PAD.bottom} L ${xPos(0)} ${H - PAD.bottom} Z`
    : ''

  const isUp = candles.length >= 2
    ? (candles[candles.length - 1]?.close ?? 0) >= (candles[0]?.close ?? 0)
    : true

  const color     = isUp ? '#1D9E75' : '#D85A30'
  const colorFill = isUp ? 'rgba(29,158,117,0.12)' : 'rgba(216,90,48,0.12)'

  const lastCandle  = candles[candles.length - 1]
  const firstCandle = candles[0]
  const pctChange   = firstCandle && lastCandle
    ? ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100
    : 0

  const displayCandle = hovered ?? lastCandle

  function formatPrice(p: number) {
    if (p < 0.000001) return p.toExponential(3)
    if (p < 0.001)    return p.toFixed(8)
    if (p < 1)        return p.toFixed(6)
    return p.toFixed(4)
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{symbol} / tBNB</p>
          {displayCandle && (
            <p className="text-2xl font-bold text-white tabular-nums">
              {formatPrice(displayCandle.close)} BNB
            </p>
          )}
          {!hovered && lastCandle && (
            <p className={`text-sm font-medium tabular-nums ${pctChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}% ({range})
            </p>
          )}
          {hovered && (
            <p className="text-xs text-gray-500">
              {new Date(hovered.time).toLocaleString()}
            </p>
          )}
        </div>

        {/* Range selector */}
        <div className="flex gap-1">
          {(Object.keys(RANGE_CONFIG) as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                range === r
                  ? 'bg-brand-purple text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-xl z-10">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {candles.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
            No price data yet — token needs to have trades
          </div>
        ) : (
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="overflow-visible"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id={`grad-${tokenAddress.slice(2, 8)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0"   />
              </linearGradient>
            </defs>

            {/* Area fill */}
            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#grad-${tokenAddress.slice(2, 8)})`}
              />
            )}

            {/* Price line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hover dots */}
            {candles.map((c, i) => (
              <rect
                key={i}
                x={xPos(i) - 6}
                y={PAD.top}
                width={12}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHovered(c)}
              />
            ))}

            {/* Hovered point indicator */}
            {hovered && (() => {
              const idx = candles.findIndex((c) => c.time === hovered.time)
              if (idx < 0) return null
              return (
                <>
                  <line
                    x1={xPos(idx)} y1={PAD.top}
                    x2={xPos(idx)} y2={H - PAD.bottom}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={xPos(idx)}
                    cy={yPos(hovered.close)}
                    r="4"
                    fill={color}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                </>
              )
            })()}

            {/* Price labels */}
            <text x={PAD.left} y={PAD.top + 4}    fontSize="9" fill="#6b7280" textAnchor="start">{formatPrice(maxPrice)}</text>
            <text x={PAD.left} y={H - PAD.bottom - 2} fontSize="9" fill="#6b7280" textAnchor="start">{formatPrice(minPrice)}</text>
          </svg>
        )}
      </div>

      {/* Volume bar */}
      {candles.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Volume</p>
          <div className="flex items-end gap-0.5 h-8">
            {candles.slice(-48).map((c, i) => {
              const maxVol = Math.max(...candles.map((x) => x.volume))
              const h = maxVol > 0 ? (c.volume / maxVol) * 100 : 0
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-opacity hover:opacity-100 opacity-70"
                  style={{
                    height: `${Math.max(h, 4)}%`,
                    background: c.close >= c.open ? '#1D9E75' : '#D85A30',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
