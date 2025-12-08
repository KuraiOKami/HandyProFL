import { createClient, createServiceRoleClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Use service role client to bypass RLS
  const adminSupabase = createServiceRoleClient() ?? supabase;

  // Fetch all service requests with dates
  const { data: events, error } = await adminSupabase
    .from('service_requests')
    .select('id, service_type, preferred_date, preferred_time, status, user_id')
    .not('preferred_date', 'is', null)
    .order('preferred_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    events: events ?? [],
  });
}
