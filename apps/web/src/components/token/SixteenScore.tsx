'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/token/SixteenScore.tsx
// Visual breakdown of a token's Sixteen Score
// Score = 50% virality + 30% bonding curve + 20% video bonus
// ============================================================

interface Props {
  viralityScore:    number   // 0-100
  bondingCurvePct:  number   // 0-100
  assetType:        'image' | 'video'
  sixteenScore:     number   // computed total
}

export function SixteenScore({ viralityScore, bondingCurvePct, assetType, sixteenScore }: Props) {
  const viralityContrib  = viralityScore * 0.5
  const bondingContrib   = bondingCurvePct * 0.3
  const videoBonus       = assetType === 'video' ? 20 : 0
  const total            = Math.min(sixteenScore, 100)

  const scoreColor =
    total >= 80 ? 'text-green-400' :
    total >= 60 ? 'text-brand-teal' :
    total >= 40 ? 'text-amber-400' :
    'text-red-400'

  const scoreBg =
    total >= 80 ? 'bg-green-400' :
    total >= 60 ? 'bg-brand-teal' :
    total >= 40 ? 'bg-amber-400' :
    'bg-red-400'

  const label =
    total >= 80 ? 'Hot 🔥' :
    total >= 60 ? 'Trending' :
    total >= 40 ? 'Warming up' :
    'Cold'

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Sixteen Score</h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
            {total.toFixed(1)}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>

      {/* Overall bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{label}</span>
          <span>{total.toFixed(1)} pts</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${scoreBg}`}
            style={{ width: `${Math.min(total, 100)}%` }}
          />
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-2.5">
        {/* Virality */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Virality score × 50%</span>
            <span className="text-gray-300 font-mono">+{viralityContrib.toFixed(1)}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1">
            <div
              className="h-1 rounded-full bg-brand-purple transition-all duration-500"
              style={{ width: `${viralityScore}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">Kimi K2 virality prediction: {viralityScore}/100</p>
        </div>

        {/* Bonding curve */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Bonding curve × 30%</span>
            <span className="text-gray-300 font-mono">+{bondingContrib.toFixed(1)}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1">
            <div
              className="h-1 rounded-full bg-brand-teal transition-all duration-500"
              style={{ width: `${bondingCurvePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">Market demand: {bondingCurvePct.toFixed(1)}% filled</p>
        </div>

        {/* Video bonus */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Video bonus</span>
          <span className={`font-mono font-medium ${videoBonus > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
            {videoBonus > 0 ? `+${videoBonus}` : '—'}
          </span>
        </div>
      </div>

      {/* Divider + formula */}
      <div className="border-t border-gray-800 pt-3">
        <p className="text-xs text-gray-600 text-center">
          Score = (virality × 0.5) + (curve × 0.3) + (video ? 20 : 0)
        </p>
      </div>
    </div>
  )
}
