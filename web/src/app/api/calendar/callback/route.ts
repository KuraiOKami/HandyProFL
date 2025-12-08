/**
 * API Route: GET /api/calendar/callback
 * Handles OAuth callback from Google
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { handleOAuthCallback } from '@/utils/google-calendar';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      new URL('/admin/settings?calendar_error=access_denied', request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/admin/settings?calendar_error=missing_code', request.url)
    );
  }

  try {
    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(
        new URL('/admin/settings?calendar_error=unauthorized', request.url)
      );
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(
        new URL('/admin/settings?calendar_error=admin_only', request.url)
      );
    }

    // Exchange code for tokens and store
    await handleOAuthCallback(code, user.id);

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL('/admin/settings?calendar_connected=true', request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/admin/settings?calendar_error=callback_failed', request.url)
    );
  }
}
