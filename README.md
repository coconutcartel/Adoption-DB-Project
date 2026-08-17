# Rehome — realtime animal adoption database

A mobile-first adoption web app/PWA foundation built with React, TypeScript, Vite and Supabase.

## What V1 includes

- Public adoption gallery — no account required
- Search and filters for species, sex, size and city
- Full animal profiles with fosterer contact information
- Fosterer signup/login with Supabase Auth
- Fosterer dashboard for all animals in their care
- Create and edit listings with 1–5 photos (JPG/PNG/WebP, max 8 MB each)
- Adoption status: Available, Reserved, Adopted, Withdrawn
- Realtime gallery refresh when listings change
- Report Listing feature (authenticated reporters)
- Private moderator queue with review notes
- Moderator actions: pause, hide or restore a listing
- Row Level Security so users can edit only their own listings
- Adopted/withdrawn animals remain in the database for history instead of being deleted

`Rehome` is only a working name and can be changed later.

## Stack

- React + TypeScript + Vite
- Supabase Postgres, Auth, Storage and Realtime
- Cloudflare Pages for web deployment
- GitHub for source control

## 1. Create Supabase project

Create a free Supabase project. In its SQL Editor, run:

`supabase/migrations/001_initial_schema.sql`

This creates the database, RLS policies, image bucket, report workflow and realtime event table.

## 2. Environment variables

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Get both from Supabase > Connect / API settings. Never put a service-role key in this front end.

## 3. Run locally

```bash
npm install
npm run dev
```

Without Supabase environment variables, the app deliberately opens in demo mode with two sample animals so the UI can still be reviewed.

## 4. Create the first admin/moderator

1. Sign up through the app.
2. In Supabase > Authentication > Users, copy your User UUID.
3. Run in SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR-USER-UUID', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

Normal clients have no policy allowing them to write `user_roles`, so users cannot promote themselves.

## 5. Cloudflare Pages

Connect the GitHub repository to Cloudflare Pages and use:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: same two `VITE_SUPABASE_*` values above

The included `public/_redirects` supports React Router deep links on Pages.

## Report Listing privacy model

- Browsing does not require an account.
- Submitting a report does require a signed-in user.
- Fosterers cannot report their own listing.
- One open/reviewing report per reporter per animal.
- Listing owners cannot read reports, reporter IDs or moderator notes.
- Moderators/admins can read and review reports.
- Moderators may place a listing `under_review`, hide it, or restore it.
- `under_review` and `hidden` listings are removed from the public gallery and frozen for owner edits until restored.

## Realtime design

The gallery subscribes to `public_listing_events`, a minimal event table populated by a database trigger. This is intentional: if an animal changes from Available to Adopted or a listing is hidden, the animal row becomes unreadable to anonymous users. A separate public event still tells the gallery to refresh, so removed listings disappear without a page reload.

For a much larger deployment, Supabase currently recommends Broadcast over Postgres Changes for scalability. V1 uses Postgres Changes on the tiny event table because it is simpler and keeps the adoption data itself protected by RLS.

## Important production follow-ups

Before a broad public launch, add:

- CAPTCHA / bot protection for signup and report abuse
- Image compression and EXIF stripping
- Terms of use, privacy policy and community moderation rules
- Rate limiting for reports and listing creation
- Safer phone-number sharing controls if required
- Email notifications to fosterers/moderators
- Automated backups / export process
- Accessibility and device testing


## Free Smart Adoption Finder

V1 includes a read-only, rule-based Smart Finder. It does **not** call a paid AI API. A visitor can type a sentence such as “small female dog in Panjim, good with cats and sterilised”, and the browser converts recognised preferences into Supabase filters. All results come from live, published adoption listings.

Because this feature is local and read-only, it adds no per-search API cost and cannot edit listings.
