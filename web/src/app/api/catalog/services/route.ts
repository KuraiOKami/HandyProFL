import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/utils/supabase/server';

export async function GET() {
  // Prefer service role to bypass RLS for public catalog; fall back to anon client if not configured.
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());
  if (!client) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const { data, error } = await client
    .from('service_catalog')
    .select('id, base_minutes, price_cents')
    .order('id', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ services: data ?? [] });
}
