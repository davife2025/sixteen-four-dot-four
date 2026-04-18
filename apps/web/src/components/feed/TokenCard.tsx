'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/feed/TokenCard.tsx
// Meme token card — handles both image and video tokens
// Shows bonding curve, virality score, phase badge
// ============================================================

import Image from 'next/image'
import Link from 'next/link'

interface Token {
  id: string
  token_address: string
  name: string
  symbol: string
  description: string
  image_url: string
  video_url: string | null
  asset_type: 'image' | 'video'
  label: string
  phase: string
  bonding_curve_pct: number
  virality_score: number
  sixteen_score: number
  created_at: string
  agents?: { name: string; type: string } | null
}

const PHASE_STYLES: Record<string, string> = {
  insider:   'badge-purple',
  public:    'badge-teal',
  graduated: 'badge-amber',
}

const PHASE_LABELS: Record<string, string> = {
  insider:   '🔒 Insider',
  public:    '🌐 Public',
  graduated: '🎓 Graduated',
}

export function TokenCard({ token }: { token: Token }) {
  const timeAgo = getTimeAgo(token.created_at)

  return (
    <Link href={`/token/${token.token_address}`}>
      <div className="card-hover overflow-hidden group">
        {/* Media */}
        <div className="relative aspect-square bg-gray-800 overflow-hidden">
          {token.asset_type === 'video' && token.video_url ? (
            <video
              src={token.video_url}
              poster={token.image_url}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <Image
              src={token.image_url}
              alt={token.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          )}

          {/* Video badge */}
          {token.asset_type === 'video' && (
            <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
              ▶ Video
            </span>
          )}

          {/* Sixteen score */}
          <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-full">
            ★ {Math.round(token.sixteen_score)}
          </span>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          {/* Name + phase */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm truncate">{token.name}</div>
              <div className="text-xs text-gray-500">${token.symbol}</div>
            </div>
            <span className={PHASE_STYLES[token.phase] ?? 'badge-purple'}>
              {PHASE_LABELS[token.phase] ?? token.phase}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-400 line-clamp-2">{token.description}</p>

          {/* Bonding curve */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Bonding curve</span>
              <span className="text-gray-300">{token.bonding_curve_pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-teal to-brand-purple rounded-full transition-all"
                style={{ width: `${Math.min(token.bonding_curve_pct, 100)}%` }}
              />
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-800">
            <span className="flex items-center gap-1">
              <span className="text-gray-500">🤖</span>
              <span className="truncate max-w-[80px]">
                {token.agents?.name ?? 'Agent'}
              </span>
            </span>
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
