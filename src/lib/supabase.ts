import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envSupabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const isDemoModeEnabled = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';
export const isSupabaseConfigured = Boolean(
  envSupabaseUrl &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(envSupabaseUrl) &&
    envSupabasePublishableKey &&
    !envSupabasePublishableKey.includes('your_')
);

const supabaseUrl = isSupabaseConfigured ? envSupabaseUrl! : 'https://example.supabase.co';
const supabasePublishableKey = isSupabaseConfigured ? envSupabasePublishableKey! : 'sb_publishable_placeholder';

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
      storageKey: 'icjs-laptop-auth',
    },
  }
);
