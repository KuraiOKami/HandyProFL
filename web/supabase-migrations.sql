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
