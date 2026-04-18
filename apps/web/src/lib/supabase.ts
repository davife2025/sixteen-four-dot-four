// ============================================================
// SIXTEEN — apps/web/src/lib/supabase.ts
// Supabase clients for Next.js App Router
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env['NEXT_PUBLIC_SUPABASE_URL']!
const supabaseAnon = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!

// Browser client — safe to use in client components
export const supabase = createClient(supabaseUrl, supabaseAnon)

// Server client — for server components and route handlers
export function createServerClient() {
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}
