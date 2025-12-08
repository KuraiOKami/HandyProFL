/**
 * API Route: GET /api/calendar/connect
 * Initiates Google Calendar OAuth flow
 */

import { NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/utils/google-calendar';

export async function GET() {
  try {
    const authUrl = getAuthorizationUrl();

    // Redirect user to Google's OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to initiate calendar connection' },
      { status: 500 }
    );
  }
}
