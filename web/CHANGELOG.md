# Changelog

All notable changes to HandyProFL will be documented in this file.

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
