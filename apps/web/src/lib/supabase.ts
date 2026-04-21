// ============================================================
// SIXTEEN — apps/web/src/lib/supabase.ts
// Supabase client helpers for Next.js App Router
// ============================================================

import { createClient } from '@supabase/supabase-js'

// ── Read env vars ─────────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      || process.env.SUPABASE_URL      || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const SUPABASE_SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY     || ''

// ── Validation helper ─────────────────────────────────────
function assertEnv(name: string, value: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}\n` +
      `Add it to apps/web/.env.local — get the value from your Supabase dashboard → Settings → API`
    )
  }
  return value
}

// ── Server client (service role) ─────────────────────────
// Use in Server Components and API routes only — never expose to browser
export function createServerClient() {
  return createClient(
    assertEnv('SUPABASE_URL', SUPABASE_URL),
    assertEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SVC_KEY),
    { auth: { persistSession: false } }
  )
}

// ── Browser client (anon key) ─────────────────────────────
// Use in Client Components for Realtime subscriptions
let _browserClient: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (_browserClient) return _browserClient
  _browserClient = createClient(
    assertEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL),
    assertEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY)
  )
  return _browserClient
}