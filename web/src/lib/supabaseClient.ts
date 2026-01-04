'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '@/utils/supabase/browser';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;

  const instance = createBrowserClient();
  if (!instance) {
    console.warn('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    return null;
  }

  client = instance;
  return client;
}
