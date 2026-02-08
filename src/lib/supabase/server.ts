import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Server-side client with service role key — bypasses RLS
// ONLY use in API routes, never expose to client
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
