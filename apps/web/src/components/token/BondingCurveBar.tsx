'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/token/BondingCurveBar.tsx
// Visual bonding curve progress bar
// ============================================================

interface BondingCurveBarProps {
  pct: number   // 0-100
}

export function BondingCurveBar({ pct }: BondingCurveBarProps) {
  const filled = Math.min(pct, 100)
  const isNearGraduation = filled >= 80

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-400 font-medium">Bonding curve</span>
        <span className={isNearGraduation ? 'text-brand-amber font-semibold' : 'text-gray-300'}>
          {filled.toFixed(1)}% filled
          {isNearGraduation && ' 🎓 Near graduation!'}
        </span>
      </div>
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isNearGraduation
              ? 'bg-gradient-to-r from-brand-amber to-yellow-400'
              : 'bg-gradient-to-r from-brand-teal to-brand-purple'
          }`}
          style={{ width: `${filled}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>0 BNB</span>
        <span>24 BNB → PancakeSwap</span>
      </div>
    </div>
  )
}
