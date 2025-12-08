/**
 * API Route: GET /api/calendar/status
 * Returns Google Calendar connection status
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ connected: false, error: 'Configuration error' }, { status: 500 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ connected: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Check if credentials exist
    const { data: credentials, error } = await supabase
      .from('google_calendar_credentials')
      .select('calendar_id, token_expiry, updated_at')
      .eq('user_id', user.id)
      .single();

    if (error || !credentials) {
      return NextResponse.json({
        connected: false,
        message: 'No calendar connected'
      });
    }

    // Check if token is expired
    const tokenExpiry = new Date(credentials.token_expiry);
    const isExpired = tokenExpiry < new Date();

    return NextResponse.json({
      connected: true,
      calendar_id: credentials.calendar_id,
      token_expiry: credentials.token_expiry,
      is_expired: isExpired,
      last_updated: credentials.updated_at,
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    return NextResponse.json(
      { error: 'Failed to check calendar status' },
      { status: 500 }
    );
  }
}
