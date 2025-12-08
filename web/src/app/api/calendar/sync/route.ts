/**
 * API Route: POST /api/calendar/sync
 * Syncs availability from Google Calendar to available_slots table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateAvailableSlots, syncSlotsToDatabase } from '@/utils/google-calendar';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body for date range (optional)
    const body = await request.json().catch(() => ({}));

    // Default: sync next 30 days
    const startDate = body.start_date
      ? new Date(body.start_date)
      : new Date();

    const endDate = body.end_date
      ? new Date(body.end_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const slotDurationMinutes = body.slot_duration_minutes || 30;

    // Generate available slots from Google Calendar
    const slots = await generateAvailableSlots(
      user.id,
      startDate,
      endDate,
      slotDurationMinutes
    );

    // Sync to database
    const result = await syncSlotsToDatabase(slots, startDate, endDate);

    return NextResponse.json({
      success: true,
      message: 'Calendar synced successfully',
      sync_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      stats: {
        slots_created: result.created,
        slots_updated: result.updated,
        slots_deleted: result.deleted,
        total_slots: slots.length,
        available_slots: slots.filter(s => !s.is_booked).length,
      },
    });
  } catch (error) {
    console.error('Calendar sync error:', error);

    // Provide helpful error messages
    let errorMessage = 'Failed to sync calendar';
    if (error instanceof Error) {
      if (error.message.includes('credentials not found')) {
        errorMessage = 'Google Calendar not connected. Please connect your calendar first.';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calendar/sync - Get last sync status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch last sync log
    const { data: lastSync, error } = await supabase
      .from('calendar_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !lastSync) {
      return NextResponse.json({
        last_sync: null,
        message: 'No sync history found'
      });
    }

    return NextResponse.json({
      last_sync: lastSync,
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
