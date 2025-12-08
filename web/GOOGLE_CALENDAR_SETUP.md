# Google Calendar Integration Setup Guide

This guide will walk you through setting up Google Calendar integration for HandyProFL.

## Features

- **Automatic Availability Sync**: Sync your Google Calendar to automatically mark busy times as unavailable
- **Event Creation**: When clients book appointments, events are automatically created in your Google Calendar
- **Two-Way Sync**: Updates in your calendar reflect in the booking system
- **Smart Scheduling**: Automatically generates 30-minute slots during business hours (9 AM - 7 PM ET)

## Prerequisites

1. A Google account with Google Calendar enabled
2. Access to Google Cloud Console
3. Admin access to HandyProFL

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "HandyProFL Calendar")
4. Click "Create"

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on "Google Calendar API"
4. Click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (for testing) or Internal (if using Google Workspace)
   - App name: HandyProFL
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add the following scopes:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
   - Test users: Add your admin email address
   - Click "Save and Continue"

4. Back on "Create OAuth client ID":
   - Application type: Web application
   - Name: HandyProFL Web Client
   - Authorized redirect URIs:
     - For local development: `http://localhost:3000/api/calendar/callback`
     - For production: `https://yourdomain.com/api/calendar/callback`
   - Click "Create"

5. Copy your Client ID and Client Secret

## Step 4: Configure Environment Variables

1. Open your `.env.local` file in the `web` directory

2. Add the following environment variables:

```bash
# Google Calendar Integration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback
```

3. For production deployment on Netlify:
   - Go to your Netlify site settings
   - Navigate to "Environment variables"
   - Add the same three variables with your production redirect URI:
     ```
     GOOGLE_REDIRECT_URI=https://yourdomain.com/api/calendar/callback
     ```

## Step 5: Run Database Migrations

1. Open the Supabase SQL editor for your project
2. Run the migration script located at `web/supabase-migrations.sql`
3. This will create the necessary tables:
   - `google_calendar_credentials` - Stores OAuth tokens
   - `calendar_sync_log` - Tracks sync history
   - Updates to `service_requests` and `available_slots` tables

## Step 6: Connect Your Calendar

1. Log in to HandyProFL as an admin
2. Navigate to Admin → Settings
3. Scroll to the "Google Calendar Sync" section
4. Click "Connect Google Calendar"
5. You'll be redirected to Google's OAuth consent screen
6. Sign in with your Google account
7. Grant the requested permissions
8. You'll be redirected back to the settings page

## Step 7: Sync Your Availability

1. After connecting, click "Sync Availability Now"
2. This will:
   - Read your calendar for the next 30 days
   - Create 30-minute slots during business hours (9 AM - 7 PM ET, weekdays)
   - Mark busy times as unavailable
   - Store everything in the `available_slots` table

3. You can re-sync at any time to update availability

## How It Works

### Availability Sync

- **Business Hours**: 9 AM - 7 PM ET
- **Days**: Monday - Friday (weekends excluded by default)
- **Slot Duration**: 30 minutes
- **Sync Range**: Next 30 days

The sync process:
1. Queries Google Calendar's FreeBusy API
2. Generates time slots during business hours
3. Marks slots that overlap with calendar events as booked
4. Stores slots in the database with `source: 'google_calendar'`

### Automatic Event Creation

When a client books an appointment:
1. The booking is saved to the database
2. An event is automatically created in your Google Calendar
3. The event includes:
   - Service type and client name
   - Appointment time and duration
   - Client email (as attendee)
   - Automatic reminders (1 day and 1 hour before)

### Token Refresh

OAuth tokens are automatically refreshed when they expire. You don't need to reconnect unless there's an error.

## Customization

### Modify Business Hours

Edit the sync parameters in [google-calendar.ts](src/utils/google-calendar.ts:87-95):

```typescript
export async function generateAvailableSlots(
  userId: string,
  startDate: Date,
  endDate: Date,
  slotDurationMinutes: number = 30,
  businessHoursStart: number = 9,    // Change start hour
  businessHoursEnd: number = 19      // Change end hour
)
```

### Enable Weekends

Remove the weekend check in [google-calendar.ts](src/utils/google-calendar.ts:106-110):

```typescript
// Comment out or remove these lines:
// const dayOfWeek = currentDate.getDay();
// if (dayOfWeek === 0 || dayOfWeek === 6) {
//   currentDate.setDate(currentDate.getDate() + 1);
//   continue;
// }
```

### Change Slot Duration

Update the sync API call in the admin settings or pass a different value:

```typescript
// In AdminSettingsContent.tsx
slot_duration_minutes: 60  // For 1-hour slots
```

## Troubleshooting

### "Google Calendar not connected" Error

- Make sure you've completed the OAuth flow
- Check that environment variables are set correctly
- Verify the redirect URI matches what's configured in Google Cloud Console

### "Token expired" Error

- Click "Reconnect Calendar" in the admin settings
- This will refresh your OAuth tokens

### Slots Not Syncing

- Check the sync log for errors (visible in admin settings)
- Verify the Google Calendar API is enabled in Google Cloud Console
- Ensure your account has calendar access

### Events Not Creating on Booking

- Check that at least one admin has connected their calendar
- Look for errors in the server logs
- Verify the service request was created successfully

## API Endpoints

- `GET /api/calendar/connect` - Initiates OAuth flow
- `GET /api/calendar/callback` - OAuth callback handler
- `GET /api/calendar/status` - Check connection status
- `POST /api/calendar/sync` - Trigger availability sync
- `GET /api/calendar/sync` - Get last sync status

## Database Tables

### google_calendar_credentials

Stores OAuth tokens and calendar configuration:
- `access_token` - Current access token
- `refresh_token` - Refresh token for auto-renewal
- `token_expiry` - When the token expires
- `calendar_id` - Primary calendar ID

### calendar_sync_log

Tracks sync operations:
- `synced_at` - When the sync occurred
- `sync_start_date` / `sync_end_date` - Date range synced
- `slots_created` / `slots_updated` / `slots_deleted` - Operation counts
- `status` - success/failed
- `error_message` - Error details if failed

### service_requests (updated)

Added fields:
- `google_calendar_event_id` - Event ID in Google Calendar
- `synced_to_calendar` - Whether event was created successfully
- `calendar_sync_error` - Error message if sync failed

### available_slots (updated)

Added fields:
- `source` - 'manual' or 'google_calendar'
- `google_calendar_event_id` - Associated calendar event
- `last_synced_at` - Last sync timestamp

## Security Notes

- OAuth tokens are stored encrypted in Supabase
- Refresh tokens allow automatic token renewal
- Only admins can connect calendars and trigger syncs
- RLS policies protect calendar credentials
- Tokens are automatically refreshed before expiry

## Support

For issues or questions:
1. Check the calendar sync log in admin settings
2. Review server logs for detailed error messages
3. Ensure all environment variables are set correctly
4. Verify Google Cloud Console configuration

## Next Steps

After setup:
1. Test the sync by creating a calendar event and re-syncing
2. Book a test appointment and verify it appears in your calendar
3. Set up a cron job or scheduled task to auto-sync daily (optional)
4. Customize business hours and slot duration to match your availability
