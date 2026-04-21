// ============================================================
// SIXTEEN — apps/web/src/lib/rate-limit.ts
// Simple in-memory rate limiter for Next.js API routes.
// Prevents API abuse — applied to write endpoints.
// Uses a sliding window algorithm.
// ============================================================

interface RateLimitEntry {
  count:     number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  windowMs:  number   // time window in milliseconds
  max:       number   // max requests per window
}

interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetMs:    number   // ms until window resets
}

export function rateLimit(
  key: string,
  options: RateLimitOptions = { windowMs: 60_000, max: 20 }
): RateLimitResult {
  const now     = Date.now()
  const entry   = store.get(key)

  // New window or no entry
  if (!entry || now - entry.windowStart > options.windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: options.max - 1, resetMs: options.windowMs }
  }

  // Within window
  if (entry.count >= options.max) {
    const resetMs = options.windowMs - (now - entry.windowStart)
    return { allowed: false, remaining: 0, resetMs }
  }

  entry.count++
  const remaining = options.max - entry.count
  const resetMs   = options.windowMs - (now - entry.windowStart)
  return { allowed: true, remaining, resetMs }
}

// Clean up old entries every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 300_000) store.delete(key)
  }
}, 300_000)

// ── Convenience: get IP from Next.js request ──────────────

export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// ── Rate limit presets ────────────────────────────────────

export const LIMITS = {
  // Public read endpoints — generous limit
  read:   { windowMs: 60_000, max: 120 },
  // Write endpoints — tighter
  write:  { windowMs: 60_000, max: 20  },
  // Prediction bets — strict
  bet:    { windowMs: 60_000, max: 5   },
  // Agent control — very strict
  agent:  { windowMs: 60_000, max: 10  },
}
