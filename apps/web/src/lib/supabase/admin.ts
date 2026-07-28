import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Prefer the established service-role key. The rotated key remains a
  // fallback so existing deployments can migrate without breaking admin APIs.
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY_ACTIVE
  if (!url || !secret) throw new Error('Configuração administrativa do Supabase ausente.')
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
}
