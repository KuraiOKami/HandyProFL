# AGENTS.md

Project: HandyProFL client portal (Next.js + TypeScript + Tailwind), deployed on Netlify with Supabase.

## Repo layout
- `web/` is the app root (all Next.js code lives here).
- `web/src/app/` uses the Next.js App Router.
- `web/src/components/`, `web/src/hooks/`, `web/src/lib/`, `web/src/utils/` hold shared code.
- `web/public/` for static assets.
- `web/supabase-migrations.sql` contains schema references.
- `netlify.toml` at repo root sets Netlify build base/publish.

## Commands (run from `web/`)
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`

## Environment
- Copy `web/.env.local.example` → `web/.env.local`.
- Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Optional: Stripe/Twilio/SMTP keys as needed.

## Conventions
- TypeScript only; keep types explicit when logic is non-trivial.
- Use Tailwind for styling; prefer existing patterns in `web/src/components/`.
- Avoid introducing new dependencies unless necessary.
- Keep edits scoped to `web/` unless a root config change is required.

## Deployment
- Netlify build runs in `web/` with `npm run build`.
- Publish output is `.next` via `@netlify/plugin-nextjs`.
