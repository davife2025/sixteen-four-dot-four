// ============================================================
// SIXTEEN — apps/web/src/components/ui/Skeletons.tsx
// Loading skeleton components — shown while data fetches
// Mirrors the exact shape of the real components
// ============================================================

// ── Token card skeleton ───────────────────────────────────

export function TokenCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 space-y-3 animate-pulse">
      <div className="skeleton h-40 w-full rounded-xl" />
      <div className="space-y-2">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-6 w-16 rounded-full" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-2 w-full rounded-full" />
      <div className="flex justify-between">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    </div>
  )
}

// ── Token feed skeleton ───────────────────────────────────

export function TokenFeedSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <TokenCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ── Agent card skeleton ───────────────────────────────────

export function AgentCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-3 w-28 rounded" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1 text-center">
            <div className="skeleton h-7 w-16 mx-auto rounded" />
            <div className="skeleton h-3 w-12 mx-auto rounded" />
          </div>
        ))}
      </div>
      <div className="skeleton h-9 w-full rounded-xl" />
    </div>
  )
}

// ── Leaderboard row skeleton ──────────────────────────────

export function LeaderboardSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-900 border border-gray-800">
          <div className="skeleton w-8 h-6 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
          <div className="skeleton h-5 w-24 rounded" />
          <div className="hidden sm:block skeleton h-5 w-16 rounded" />
          <div className="hidden sm:block skeleton h-5 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Token page skeleton ───────────────────────────────────

export function TokenPageSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
      <div className="lg:col-span-2 space-y-6">
        <div className="skeleton h-80 w-full rounded-2xl" />
        <div className="space-y-3">
          <div className="skeleton h-8 w-64 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-3/4 rounded" />
        </div>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
      <div className="space-y-4">
        <div className="skeleton h-64 w-full rounded-2xl" />
        <div className="skeleton h-48 w-full rounded-2xl" />
        <div className="skeleton h-32 w-full rounded-2xl" />
      </div>
    </div>
  )
}

// ── Stats bar skeleton ────────────────────────────────────

export function LiveStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900 p-4 space-y-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Log row skeleton ──────────────────────────────────────

export function LogsSkeleton({ rows = 15 }: { rows?: number }) {
  return (
    <div className="space-y-0 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50">
          <div className="skeleton w-16 h-3 rounded" />
          <div className="skeleton w-24 h-3 rounded" />
          <div className="skeleton w-14 h-5 rounded-full" />
          <div className="flex-1 skeleton h-3 rounded" />
          <div className="skeleton w-16 h-3 rounded" />
          <div className="skeleton w-4 h-4 rounded" />
        </div>
      ))}
    </div>
  )
}
