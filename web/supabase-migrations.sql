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
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_fee_cents INTEGER DEFAULT 0;

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

-- ============================================
-- AGENT PORTAL SCHEMA
-- Run this migration to enable agent features
-- ============================================

-- Extended profiles for agents (service providers)
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio TEXT,
  photo_url TEXT,
  skills TEXT[] DEFAULT '{}', -- array of service categories they can handle
  service_area_miles INTEGER DEFAULT 25, -- service radius
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_jobs INTEGER DEFAULT 0,
  total_earnings_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_approval', -- pending_approval, approved, suspended
  stripe_account_id TEXT, -- Stripe Connect Express account ID
  stripe_account_status TEXT DEFAULT 'pending', -- pending, enabled, restricted
  stripe_payouts_enabled BOOLEAN DEFAULT false,
  stripe_charges_enabled BOOLEAN DEFAULT false,
  instant_payout_enabled BOOLEAN DEFAULT false,
  payout_schedule TEXT DEFAULT 'weekly', -- weekly, instant
  selfie_url TEXT, -- optional selfie/profile photo
  identity_verification_status TEXT DEFAULT 'not_started', -- not_started, pending, verified, canceled
  stripe_identity_session_id TEXT, -- last created Stripe Identity session
  identity_verified_at TIMESTAMPTZ, -- when identity was verified
  identity_verification_notes TEXT, -- optional notes or last error
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for agent_profiles
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

-- Agents can view and update their own profile
CREATE POLICY "Agents can view own profile"
  ON agent_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Agents can update own profile"
  ON agent_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their agent profile"
  ON agent_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can view all agent profiles
CREATE POLICY "Admins can view all agent profiles"
  ON agent_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update any agent profile (for approval/suspension)
CREATE POLICY "Admins can update agent profiles"
  ON agent_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Job assignments linking service_requests to agents
CREATE TABLE IF NOT EXISTS job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_by TEXT NOT NULL DEFAULT 'agent', -- 'agent' (self-claimed) or 'admin'
  assigned_by_user_id UUID REFERENCES auth.users(id), -- who assigned (for admin assignments)
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ, -- when agent checked in
  completed_at TIMESTAMPTZ, -- when agent checked out
  job_price_cents INTEGER NOT NULL, -- total job price
  agent_payout_cents INTEGER NOT NULL, -- 70% of job price
  platform_fee_cents INTEGER NOT NULL, -- 30% of job price
  status TEXT DEFAULT 'assigned', -- assigned, in_progress, completed, cancelled
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id) -- one agent per job
);

-- Enable RLS for job_assignments
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- Agents can view their own assignments
CREATE POLICY "Agents can view own assignments"
  ON job_assignments FOR SELECT
  USING (agent_id = auth.uid());

-- Agents can update their own assignments (status changes)
CREATE POLICY "Agents can update own assignments"
  ON job_assignments FOR UPDATE
  USING (agent_id = auth.uid());

-- Agents can insert (claim jobs)
CREATE POLICY "Agents can insert assignments"
  ON job_assignments FOR INSERT
  WITH CHECK (agent_id = auth.uid());

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
  ON job_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Check-in/out records with GPS location
CREATE TABLE IF NOT EXISTS agent_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'checkin' or 'checkout'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location_verified BOOLEAN DEFAULT false,
  distance_from_job_meters INTEGER,
  device_info TEXT, -- optional device/browser info
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for agent_checkins
ALTER TABLE agent_checkins ENABLE ROW LEVEL SECURITY;

-- Agents can manage their own checkins
CREATE POLICY "Agents can manage own checkins"
  ON agent_checkins FOR ALL
  USING (agent_id = auth.uid());

-- Admins can view all checkins
CREATE POLICY "Admins can view all checkins"
  ON agent_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Proof of work photos
CREATE TABLE IF NOT EXISTS proof_of_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'box' (before/unopened) or 'finished' (after/completed)
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT, -- optional smaller version
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for proof_of_work
ALTER TABLE proof_of_work ENABLE ROW LEVEL SECURITY;

-- Agents can manage their own proof photos
CREATE POLICY "Agents can manage own proof"
  ON proof_of_work FOR ALL
  USING (agent_id = auth.uid());

-- Admins can view all proof photos
CREATE POLICY "Admins can view all proof"
  ON proof_of_work FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Clients can view proof for their own requests
CREATE POLICY "Clients can view proof for their requests"
  ON proof_of_work FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN service_requests sr ON sr.id = ja.request_id
      WHERE ja.id = proof_of_work.assignment_id
      AND sr.user_id = auth.uid()
    )
  );

-- Storage bucket for proof-of-work photos
insert into storage.buckets (id, name, public)
values ('proof-of-work', 'proof-of-work', true)
on conflict (id) do nothing;

-- Public read access to proof-of-work files
create policy "Public read proof-of-work files"
  on storage.objects for select
  using (bucket_id = 'proof-of-work');

-- Allow authenticated users to upload/update their proof-of-work files
create policy "Authenticated upload proof-of-work files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'proof-of-work');

create policy "Authenticated update proof-of-work files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'proof-of-work')
  with check (bucket_id = 'proof-of-work');

-- Broad allow for authenticated users to insert/update/delete in proof-of-work bucket
create policy "Authenticated manage proof-of-work objects"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'proof-of-work')
  with check (bucket_id = 'proof-of-work');

-- Storage bucket for agent verification selfies/photos
insert into storage.buckets (id, name, public)
values ('agent-verification', 'agent-verification', true)
on conflict (id) do nothing;

-- Allow public read of verification assets (e.g., admin review)
create policy "Public read agent-verification files"
  on storage.objects for select
  using (bucket_id = 'agent-verification');

-- Authenticated users can upload/update their own verification photos
create policy "Authenticated upload agent-verification files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'agent-verification');

create policy "Authenticated update agent-verification files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'agent-verification')
  with check (bucket_id = 'agent-verification');

-- ============================================
-- Notifications (preferences + log)
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_updates BOOLEAN DEFAULT true,
  sms_updates BOOLEAN DEFAULT true,
  push_updates BOOLEAN DEFAULT true,
  marketing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification prefs"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view notification prefs"
  ON notification_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL, -- sms, push, email
  template TEXT,
  title TEXT,
  body TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'queued', -- queued, sent, failed, skipped
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications"
  ON notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Agent earnings per job
CREATE TABLE IF NOT EXISTS agent_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  assignment_id UUID NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL, -- 70% of job price
  status TEXT DEFAULT 'pending', -- pending, available, paid_out
  available_at TIMESTAMPTZ, -- 2 hours after job completion
  paid_out_at TIMESTAMPTZ,
  payout_id UUID, -- reference to agent_payouts when paid
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id) -- one earning record per job
);

-- Enable RLS for agent_earnings
ALTER TABLE agent_earnings ENABLE ROW LEVEL SECURITY;

-- Agents can view their own earnings
CREATE POLICY "Agents can view own earnings"
  ON agent_earnings FOR SELECT
  USING (agent_id = auth.uid());

-- Admins can view all earnings
CREATE POLICY "Admins can view all earnings"
  ON agent_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Agent payouts (batch payments)
CREATE TABLE IF NOT EXISTS agent_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  amount_cents INTEGER NOT NULL, -- total payout amount
  type TEXT NOT NULL, -- 'weekly' or 'instant'
  instant_fee_cents INTEGER DEFAULT 0, -- fee for instant payout (1.5%)
  net_amount_cents INTEGER NOT NULL, -- amount after fees
  stripe_transfer_id TEXT, -- Stripe Transfer ID
  stripe_payout_id TEXT, -- Stripe Payout ID (for instant)
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  failure_reason TEXT,
  earnings_count INTEGER DEFAULT 0, -- number of jobs included
  period_start TIMESTAMPTZ, -- for weekly: start of period
  period_end TIMESTAMPTZ, -- for weekly: end of period
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for agent_payouts
ALTER TABLE agent_payouts ENABLE ROW LEVEL SECURITY;

-- Agents can view their own payouts
CREATE POLICY "Agents can view own payouts"
  ON agent_payouts FOR SELECT
  USING (agent_id = auth.uid());

-- Admins can view all payouts
CREATE POLICY "Admins can manage all payouts"
  ON agent_payouts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add agent assignment to service_requests
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS job_latitude DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS job_longitude DECIMAL(11,8);

-- Store pricing breakdown on the request for accurate agent payouts and material reimbursement
-- total_price_cents: full amount charged to the customer
-- labor_price_cents: commissioned labor portion (agent gets 70%)
-- materials_cost_cents: pass-through materials (agent gets 100% reimbursement)
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS total_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS labor_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS materials_cost_cents INTEGER;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- Add extended tracking for job lifecycle
ALTER TABLE job_assignments
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Create index for faster agent lookups
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_agent
  ON service_requests(assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_assignments_agent
  ON job_assignments(agent_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_status
  ON job_assignments(status);

CREATE INDEX IF NOT EXISTS idx_agent_earnings_agent_status
  ON agent_earnings(agent_id, status);

CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent
  ON agent_payouts(agent_id);

-- Trigger for agent_profiles updated_at
CREATE TRIGGER update_agent_profiles_updated_at
  BEFORE UPDATE ON agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for job_assignments updated_at
CREATE TRIGGER update_job_assignments_updated_at
  BEFORE UPDATE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for agent_earnings updated_at
CREATE TRIGGER update_agent_earnings_updated_at
  BEFORE UPDATE ON agent_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for agent_payouts updated_at
CREATE TRIGGER update_agent_payouts_updated_at
  BEFORE UPDATE ON agent_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure relationship for service_requests.user_id -> profiles.id (needed for Supabase row joins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_requests_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE service_requests
      ADD CONSTRAINT service_requests_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Allow assigned agents to update their service requests (e.g., status to pending_verification)
create policy "Agents can update assigned service requests"
  on service_requests for update
  to authenticated
  using (assigned_agent_id = auth.uid())
  with check (assigned_agent_id = auth.uid());

-- Allow agents to update requests linked to their assignments
create policy "Agents can update requests via assignment"
  on service_requests for update
  to authenticated
  using (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      WHERE ja.request_id = service_requests.id
      AND ja.agent_id = auth.uid()
    )
  )
  with check (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      WHERE ja.request_id = service_requests.id
      AND ja.agent_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON agent_profiles TO authenticated;
GRANT ALL ON job_assignments TO authenticated;
GRANT ALL ON agent_checkins TO authenticated;
GRANT ALL ON proof_of_work TO authenticated;
GRANT SELECT ON agent_earnings TO authenticated;
GRANT SELECT ON agent_payouts TO authenticated;

-- Comments for agent tables
COMMENT ON TABLE agent_profiles IS 'Extended profile data for agents/service providers';
COMMENT ON TABLE job_assignments IS 'Links service requests to assigned agents';
COMMENT ON TABLE agent_checkins IS 'GPS check-in/out records for job tracking';
COMMENT ON TABLE proof_of_work IS 'Before/after photos documenting completed work';
COMMENT ON TABLE agent_earnings IS 'Per-job earnings for agents (70% split)';
COMMENT ON TABLE agent_payouts IS 'Batch payout records (weekly or instant)';

-- ============================================
-- CLIENT DASHBOARD RLS POLICIES
-- Allow users to read and update their own service requests
-- ============================================

-- Enable RLS on service_requests if not already enabled
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own service requests
CREATE POLICY "Users can view own service requests"
  ON service_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert service requests for themselves
CREATE POLICY "Users can create service requests"
  ON service_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own service requests (e.g., cancel, reschedule)
CREATE POLICY "Users can update own service requests"
  ON service_requests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all service requests
CREATE POLICY "Admins can view all service requests"
  ON service_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update any service request
CREATE POLICY "Admins can update all service requests"
  ON service_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- EARNINGS TYPE MIGRATION
-- Add type column to agent_earnings to distinguish between
-- job earnings and cancellation fees
-- ============================================

-- Add type column to agent_earnings
ALTER TABLE agent_earnings
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'job_earning';

-- Update type based on amount (negative = agent cancel fee, for historical data)
UPDATE agent_earnings SET type = 'agent_cancel_fee' WHERE amount_cents < 0 AND type = 'job_earning';

-- Add comment for the column
COMMENT ON COLUMN agent_earnings.type IS 'Type of earning: job_earning, client_cancel_fee, agent_cancel_fee';

-- Remove the UNIQUE constraint on assignment_id to allow multiple earnings per job
-- (e.g., a job earning AND a cancellation fee adjustment)
ALTER TABLE agent_earnings DROP CONSTRAINT IF EXISTS agent_earnings_assignment_id_key;

-- ============================================
-- BIDIRECTIONAL RATING SYSTEM
-- Clients can rate agents after job completion
-- Agents can rate clients after job completion
-- ============================================

-- Ratings table for both client-to-agent and agent-to-client ratings
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_assignment_id UUID NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id),
  ratee_id UUID NOT NULL REFERENCES auth.users(id),
  rater_type TEXT NOT NULL CHECK (rater_type IN ('client', 'agent')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_assignment_id, rater_type) -- One rating per role per job
);

-- Enable RLS
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Users can view their own ratings (as rater or ratee)
CREATE POLICY "Users can view own ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (rater_id = auth.uid() OR ratee_id = auth.uid());

-- Users can create ratings where they are the rater
CREATE POLICY "Users can create own ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (rater_id = auth.uid());

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater ON ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_job ON ratings(job_assignment_id);

-- Trigger to update updated_at
CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON ratings TO authenticated;

-- Add rating columns to profiles for caching average ratings
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS client_rating DECIMAL(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_rating_count INTEGER DEFAULT 0;

-- Add rating columns to agent_profiles for caching average ratings
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS agent_rating DECIMAL(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agent_rating_count INTEGER DEFAULT 0;

-- Function to update client rating after new rating is added
CREATE OR REPLACE FUNCTION update_client_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rater_type = 'agent' THEN
    UPDATE profiles
    SET
      client_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM ratings
        WHERE ratee_id = NEW.ratee_id AND rater_type = 'agent'
      ),
      client_rating_count = (
        SELECT COUNT(*)
        FROM ratings
        WHERE ratee_id = NEW.ratee_id AND rater_type = 'agent'
      )
    WHERE id = NEW.ratee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent rating after new rating is added
CREATE OR REPLACE FUNCTION update_agent_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rater_type = 'client' THEN
    UPDATE agent_profiles
    SET
      agent_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM ratings
        WHERE ratee_id = NEW.ratee_id AND rater_type = 'client'
      ),
      agent_rating_count = (
        SELECT COUNT(*)
        FROM ratings
        WHERE ratee_id = NEW.ratee_id AND rater_type = 'client'
      )
    WHERE id = NEW.ratee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update cached ratings
CREATE TRIGGER update_client_rating_trigger
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_client_rating();

CREATE TRIGGER update_agent_rating_trigger
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_rating();

COMMENT ON TABLE ratings IS 'Bidirectional ratings between clients and agents after job completion';

-- ============================================
-- AGENT LOCATION AND DISTANCE FILTERING
-- Add agent location coordinates for distance-based gig filtering
-- ============================================

-- Add location coordinates to profiles table for agents
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10,8) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11,8) DEFAULT NULL;

COMMENT ON COLUMN profiles.location_latitude IS 'Agent home/base latitude for distance filtering';
COMMENT ON COLUMN profiles.location_longitude IS 'Agent home/base longitude for distance filtering';

-- Create a function to calculate distance between two points (Haversine formula)
-- Returns distance in miles
CREATE OR REPLACE FUNCTION haversine_distance_miles(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  R DECIMAL := 3959; -- Earth's radius in miles
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION haversine_distance_miles IS 'Calculate distance in miles between two lat/lng points using Haversine formula';

-- ============================================
-- AUTO-BOOKING AND REFERRAL SYSTEM
-- Priority-based automatic job assignment
-- ============================================

-- Add auto-booking enabled flag to agent_profiles
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS auto_booking_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN agent_profiles.auto_booking_enabled IS 'When enabled, agent can receive auto-assigned jobs based on priority';

-- Add referral tracking to profiles (who referred the client)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referred_by_agent_id UUID REFERENCES auth.users(id) DEFAULT NULL;

COMMENT ON COLUMN profiles.referred_by_agent_id IS 'The agent who referred this client (for priority matching)';

-- Also track referral on individual service requests (client may have different referrers)
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS preferred_agent_id UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_assignment_status TEXT DEFAULT 'pending' CHECK (auto_assignment_status IN ('pending', 'offered', 'accepted', 'expired', 'manual'));

COMMENT ON COLUMN service_requests.preferred_agent_id IS 'Preferred agent for this job (e.g., referee or previously used)';
COMMENT ON COLUMN service_requests.auto_assignment_status IS 'Status of automatic assignment process';

-- Table to track auto-assignment offers to agents
CREATE TABLE IF NOT EXISTS auto_assignment_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  priority_level INTEGER NOT NULL, -- 1=referee, 2=high-rated, 3=first-come
  priority_reason TEXT, -- 'referee', 'highest_rated', 'first_come'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  offered_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- When the offer expires
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, agent_id) -- One offer per agent per request
);

-- Enable RLS
ALTER TABLE auto_assignment_offers ENABLE ROW LEVEL SECURITY;

-- Agents can view their own offers
CREATE POLICY "Agents can view own offers"
  ON auto_assignment_offers FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

-- Agents can update their own offers (accept/decline)
CREATE POLICY "Agents can update own offers"
  ON auto_assignment_offers FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid());

-- Admins can view all offers
CREATE POLICY "Admins can view all offers"
  ON auto_assignment_offers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_offers_agent ON auto_assignment_offers(agent_id);
CREATE INDEX IF NOT EXISTS idx_auto_offers_request ON auto_assignment_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_auto_offers_status ON auto_assignment_offers(status);

-- Trigger to update timestamps
CREATE TRIGGER update_auto_offers_updated_at
  BEFORE UPDATE ON auto_assignment_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON auto_assignment_offers TO authenticated;

COMMENT ON TABLE auto_assignment_offers IS 'Tracks auto-assignment offers sent to agents based on priority';

-- ============================================
-- AGENT TIER SYSTEM
-- Progressive payout splits based on performance
-- ============================================

-- Add tier column to agent_profiles
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));

COMMENT ON COLUMN agent_profiles.tier IS 'Agent tier level: bronze (50%), silver (55%), gold (60%), platinum (70%)';

-- Tier requirements and payout percentages:
-- Bronze:   New agent, 50% payout
-- Silver:   10+ jobs, 4.0+ rating, 55% payout
-- Gold:     30+ jobs, 4.5+ rating, 60% payout
-- Platinum: 75+ jobs, 4.8+ rating, 70% payout

-- Function to calculate agent tier based on performance
CREATE OR REPLACE FUNCTION calculate_agent_tier(
  p_total_jobs INTEGER,
  p_rating DECIMAL
) RETURNS TEXT AS $$
BEGIN
  -- Platinum: 75+ jobs and 4.8+ rating
  IF p_total_jobs >= 75 AND p_rating >= 4.8 THEN
    RETURN 'platinum';
  -- Gold: 30+ jobs and 4.5+ rating
  ELSIF p_total_jobs >= 30 AND p_rating >= 4.5 THEN
    RETURN 'gold';
  -- Silver: 10+ jobs and 4.0+ rating
  ELSIF p_total_jobs >= 10 AND p_rating >= 4.0 THEN
    RETURN 'silver';
  -- Default: Bronze
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get payout percentage based on tier
CREATE OR REPLACE FUNCTION get_tier_payout_percentage(p_tier TEXT)
RETURNS DECIMAL AS $$
BEGIN
  CASE p_tier
    WHEN 'platinum' THEN RETURN 0.70;
    WHEN 'gold' THEN RETURN 0.60;
    WHEN 'silver' THEN RETURN 0.55;
    ELSE RETURN 0.50; -- bronze
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to auto-update agent tier when stats change
CREATE OR REPLACE FUNCTION update_agent_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_rating DECIMAL;
  v_new_tier TEXT;
BEGIN
  -- Get the agent's current rating (use agent_rating if available, fall back to rating)
  v_rating := COALESCE(NEW.agent_rating, NEW.rating, 5.0);

  -- Calculate new tier
  v_new_tier := calculate_agent_tier(NEW.total_jobs, v_rating);

  -- Only update if tier changed
  IF NEW.tier IS DISTINCT FROM v_new_tier THEN
    NEW.tier := v_new_tier;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update tier when agent stats change
DROP TRIGGER IF EXISTS update_agent_tier_trigger ON agent_profiles;
CREATE TRIGGER update_agent_tier_trigger
  BEFORE UPDATE OF total_jobs, rating, agent_rating ON agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_tier();

-- Update existing agents to correct tier based on current stats
UPDATE agent_profiles
SET tier = calculate_agent_tier(
  COALESCE(total_jobs, 0),
  COALESCE(agent_rating, rating, 5.0)
);

COMMENT ON FUNCTION calculate_agent_tier IS 'Calculate tier based on total jobs and rating';
COMMENT ON FUNCTION get_tier_payout_percentage IS 'Get labor payout percentage for a tier';
COMMENT ON FUNCTION update_agent_tier IS 'Auto-update agent tier when stats change';

-- ============================================
-- SERVICE CATALOG SYSTEM
-- Robust service management with proper relationships
-- ============================================

-- Ensure service_catalog exists with proper structure
CREATE TABLE IF NOT EXISTS service_catalog (
  id TEXT PRIMARY KEY,  -- e.g., 'tv_mount', 'plumbing'
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  icon TEXT DEFAULT '🔧',
  base_minutes INTEGER DEFAULT 60,
  price_cents INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  -- For agent-suggested services
  suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  suggested_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if table already exists
ALTER TABLE service_catalog
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🔧',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Seed default services if empty
INSERT INTO service_catalog (id, name, category, description, icon, base_minutes, price_cents, display_order, is_active)
VALUES
  ('tv_mount', 'TV Mounting', 'Installation', 'Mount TV, hide cables, secure to studs/brick', '📺', 60, 9900, 1, true),
  ('assembly', 'Furniture Assembly', 'Assembly', 'Beds, dressers, desks, patio sets, and more', '🪑', 60, 7900, 2, true),
  ('electrical', 'Electrical Work', 'Repairs', 'Outlets, switches, fixtures, ceiling fans', '💡', 60, 8900, 3, true),
  ('plumbing', 'Plumbing', 'Repairs', 'Faucets, toilets, garbage disposals, minor repairs', '🔧', 60, 9900, 4, true),
  ('smart_home', 'Smart Home Setup', 'Installation', 'Thermostats, doorbells, cameras, smart locks', '🏠', 45, 6900, 5, true),
  ('tech', 'Tech Support', 'Technology', 'WiFi setup, device configuration, troubleshooting', '💻', 30, 4900, 6, true),
  ('doors_hardware', 'Doors & Hardware', 'Installation', 'Door handles, locks, hinges, weather stripping', '🚪', 45, 5900, 7, true),
  ('exterior', 'Exterior Work', 'Outdoor', 'Pressure washing, gutter cleaning, minor repairs', '🏡', 90, 12900, 8, true),
  ('repairs', 'General Repairs', 'Repairs', 'Drywall, painting touch-ups, caulking, misc fixes', '🔨', 60, 7900, 9, true),
  ('punch', 'Punch List', 'General', 'Multiple small tasks bundled together', '📋', 120, 14900, 10, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  base_minutes = EXCLUDED.base_minutes,
  display_order = EXCLUDED.display_order,
  is_active = COALESCE(service_catalog.is_active, EXCLUDED.is_active);

-- Create agent_skills join table (replaces skills array in agent_profiles)
CREATE TABLE IF NOT EXISTS agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  proficiency_level TEXT DEFAULT 'standard' CHECK (proficiency_level IN ('learning', 'standard', 'expert')),
  years_experience INTEGER DEFAULT 0,
  certified BOOLEAN DEFAULT false,
  certification_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, service_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_service ON agent_skills(service_id);

-- Migrate existing skills from agent_profiles.skills array to agent_skills table
-- This handles the JSON array format ["tv_mount", "plumbing", ...]
DO $$
DECLARE
  agent_rec RECORD;
  skill_id TEXT;
BEGIN
  FOR agent_rec IN
    SELECT id, skills FROM agent_profiles WHERE skills IS NOT NULL AND skills != '[]'::jsonb
  LOOP
    FOR skill_id IN SELECT jsonb_array_elements_text(agent_rec.skills)
    LOOP
      INSERT INTO agent_skills (agent_id, service_id)
      VALUES (agent_rec.id, skill_id)
      ON CONFLICT (agent_id, service_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Fix service_type values in service_requests to use IDs
UPDATE service_requests SET service_type = 'tv_mount' WHERE service_type ILIKE '%tv%mount%' OR service_type = 'TV Mounting';
UPDATE service_requests SET service_type = 'assembly' WHERE service_type ILIKE '%assembl%' OR service_type = 'Furniture Assembly';
UPDATE service_requests SET service_type = 'electrical' WHERE service_type ILIKE '%electric%';
UPDATE service_requests SET service_type = 'plumbing' WHERE service_type ILIKE '%plumb%';
UPDATE service_requests SET service_type = 'smart_home' WHERE service_type ILIKE '%smart%';
UPDATE service_requests SET service_type = 'tech' WHERE service_type ILIKE '%tech%';
UPDATE service_requests SET service_type = 'doors_hardware' WHERE service_type ILIKE '%door%' OR service_type ILIKE '%hardware%';
UPDATE service_requests SET service_type = 'exterior' WHERE service_type ILIKE '%exterior%';
UPDATE service_requests SET service_type = 'repairs' WHERE service_type ILIKE '%repair%';
UPDATE service_requests SET service_type = 'punch' WHERE service_type ILIKE '%punch%';

-- Add FK constraint on service_requests.service_type
-- First ensure all values are valid
ALTER TABLE service_requests
  DROP CONSTRAINT IF EXISTS fk_service_type;

-- Add the FK (will fail if there are orphaned values - clean those first)
DO $$
BEGIN
  ALTER TABLE service_requests
    ADD CONSTRAINT fk_service_type
    FOREIGN KEY (service_type) REFERENCES service_catalog(id);
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'FK constraint failed - orphaned service_type values exist. Run cleanup first.';
END $$;

-- RLS Policies for service_catalog
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone can read active services
CREATE POLICY "Anyone can view active services"
  ON service_catalog FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Only admins can modify services
CREATE POLICY "Admins can manage services"
  ON service_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for agent_skills
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;

-- Agents can manage their own skills
CREATE POLICY "Agents can view their own skills"
  ON agent_skills FOR SELECT
  USING (agent_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Agents can manage their own skills"
  ON agent_skills FOR ALL
  USING (agent_id = auth.uid());

-- Admins can manage all skills
CREATE POLICY "Admins can manage all skills"
  ON agent_skills FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create a view for agent skills with service details
CREATE OR REPLACE VIEW agent_skills_view AS
SELECT
  ask.id,
  ask.agent_id,
  ask.service_id,
  ask.proficiency_level,
  ask.years_experience,
  ask.certified,
  sc.name AS service_name,
  sc.category AS service_category,
  sc.icon AS service_icon,
  sc.is_active AS service_active
FROM agent_skills ask
JOIN service_catalog sc ON sc.id = ask.service_id
WHERE sc.is_active = true;

-- Function to get agent's services as array (for backward compatibility)
CREATE OR REPLACE FUNCTION get_agent_skills_array(p_agent_id UUID)
RETURNS TEXT[] AS $$
  SELECT COALESCE(array_agg(service_id), ARRAY[]::TEXT[])
  FROM agent_skills
  WHERE agent_id = p_agent_id;
$$ LANGUAGE sql STABLE;

-- Table for service suggestions from agents
CREATE TABLE IF NOT EXISTS service_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  suggested_name TEXT NOT NULL,
  suggested_category TEXT,
  description TEXT,
  why_needed TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_service_id TEXT REFERENCES service_catalog(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can suggest services"
  ON service_suggestions FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can view their suggestions"
  ON service_suggestions FOR SELECT
  USING (agent_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage suggestions"
  ON service_suggestions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

COMMENT ON TABLE service_catalog IS 'Master list of all available services';
COMMENT ON TABLE agent_skills IS 'Agent service capabilities with proficiency levels';
COMMENT ON TABLE service_suggestions IS 'Agent-submitted service suggestions for admin review';
COMMENT ON FUNCTION get_agent_skills_array IS 'Get agent skills as array for backward compatibility';
