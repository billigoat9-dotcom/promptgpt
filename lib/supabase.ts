import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Public (browser) client - uses anon/public key
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server / admin client - uses service role key when available.
// This client should be used for server-side privileged operations (deletes, admin tasks).
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
export const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase;
