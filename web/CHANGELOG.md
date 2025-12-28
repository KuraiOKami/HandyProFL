# Changelog

All notable changes to HandyProFL will be documented in this file.

## [0.8.0] - 2024-12-28

### Added
- **In-App Messaging System**: Real-time chat between agents and clients
  - JobChat component integrated into agent job page and client booking page
  - Messages API with read receipts
  - 10-second polling for new messages
  - SMS/email notifications for new messages

- **Auto-Booking Engine**: Automatic job assignment based on priority
  - Priority scoring: referrals get highest priority
  - Skills matching: only assigns jobs agent can do
  - Distance filtering: respects agent's service radius
  - Tier bonus: higher-tier agents get priority
  - Auto-assigns referred clients, offers to others
  - Notifications for both auto-assignments and offers

- **SMS/Email Notification System**: Comprehensive notifications
  - Agent notifications: new gigs, assignments, reminders, messages
  - Client notifications: agent assigned, job started, completed, messages
  - Respects user notification preferences
  - Logs all notifications for debugging

### Changed
- Agent onboarding simplified with phone OTP as default
- Profile pre-fill for returning users
- Better verification step with Stripe Identity checklist

### Technical
- Added `messages` table for in-app messaging
- Added `notifications` table for logging
- Added `notification_preferences` table for user settings
- Added `auto_assigned` column to job_assignments
- Added `/lib/autoBooking.ts` - Auto-booking engine
- Added `/lib/notifications.ts` - Notification templates and functions
- Added `/api/messages/[jobId]` - Messages API
- Updated `/components/chat/JobChat.tsx` - Chat component

---

## [0.7.0] - 2024-12-27

### Version Jump Note
**Jumped from 0.0.5 to 0.7.0** to properly reflect the maturity of the application.
The previous 0.0.x versioning understated the feature completeness.

Version assessment:
- 0.1.0 - 0.3.0: MVP (core flow works)
- 0.4.0 - 0.6.0: Feature-complete MVP
- 0.7.0 - 0.9.0: Beta (ready for real users)
- 1.0.0: Production stable release

At 0.7.0, HandyProFL has:
- Complete client booking flow with scheduling
- Full agent portal with onboarding and identity verification
- Job lifecycle management (assign, check-in, photos, checkout)
- Stripe payments with charge-on-confirmation
- Cancellation fees for both clients and agents
- Refund processing with fee deductions
- Agent earnings with instant and weekly payouts
- Bidirectional rating system
- Distance and skills-based gig filtering
- Auto-booking infrastructure
- Admin panel for management

### Added
- Agent tier system (Bronze, Silver, Gold, Platinum)
- Dynamic payout splits based on agent tier
- Tier badges visible to clients
- Auto-promotion based on completed jobs and rating
- Bidirectional rating system (clients rate agents, agents rate clients)
- Distance-based gig filtering using GPS
- Skills-based gig filtering
- Auto-booking toggle for agents
- Agent location settings with GPS picker
- Earnings type display (job earnings vs cancellation fees)

### Changed
- Earnings history now shows reason for funds (job, cancel fee, penalty)
- Gigs list shows client ratings and distance
- Agent settings expanded with location and auto-booking options

### Technical
- Added `ratings` table with auto-update triggers
- Added `agent_earnings.type` column
- Added `profiles.location_latitude/longitude` columns
- Added `agent_profiles.tier` column
- Added `auto_assignment_offers` table
- Added `haversine_distance_miles` PostgreSQL function

---

## [0.0.5] - Previous
- Urgency fee for same-day/next-day/2-day bookings
- Simplified scheduling to preferred date/time picker
- Payment method storage without immediate charge
- Charge-on-confirmation flow
- Slot release on cancellation
