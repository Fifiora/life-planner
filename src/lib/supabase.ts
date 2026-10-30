import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False until the Supabase URL and anon key are provided at build time. */
export const isConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost:54321', key || 'anon-placeholder')
