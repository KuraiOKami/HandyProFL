-- Google Calendar Integration Schema
-- Run this migration in your Supabase SQL editor

-- Table to store Google Calendar OAuth credentials
CREATE TABLE IF NOT EXISTS google_calendar_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  calendar_id TEXT NOT NULL, -- Primary calendar ID to sync
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies for google_calendar_credentials
ALTER TABLE google_calendar_credentials ENABLE ROW LEVEL SECURITY;

-- Only admins can manage their own credentials
CREATE POLICY "Admins can manage their own calendar credentials"
  ON google_calendar_credentials
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Table to track sync status
CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_start_date DATE NOT NULL,
  sync_end_date DATE NOT NULL,
  slots_created INTEGER DEFAULT 0,
  slots_updated INTEGER DEFAULT 0,
  slots_deleted INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success', -- success, failed, partial
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS for calendar_sync_log (admin-only read)
ALTER TABLE calendar_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
  ON calendar_sync_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add Google Calendar event ID to service_requests for two-way sync
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS synced_to_calendar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_sync_error TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_requests_calendar_event
  ON service_requests(google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;

-- Add metadata to available_slots for Google Calendar sync
ALTER TABLE available_slots
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual', -- 'manual' or 'google_calendar'
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_available_slots_source
  ON available_slots(source);

-- Create a view for displaying available slots with enhanced metadata
CREATE OR REPLACE VIEW available_slots_view AS
SELECT
  id,
  slot_start,
  slot_end,
  is_booked,
  source,
  google_calendar_event_id,
  last_synced_at,
  EXTRACT(EPOCH FROM (slot_end - slot_start)) / 60 AS duration_minutes,
  to_char(slot_start AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS date,
  to_char(slot_start AT TIME ZONE 'America/New_York', 'HH24:MI') AS start_time,
  to_char(slot_end AT TIME ZONE 'America/New_York', 'HH24:MI') AS end_time
FROM available_slots
ORDER BY slot_start;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for google_calendar_credentials
CREATE TRIGGER update_google_calendar_credentials_updated_at
  BEFORE UPDATE ON google_calendar_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions to authenticated users
GRANT SELECT ON available_slots_view TO authenticated;
GRANT ALL ON google_calendar_credentials TO authenticated;
GRANT SELECT ON calendar_sync_log TO authenticated;

-- Comments for documentation
COMMENT ON TABLE google_calendar_credentials IS 'Stores OAuth tokens for Google Calendar integration';
COMMENT ON TABLE calendar_sync_log IS 'Tracks history of Google Calendar synchronization operations';
COMMENT ON COLUMN service_requests.google_calendar_event_id IS 'Google Calendar event ID for two-way sync';
COMMENT ON COLUMN available_slots.source IS 'Source of the slot: manual or google_calendar';
