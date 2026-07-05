# Rental AI Concierge MVP

AI-assisted rental search MVP built with Next.js App Router, TypeScript, Tailwind, Supabase, LangChain.js, Groq, and SheetJS.

## What Works

- User natural-language rental intake at `/`
- Server-side requirement parsing with required Groq extraction plus deterministic merge checks
- Ticket creation in Supabase
- Existing inventory matching and scoring
- Admin keyword login at `/admin/login`
- Admin dashboard and ticket detail pages
- Excel/CSV property upload, preview, enrichment, scoring, and publish controls
- Optional Groq vision analysis for property photos during enrichment and scoring
- Private shortlist page at `/shortlist/[publicToken]`
- Swipe/card actions saved as `property_actions`
- No WhatsApp, scraping, payments, broker login, or renter login

## Setup

Use Node.js `18.17.0` or newer. Node 20 LTS is a good default.

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

3. Add Supabase keys in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Use the service role key only server-side. It is used by API routes and admin pages.

4. Add Groq key in `.env.local`:

```env
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.1-8b-instant
GROQ_VISION_MODEL=your-groq-vision-model
```

`GROQ_API_KEY` is required for requirement parsing. The parser still runs deterministic extraction internally, but only as a merge/safety layer after Groq returns. If `GROQ_VISION_MODEL` is blank, property images are stored and displayed but not analyzed by vision.

5. Set admin login:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=choose-a-strong-password
```

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/migrations/001_initial_schema.sql`.
4. If you already created the database before vision support, also run `supabase/migrations/002_property_vision.sql`.
5. Optional: run `supabase/seed.sql` for sample global inventory.

RLS is enabled. The app uses server routes with the service role key, and the public shortlist API returns only safe fields.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Test Flow

1. Open `/`.
2. Enter a prompt like:

```text
Need a spacious 2BHK in Gurgaon near Cyber City under 55k, semi furnished, good sunlight, family, parking needed, move-in by August 1. No 1 month brokerage.
```

3. Confirm/edit fields and create a ticket.
4. Login at `/admin/login`.
5. Open the ticket from `/admin`.
6. Review existing matches or upload `public/sample-property-upload-template.csv`.
7. Publish one or more candidates.
8. Open the private shortlist link from the confirmation page.
9. Swipe or click actions: reject, maybe, interested, ask for video, request visit.

## Upload Columns

The admin upload accepts:

`title, source, source_url, description, city, locality, address_hint, rent, maintenance, deposit, brokerage, bhk, furnishing, carpet_area, floor, total_floors, parking, available_from, tenant_allowed, pets_allowed, property_type, photos, video_url, contact_name, contact_phone, contact_type, verification_status, verified_notes, spaciousness_score, sunlight_score, maintenance_condition_score, pros, cons, missing_info, admin_notes`

`photos`, `pros`, `cons`, and `missing_info` may be comma-separated.

## Known Limitations

- Admin auth is MVP keyword/email-password auth through env vars, not full Supabase Auth.
- Matching is SQL filters plus deterministic scoring plus optional Groq scoring.
- Requirement parsing requires Groq; property enrichment/scoring still have deterministic fallbacks.
- Vision analysis uses public image URLs from the `photos` column and keeps subjective claims cautious.
- No vector search yet.
- No background queue; ticket matching runs during ticket creation.
- No WhatsApp, scraping, payments, or owner/broker contact exposure on public shortlist.
