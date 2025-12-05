HandyProFL client portal – Next.js + TypeScript + Tailwind, deployed on Netlify with Supabase for auth/database/email/SMS.

## Setup

1) Install dependencies

```bash
npm install
```

2) Env vars: copy `.env.local.example` → `.env.local` and add your keys:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

3) Run dev server

```bash
npm run dev
```

Visit http://localhost:3000. Auth/login is at `/auth`, profile `/profile`, requests `/requests`, scheduling `/schedule`.

## Supabase schema (minimum)

- `profiles`: `id uuid primary key references auth.users`, `first_name text`, `middle_initial text`, `last_name text`, `phone text`, `email text`, `street text`, `city text`, `state text`, `postal_code text`, `updated_at timestamptz`
- `service_requests`: `id uuid default uuid_generate_v4()`, `user_id uuid references auth.users`, `service_type text`, `preferred_date date`, `preferred_time text`, `details text`, `status text default 'pending'`, `created_at timestamptz default now()`
- Optional `available_slots`: `id`, `slot_start timestamptz`, `slot_end timestamptz`, `is_booked boolean default false` for Calendly-style picker.

Enable Row Level Security and policies to allow:
- `profiles`: user can select/upsert their own row where `id = auth.uid()`.
- `service_requests`: user can insert/select rows where `user_id = auth.uid()`.

## Auth flows

- Email/password login + signup (`/auth`).
- Phone + one-time code via `signInWithOtp`. Ensure SMS is enabled in your Supabase project and phone numbers are in E.164 format (e.g., `+15555555555`).

## Deployment (Netlify)

- The app lives in the `web` subdirectory. `netlify.toml` at repo root sets `base = "web"` so builds run there.
- Build command: `npm run build`. Publish: `.next` (handled by `@netlify/plugin-nextjs`).
- Add the two Supabase env vars in Netlify UI. If using SMS/email, also add any Supabase SMTP/Twilio keys as needed.

## Next steps

- Wire scheduling to Google Calendar via a Netlify Function or Supabase Edge Function that reads/writes `available_slots`.
- Add uploads for photos (Supabase Storage) to attach to `service_requests`.
- Add admin view (protected route) to confirm/complete requests.
