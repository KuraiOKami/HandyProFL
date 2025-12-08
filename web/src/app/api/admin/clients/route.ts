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

  // Fetch all clients
  const { data: clients, error: clientsError } = await adminSupabase
    .from('profiles')
    .select('id, first_name, middle_initial, last_name, email, phone, street, city, state, postal_code, role')
    .order('updated_at', { ascending: false });

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  // Fetch service requests and addresses counts
  const { data: serviceRequests = [] } = await adminSupabase.from('service_requests').select('user_id');
  const { data: addresses = [] } = await adminSupabase.from('addresses').select('user_id');

  // Build count maps
  const requestCounts: Record<string, number> = {};
  (serviceRequests as { user_id: string }[]).forEach((r) => {
    requestCounts[r.user_id] = (requestCounts[r.user_id] ?? 0) + 1;
  });

  const addressCounts: Record<string, number> = {};
  (addresses as { user_id: string }[]).forEach((a) => {
    addressCounts[a.user_id] = (addressCounts[a.user_id] ?? 0) + 1;
  });

  return NextResponse.json({
    clients: clients ?? [],
    requestCounts,
    addressCounts,
  });
}
