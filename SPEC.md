# Tayo V1 Developer Specification

**Document version:** 1.0
**Last updated:** 2026-05-07
**Status:** Master build spec for V1.0
**Audience:** Engineering team, Claude Code agents, technical leads

This document is the canonical, executable specification for the Tayo V1 build. It supersedes informal notes and Slack decisions. Every section is intended to be unambiguous enough that an engineer (or a Claude Code instance) can act on it directly. Where decisions are still pending, they are explicitly listed in Section 13.

---

## 1. Project Overview

### Product name

**Tayo** — Filipino-Catholic-first wedding event platform.

### One-paragraph description

Tayo is a Filipino-Catholic-first wedding event platform. Couples plan their wedding (budget, timeline, guests, mass roles, seating, vendors). Guests get a QR-bound identity that links them to RSVP, a personal photo album, and the wedding-day photo upload feed. Vendors register, list packages with rich inclusions and Tayo-exclusive pricing, and respond to couple inquiries through gated in-app messaging. Coordinators manage multiple weddings from a single dashboard, with referral-based commission tracking through the Integrated Coordinator program. A Tayo Staff role oversees vendor approvals, certifications, and disputes. The whole platform is unified by a single canonical event URL (e.g. `tayo.app/maria-juan-2026`) that renders role-appropriate views and is reachable from any QR code on any printed wedding asset.

### V1.0 scope

The full V1.0 feature scope is enumerated in Section 7. At a glance:

- 5 user roles: couple, guest, vendor, coordinator, Tayo Staff (plus stylist as a coordinator subtype)
- Per-event canonical URL with role-aware rendering
- Couple planning suite (budget, timeline, guests, mass roles, day-of run-of-show, seating)
- Vendor directory with packages, inclusions, swap rules, exclusivity, transport zones, hidden costs, annual price-lock
- Inquire Now → quote → booking flow
- Photo system with face tagging and personal albums
- Tayo Kasalan AI assistant (Claude Sonnet)
- Integrated Coordinator program with commission tracking
- PayMongo payment milestones
- Comprehensive Filipino-Catholic default templates auto-loaded into every new event

### Out of scope for V1

- Native iOS / Android apps — V1.5 (React Native or Capacitor wrapper)
- Vendor marketplace transactions (Tayo holding deposits in escrow) — V2
- Live ceremony streaming — V2
- AI image generation surfaces (FLUX, Ideogram) — V1.5
- Phone OTP login — V1.5
- Public guest social feed across multiple weddings — explicitly never (privacy by design)

### Target launch

**Production launch:** 6–9 months from kickoff.
**Soft launch / closed beta:** Sprint 4 mid-point (~5 months in).

### Target Year 1 weddings

**1,500 paid weddings** across the three tiers (Essentials, Premium, Pro Event), distributed roughly 60 / 30 / 10.

---

## 2. Recommended Tech Stack

The stack is chosen for: (a) maximum velocity for a small team, (b) minimum recurring infrastructure cost in the first 12 months, (c) compatibility with Claude Code as a primary IDE, (d) native Philippine market support for payments.

| Layer | Choice | Why |
|---|---|---|
| Frontend Framework | Next.js 15 (App Router) | SSR for landing pages, RSC, mature ecosystem |
| Language | TypeScript (strict mode) | Type safety across full stack |
| UI Components | shadcn/ui + Tailwind CSS | Free, customizable, copy-paste components |
| Styling | Tailwind CSS | Utility-first, performant |
| Fonts | Google Fonts (Cormorant Garamond + Manrope per design system) | Free, fast loading |
| State Management | TanStack Query (server state) + Zustand (client state) | Lightweight, modern |
| Forms | React Hook Form + Zod | Validated forms with type-safe schemas |
| Database | Supabase (PostgreSQL) | Free tier generous, includes auth + storage + realtime |
| Auth | Supabase Auth | Built-in with database, magic links + OAuth |
| File Storage | Cloudflare R2 (zero egress fees) | Critical: NOT AWS S3 — see cost note in Section 9 |
| CDN | Cloudflare | Zero egress fees, free tier covers V1 |
| Payment Processing | PayMongo (PH-native) | Cards + GCash + Maya |
| AI — LLM | Anthropic Claude Sonnet (primary) + Claude Opus (premium) + Gemini Flash-Lite (cheap routing) | Tiered routing for cost control |
| AI — Image Gen | FLUX 2 Pro via Replicate (V1.5) | Best photorealism with REST API |
| AI — Image Gen (typography) | Ideogram 2.0 via fal.ai (V1.5) | Best text-in-image |
| Computer Vision | AWS Rekognition (face tagging) | Strongest event-photo use case, ap-southeast-1 region available |
| Email | Resend (or Postmark) | Transactional email |
| SMS | Twilio | Optional V1 — RSVP reminders |
| Hosting | Vercel | Best Next.js DX, generous free tier |
| Domain registrar | Cloudflare | Cheap, integrated DNS |
| Monitoring | Sentry (free tier) | Error tracking |
| Analytics | PostHog (cloud or self-hosted) | Privacy-conscious, session replay |
| Testing | Vitest + Playwright | Unit + e2e |
| Code Quality | ESLint + Prettier + TypeScript strict | Standard |

### Stack-level decisions worth flagging

- **Cloudflare R2 (not S3) is non-negotiable for V1.** A single wedding produces 2,000–8,000 high-resolution photos. Egress fees on S3 would dominate infrastructure costs. R2's zero egress fee policy turns photo storage from a recurring cost into a near-fixed cost.
- **Supabase over Firebase.** PostgreSQL gives us joins, RLS, and SQL-native queries — all of which we need for the role-based access patterns described in Section 5.
- **PayMongo over Stripe.** Stripe does not support GCash or Maya in the Philippines without a workaround. PayMongo is PH-native and supports cards, GCash, Maya, and bank transfer.
- **Claude Sonnet as default LLM.** Cost / quality balance is correct for couple-facing chat. Opus reserved for the Pro Event tier and AI-generated copy that ships into the live page.

---

## 3. Initial Project Setup

### 3.1 Claude Code / Cursor Setup

Claude Code is the assumed primary IDE. Engineers using Cursor or VS Code can replicate skill-equivalent context manually.

**Recommended skills to install:**

- `typescript` — strict typing patterns
- `nextjs` — App Router conventions (server vs client components, data fetching, route handlers)
- `supabase` — database / auth / storage patterns, RLS, migrations
- `shadcn-ui` — component library (which components exist, how to add them)
- `tailwindcss` — styling utility patterns
- `testing` — Vitest + Playwright

**Recommended MCP servers:**

- **Supabase MCP** — manage schema, run migrations, query database from Claude Code
- **Vercel MCP** — deploy / inspect / roll back from Claude Code
- **GitHub MCP** — branch + PR management
- **Filesystem MCP** — local file access

**External account setup (must be ready before development begins):**

- Anthropic Console (Claude API key — get the org-level key, set per-project budget)
- Supabase project on free tier (upgrade to Pro before public launch)
- Cloudflare account (R2 bucket + DNS for `tayo.app`)
- AWS account (Rekognition only, ap-southeast-1)
- PayMongo merchant account (PH KYC required — collect documents 4 weeks early)
- Resend account (and verified sending domain)
- Twilio account (PH sender ID registration if SMS in V1)
- Vercel account (Pro plan recommended once team > 1)
- Sentry account (free tier)
- PostHog account (free tier)
- GitHub organization with private repo
- 1Password (or similar) team vault for secrets

### 3.2 Repository Structure

```
tayo/
|-- apps/
|   |-- web/              # Next.js app (couple, guest, vendor, coordinator, staff)
|   `-- admin/            # Internal admin tool (Tayo Staff only) - separate Next.js app
|-- packages/
|   |-- ui/               # shadcn/ui components + custom Tayo components
|   |-- db/               # Supabase types + migrations + RLS policies
|   |-- ai/               # AI client wrappers (Claude, FLUX, Rekognition)
|   |-- payments/         # PayMongo wrapper
|   `-- shared/           # Shared types, utils, constants, Zod schemas
|-- docs/                 # This spec, design files, decisions
|-- supabase/
|   |-- migrations/       # SQL migrations
|   `-- seed.sql          # Seed data: default checklists, vendor categories
|-- .env.example          # All required env vars
|-- package.json
|-- pnpm-workspace.yaml
`-- turbo.json
```

Use **pnpm workspaces + Turborepo** for monorepo management. Turborepo gives us cached builds and parallel task execution. The two Next.js apps (`web`, `admin`) share the same Supabase project but are deployed as separate Vercel projects with separate domains (`tayo.app` and `admin.tayo.app`).

### 3.3 Environment Variables Template

Every environment variable used by any package or app. Commit this exact file as `.env.example`. Engineers must never commit real values.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=tayo-uploads
R2_PUBLIC_URL=https://media.tayo.app

# Anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_DEFAULT=claude-sonnet-4-5
ANTHROPIC_MODEL_PREMIUM=claude-opus-4-7

# Google Gemini (cheap routing tier)
GEMINI_API_KEY=

# AWS Rekognition
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-southeast-1
REKOGNITION_COLLECTION_PREFIX=tayo-event-

# PayMongo
PAYMONGO_SECRET_KEY=
PAYMONGO_PUBLIC_KEY=
PAYMONGO_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
RESEND_FROM_ADDRESS=hello@tayo.app

# Twilio (optional V1)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=

# App
NEXT_PUBLIC_APP_URL=https://tayo.app
NEXT_PUBLIC_ADMIN_URL=https://admin.tayo.app
NEXTAUTH_SECRET=

# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 4. Database Schema

### 4.1 Core Tables

All tables use PostgreSQL via Supabase. Every table has `created_at` and `updated_at` timestamps with default `now()` and an `updated_at` trigger. Every primary key is a `uuid` generated with `gen_random_uuid()` unless noted. Foreign keys cascade on delete unless noted.

#### users

Every account in the system: couple, guest, vendor, coordinator, Tayo Staff.

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  name text not null,
  phone text,
  avatar_url text,
  account_type text not null check (account_type in ('couple','guest','vendor','coordinator','staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Note: `email` is nullable because lightweight guest accounts (created from a QR scan with name only) may not have an email at creation. Once Supabase Auth is wired up, the `users.id` matches `auth.users.id`.

#### events

Every wedding event.

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  couple_user_id_1 uuid references users(id),
  couple_user_id_2 uuid references users(id),
  event_date date,
  ceremony_type text check (ceremony_type in ('catholic','civil','other')),
  ceremony_venue_id uuid,
  reception_venue_id uuid,
  guest_count_estimate integer,
  status text not null default 'planning' check (status in ('planning','ceremony_done','archived')),
  tier text not null default 'essentials' check (tier in ('essentials','premium','pro_event')),
  color_palette jsonb,
  monogram_svg text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index events_slug_lower_idx on events (lower(slug));
```

The `slug` is the URL-friendly identifier (`maria-juan-2026`). It is generated server-side from the couple's first names + year, and de-duplicated with a numeric suffix if needed.

#### event_roles

Many-to-many of who can access an event, and in what role.

```sql
create table event_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('couple','guest','vendor','coordinator','stylist','shooter','staff')),
  permissions jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, role)
);
```

A single user can have multiple rows (e.g. a coordinator who is also a guest at one of their own client weddings).

#### guests

Wedding guests with QR-bound identity. Guests may or may not have a `users` row.

```sql
create table guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  qr_token text unique not null,
  category text,
  mass_role text,
  table_id uuid,
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending','attending','declined')),
  dietary_restrictions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`category` values include: `bride_side`, `groom_side`, `principal_sponsor_ninong`, `principal_sponsor_ninang`, `secondary_sponsor`, `maid_of_honor`, `best_man`, `bridesmaid`, `groomsman`, `flower_girl`, `ring_bearer`, `bible_bearer`, `coin_bearer`. Stored as text (not enum) because the list grows.

`mass_role` values: `1st_reading`, `2nd_reading`, `responsorial_psalm`, `prayers_of_the_faithful`, `offertory_bread`, `offertory_wine`, `gift_bearer`, `commentator`, `usher`, etc.

`qr_token` is a 32-char URL-safe random string. Each guest's QR code resolves to `tayo.app/[event-slug]?invite=[qr_token]`.

#### vendors

```sql
create table vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  business_name text not null,
  category text not null,
  service_area text[],
  contact_email text,
  contact_phone text,
  portfolio_urls text[],
  bio text,
  years_in_business integer,
  base_location_lat numeric,
  base_location_lng numeric,
  free_transport_radius_km integer,
  outside_radius_rate_type text check (outside_radius_rate_type in ('per_km','flat','quote_on_request')),
  outside_radius_rate numeric,
  is_certified boolean not null default false,
  certification_date timestamptz,
  is_recommended boolean not null default false,
  response_time_avg_hours numeric,
  review_count integer not null default 0,
  average_rating numeric,
  annual_price_lock_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`category` is text (not enum). Reference values include: `photographer`, `videographer`, `caterer`, `venue_hotel`, `florist`, `stylist`, `coordinator`, `hmua_bride`, `hmua_entourage`, `host`, `live_music`, `dj`, `lights_sound`, `cake`, `bridal_car`, `invitation`, `jewelry`, `attire_bride`, `attire_groom`, `attire_entourage`, `photo_booth`, `mobile_bar`, `food_cart`, `coffee_bar`, `perfume_bar`, `massage`, plus the rest from Section 4 of `05_Default_Filipino_Wedding_Template_v1.docx`.

We use lat / lng columns rather than the `geography` type because Supabase's PostGIS extension is enabled but the typing story for the JS client is cleaner with two scalar columns. Distance is computed at query time with the haversine formula.

#### vendor_packages

```sql
create table vendor_packages (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  name text not null,
  description text,
  regular_price numeric not null,
  tayo_price numeric not null,
  next_year_regular_price numeric,
  next_year_tayo_price numeric,
  pricing_model text not null check (pricing_model in ('flat','per_pax','tiered','hybrid')),
  minimum_revenue_floor numeric,
  capacity_max integer,
  lead_time_days integer,
  recommended_for_tags text[],
  sample_photos text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`recommended_for_tags` is an array of free-form tags used by the matching engine: `aesthetic_minimalist`, `ceremony_catholic`, `guest_count_150_300`, `style_traditional`, `budget_premium`, etc.

#### vendor_package_inclusions

```sql
create table vendor_package_inclusions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references vendor_packages(id) on delete cascade,
  item_name text not null,
  description text,
  quantity numeric,
  unit text,
  inclusion_type text not null check (inclusion_type in ('fixed','swappable','optional','bonus')),
  is_optional boolean not null default false,
  condition text,
  swap_options jsonb,
  location_options jsonb,
  display_order integer not null default 0
);
```

`unit` values: `hour`, `pax`, `item`, `rooms`, `photos`, `minutes`, `pieces`, `tier`, etc.

`swap_options` JSON shape:

```json
[
  { "label": "Engagement shoot (4 hrs)", "delta": 0 },
  { "label": "Pre-wedding video (3 mins)", "delta": 0 },
  { "label": "Save-the-date video (1 min)", "delta": 0 }
]
```

`location_options` JSON shape (e.g. for a Seda Hotels package valid at multiple properties):

```json
[
  { "label": "Seda Nuvali", "minimum_revenue_floor": 250000 },
  { "label": "Seda Lio Palawan", "minimum_revenue_floor": 350000 }
]
```

#### vendor_package_qr_placements

Each placement is a Tayo Exclusive commitment — where the vendor agrees to show the event QR.

```sql
create table vendor_package_qr_placements (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references vendor_packages(id) on delete cascade,
  placement text not null
);
```

`placement` values: `usb_packaging`, `photobook_back_cover`, `menu_cards`, `cake_topper`, `signage_table_numbers`, `signage_welcome`, `bridal_car_window`, `program_back`, etc.

#### vendor_package_addons

A la carte rate card.

```sql
create table vendor_package_addons (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references vendor_packages(id) on delete cascade,
  item_name text not null,
  price numeric not null,
  unit text,
  description text
);
```

#### vendor_package_overage_rates

```sql
create table vendor_package_overage_rates (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references vendor_packages(id) on delete cascade,
  trigger_type text not null,
  threshold numeric not null,
  unit text,
  rate numeric not null
);
```

`trigger_type`: `pax_above`, `hours_above`, `distance_above`. The cost engine uses these rows to compute the all-in price during inquiry.

#### vendor_package_exclusivity_clauses

```sql
create table vendor_package_exclusivity_clauses (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references vendor_packages(id) on delete cascade,
  clause_text text not null
);
```

`clause_text` values: `no_outside_food`, `must_use_in_house_catering`, `no_outside_drinks`, `must_use_in_house_florist`, etc. Surfaces in the UI as **What's NOT Included** so couples can budget around it.

#### inquiries

```sql
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  couple_user_id uuid not null references users(id) on delete cascade,
  inquired_at timestamptz not null default now(),
  wedding_date_at_inquiry date,
  venue_at_inquiry text,
  budget_range_min numeric,
  budget_range_max numeric,
  package_interest_id uuid references vendor_packages(id),
  message text,
  vendor_response_status text not null default 'awaiting' check (vendor_response_status in ('awaiting','responded','quoted','declined','booked')),
  response_time_hours numeric
);
```

#### bookings

```sql
create table bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  package_id uuid references vendor_packages(id),
  contracted_amount numeric not null,
  inclusions_snapshot jsonb not null,
  swap_decisions jsonb,
  payment_milestones jsonb not null,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`inclusions_snapshot` is a frozen copy of the package + inclusions at booking time (vendors may later edit a package, but a couple's booking must be immutable).

`payment_milestones` JSON shape:

```json
[
  { "label": "Reservation fee", "amount": 20000, "due_date": "2026-06-01", "status": "pending" },
  { "label": "50% downpayment", "amount": 80000, "due_date": "2026-09-01", "status": "pending" },
  { "label": "Balance", "amount": 100000, "due_date": "2027-03-15", "status": "pending" }
]
```

#### budget_lines

```sql
create table budget_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null,
  subcategory text,
  target_amount numeric,
  contracted_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  pending_amount numeric not null default 0,
  vendor_id uuid references vendors(id),
  booking_id uuid references bookings(id),
  coverage_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`coverage_source` is for line items absorbed by another vendor's bundle (e.g. `covered_by_seda_bundle`, `covered_by_caterer`, `covered_by_venue_inclusion`).

#### timeline_tasks

```sql
create table timeline_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','skipped')),
  assigned_to_user_id uuid references users(id),
  linked_booking_id uuid references bookings(id),
  payment_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`category` values match the 21 categories in `05_Default_Filipino_Wedding_Template_v1.docx`: `FINANCE`, `PEOPLE`, `CHURCH`, `CIVIL`, `VENUE_CEREMONY`, `VENUE_RECEPTION`, `STYLE`, `ATTIRE`, `BEAUTY`, `INVITATION`, `STATIONERY`, `PHOTO_VIDEO`, `MUSIC_ENTERTAINMENT`, `FOOD_BEVERAGE`, `TRANSPORT`, `ACCOMMODATION`, `LEGAL_DOCS`, `WELLNESS`, `HONEYMOON`, `MISC`, `DAY_OF`.

#### day_of_timeline

```sql
create table day_of_timeline (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  start_time time not null,
  duration_minutes integer,
  activity text not null,
  notes text,
  display_order integer not null default 0
);
```

#### tables

```sql
create table tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  side text check (side in ('bride','groom','shared')),
  closeness_tier integer check (closeness_tier between 1 and 4),
  group_label text,
  capacity integer not null,
  table_shape text check (table_shape in ('round','rectangular','square')),
  position_x numeric,
  position_y numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table guests add constraint guests_table_id_fkey foreign key (table_id) references tables(id) on delete set null;
```

#### photos

```sql
create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  uploaded_by_user_id uuid not null references users(id),
  uploader_role text not null check (uploader_role in ('couple','guest','vendor','shooter')),
  r2_object_key text not null,
  thumbnail_r2_key text,
  caption text,
  captured_at timestamptz,
  zone text,
  is_in_curated_album boolean not null default false,
  created_at timestamptz not null default now()
);
```

#### photo_tags

```sql
create table photo_tags (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  tagged_user_id uuid references users(id) on delete cascade,
  tagged_guest_id uuid references guests(id) on delete cascade,
  tagged_by_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  check (tagged_user_id is not null or tagged_guest_id is not null)
);
```

#### shot_list

```sql
create table shot_list (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  shot_description text not null,
  phase text not null check (phase in ('pre_wedding','getting_ready_p1','getting_ready_p2','ceremony_venue','ceremony','family_portraits','reception','additional')),
  assigned_shooter_user_id uuid references users(id),
  captured_photo_id uuid references photos(id),
  status text not null default 'pending' check (status in ('pending','captured','skipped')),
  display_order integer not null default 0
);
```

Default 109 shots are seeded into every Catholic-tier new event.

#### vendor_recruitment_requests

```sql
create table vendor_recruitment_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  couple_user_id uuid not null references users(id),
  vendor_name text not null,
  vendor_category text not null,
  vendor_facebook_url text,
  vendor_instagram_url text,
  vendor_phone text,
  vendor_email text,
  notes text,
  recruitment_status text not null default 'pending_outreach' check (recruitment_status in ('pending_outreach','contacted','declined','joined','certified')),
  outreach_at timestamptz,
  linked_vendor_id uuid references vendors(id),
  created_at timestamptz not null default now()
);
```

#### coordinators

```sql
create table coordinators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  coordinator_code text unique not null,
  is_tayo_integrated boolean not null default false,
  commission_balance numeric not null default 0,
  referral_count integer not null default 0,
  coordinator_type text check (coordinator_type in ('full_planner','halfway_planner','on_the_day','stylist')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 4.2 Row-Level Security

Every table has RLS enabled. Service-role key (used only in server-side route handlers) bypasses RLS. Examples below; the full RLS policy file lives at `supabase/migrations/0002_rls_policies.sql`.

**Couples can read/write only their own events:**

```sql
alter table events enable row level security;

create policy "couples can read their own events"
  on events for select
  using (
    auth.uid() = couple_user_id_1
    or auth.uid() = couple_user_id_2
    or exists (
      select 1 from event_roles
      where event_roles.event_id = events.id
      and event_roles.user_id = auth.uid()
    )
  );

create policy "couples can update their own events"
  on events for update
  using (
    auth.uid() = couple_user_id_1 or auth.uid() = couple_user_id_2
  );
```

**Guests can read only events they're invited to:**

```sql
alter table guests enable row level security;

create policy "guests can read their own guest row"
  on guests for select
  using (auth.uid() = user_id);

create policy "couples can read all guests of their events"
  on guests for select
  using (
    exists (
      select 1 from events
      where events.id = guests.event_id
      and (events.couple_user_id_1 = auth.uid() or events.couple_user_id_2 = auth.uid())
    )
  );

create policy "guests can update their own RSVP"
  on guests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**Vendors can read inquiries directed to them, and write packages they own:**

```sql
alter table inquiries enable row level security;

create policy "vendors can read inquiries to their vendor account"
  on inquiries for select
  using (
    exists (
      select 1 from vendors
      where vendors.id = inquiries.vendor_id
      and vendors.user_id = auth.uid()
    )
  );

create policy "vendors can update their own inquiries"
  on inquiries for update
  using (
    exists (
      select 1 from vendors
      where vendors.id = inquiries.vendor_id
      and vendors.user_id = auth.uid()
    )
  );

alter table vendor_packages enable row level security;

create policy "vendors can read their own packages"
  on vendor_packages for select
  using (
    exists (
      select 1 from vendors
      where vendors.id = vendor_packages.vendor_id
      and vendors.user_id = auth.uid()
    )
  );

create policy "anyone authenticated can read active packages"
  on vendor_packages for select
  using (is_active = true);

create policy "vendors can write their own packages"
  on vendor_packages for all
  using (
    exists (
      select 1 from vendors
      where vendors.id = vendor_packages.vendor_id
      and vendors.user_id = auth.uid()
    )
  );
```

**Coordinators access events they have an `event_roles` entry for:**

```sql
create policy "coordinators can read assigned events"
  on events for select
  using (
    exists (
      select 1 from event_roles
      where event_roles.event_id = events.id
      and event_roles.user_id = auth.uid()
      and event_roles.role in ('coordinator','stylist')
    )
  );
```

**Staff bypass RLS via service-role key.** No RLS policy is required; admin app uses the service role for queries.

---

## 5. Authentication & Account Types

### 5.1 Auth Flow

Use Supabase Auth with the following methods:

- **Magic link email login** — default for all roles. One-time token sent to email, click to sign in.
- **Google OAuth** — optional secondary, mainly for guests who already have a Google account.
- **Phone OTP via Twilio** — V1.5, deferred.

Magic links are valid for 1 hour. Sessions are stored in Supabase Auth-managed cookies, with a 30-day refresh window.

### 5.2 Account Types and Capabilities

| Role | Default View | Extra Menu Items | Per-Event Access |
|---|---|---|---|
| Couple | My Events home | Plan, Vendors, Guests, Photos, Budget, Settings | Full access to their own event(s) |
| Guest | Their event view | Personal album, RSVP, Photo upload | Read-only event details, write own photos / RSVP |
| Vendor | My Packages dashboard | Inquiries, My Weddings, Reviews, Calendar, Payments | Read events they're booked for |
| Coordinator | My Weddings switcher | Same as Couple, multi-event | Couple-level access for their assigned events |
| Stylist | Design surfaces | Palettes, Mood Board, Seating | Read budget, write design surfaces |
| Tayo Staff | Admin home | Vendor Approvals, Certifications, Disputes, System Health, Financials | Read all events; can create their own as a couple |

### 5.3 Account Creation Flows

**Couple signup:**

1. Land on `tayo.app` → click "Plan your wedding"
2. Enter email + name → magic link sent via Resend
3. Confirm via link → signup form: wedding date, ceremony type, venue type, guest count estimate
4. Tayo creates an `events` row, generates a slug from the names + year, and seeds the default checklist (21 categories from Section 7 of `05_Default_Filipino_Wedding_Template_v1.docx`)
5. Redirect to dashboard

**Vendor signup:**

1. Land on `tayo.app/vendors` → click "Become a Tayo Vendor"
2. Application form: business name, category, location, portfolio
3. Submit → Tayo Staff review (1–2 days)
4. On approval: vendor receives magic link → fills out profile
5. Vendor onboarding wizard: add at least 1 package, define pricing, upload portfolio
6. Status becomes `active`, vendor appears in directory

**Guest signup (auto-triggered):**

1. Guest scans QR code from physical invitation / print
2. QR deep-links to `tayo.app/maria-juan-2026?invite=[token]`
3. Server resolves the token to a `guests` row. If no `users` row exists yet, prompt for name only (no password) → creates lightweight `users` row with `account_type = 'guest'`
4. Issue a Supabase Auth session
5. Guest lands on event view with RSVP, personal album, photo upload

**Coordinator signup:**

1. By invitation only in V1
2. Tayo Staff sends invite email
3. Coordinator fills profile + accepts Integrated Coordinator program terms
4. Receives unique `coordinator_code`

**Tayo Staff signup:**

1. Internal-only — created manually via the admin app or a SQL seed
2. Login via magic link

### 5.4 The QR / URL Flow (Critical)

Single canonical event URL: `tayo.app/[event-slug]`

When ANY user visits the URL, the page renders based on their identity:

- **Not logged in** → public landing page (story, RSVP, public gallery)
- **Logged in as couple** → planning dashboard for this event
- **Logged in as guest of this event** → personal album, RSVP, photo upload
- **Logged in as vendor for this event** → vendor view of their package + payments
- **Logged in as coordinator for this event** → full event management
- **Logged in as stylist for this event** → design surfaces
- **Logged in as staff** → admin overlay

QR codes are deep links to event URLs with auth tokens. On scan, the user is auto-logged in (if account exists) or prompted for a quick name entry (lightweight account).

`tayo.app/dashboard` (without event slug) → "My Events" home: cards for every event the user is connected to, tap a card to enter that event's role-appropriate view.

The role resolution algorithm runs server-side in the page's RSC layer:

```typescript
async function resolveRoleForEvent(userId: string, eventSlug: string): Promise<RoleView> {
  const event = await db.events.findBySlug(eventSlug);
  if (!event) return { kind: 'not_found' };

  if (!userId) return { kind: 'public', event };

  if (event.couple_user_id_1 === userId || event.couple_user_id_2 === userId) {
    return { kind: 'couple', event };
  }

  const role = await db.eventRoles.findOne({ event_id: event.id, user_id: userId });
  if (role) return { kind: role.role, event };

  const guest = await db.guests.findOne({ event_id: event.id, user_id: userId });
  if (guest) return { kind: 'guest', event, guest };

  const user = await db.users.findById(userId);
  if (user.account_type === 'staff') return { kind: 'staff', event };

  return { kind: 'public', event };
}
```

---

## 6. UI Specification (Where Buttons Go)

For each page, the spec describes layout, primary CTA placement, secondary actions, and the shadcn/ui components to use. Custom components live in `packages/ui/`.

### 6.1 Public Event Landing Page (`tayo.app/[slug]`)

Three variations were prototyped in `06_Couple_Landing_Page_Designs_v1.html`. Recommended for V1: **Variation C (Cormorant Garamond + Manrope + Custom Monogram).**

**Layout:**

- Top: minimal logo (top-left) + "Sign in" link (top-right)
- Hero: monogram (large, centered), couple names (Cormorant Garamond, 96px), date in long-form (Manrope, 18px), "View invitation" CTA
- Sections (vertically stacked, each with its own viewport-height hero): Our Story, Schedule, Venue, RSVP, Gallery
- Footer: monogram + hashtag

**Primary CTA on hero:** "View invitation →" (champagne gold gradient, takes user to RSVP if logged in or sign-in-then-RSVP).

**Components:** custom `<Hero />`, custom `<Monogram />` (renders SVG from `events.monogram_svg`), shadcn `<Button>` with custom variant.

### 6.2 Couple Dashboard (`tayo.app/dashboard`)

Layout: 3-column desktop, single-column mobile.

- **Left sidebar (240px):** nav (Overview, Plan, Budget, Vendors, Guests, Photos, Settings)
- **Center main column:** hero card (countdown to wedding date) + stats row (guests confirmed, vendors booked, budget %, days remaining) + tasks card + AI suggestion card + recent activity feed
- **Right column (300px):** notifications + messages + quick links

**Primary CTAs:**

- "Add task" (top right of tasks card)
- "Browse vendors" (top of Vendors menu sub-page)
- "Invite guests" (top of Guests menu sub-page)
- Bottom-fixed `+` button on mobile for quick-add task

**Components:** shadcn `<Card>`, `<Button>`, `<Progress>`, custom `<Countdown>`, custom `<TaskItem>`.

### 6.3 Vendor Browse (`tayo.app/vendors`)

**Layout:**

- Top filter bar: category, location, budget range, free-transport zone toggle, Tayo Recommended toggle
- Grid of vendor cards (3-column desktop, 1-column mobile)
- Each card: cover photo, business name, category, rating, Tayo Recommended badge if applicable, "Free transport in your area" badge if applicable, starting price

**Primary CTA on each card:** the entire card is clickable and opens the vendor profile.

**Components:** shadcn `<Select>`, `<Slider>`, `<Switch>`, custom `<VendorCard>`, custom `<Badge>`.

### 6.4 Vendor Profile (`tayo.app/vendor/[slug]`)

**Layout:**

- Hero: cover photo + business name + Tayo Recommended badge + rating + location
- Stats row: years in business, response time, bookings YTD
- Tabs: Packages | Portfolio | Reviews | Contact
- Each Package tab card shows: name, regular price (struck), Tayo price, Tayo Exclusive badge, Inclusions, What's NOT Included, Additional Costs, Capacity, Lead time, Transport zone, Recommended For tags, sample photos, "Inquire about this package" CTA

**Primary CTA:** "Inquire Now" (large, sticky bottom-right on desktop, sticky bottom-bar on mobile).

**Components:** shadcn `<Tabs>`, `<Card>`, custom `<PackageCard>`, custom `<InclusionsList>`.

### 6.5 Inquire Now Modal

Triggered from any vendor profile or package card.

**Form fields:**

- Wedding date (pre-filled from couple's event)
- Venue location (pre-filled)
- Budget range (slider)
- Package interest (radio)
- Free-text message
- "Send inquiry" button

Submitting creates an `inquiries` row, sends the vendor a notification email + in-app, gives the couple a confirmation toast + redirects to the inquiry log.

**Components:** shadcn `<Dialog>`, React Hook Form + Zod schema, shadcn `<Slider>`, `<RadioGroup>`, `<Textarea>`, `<Button>`.

### 6.6 Vendor Dashboard (`tayo.app/vendor`)

Layout: similar shell to couple dashboard but different sidebar.

- **Left sidebar:** Overview, My Packages, Inquiries, My Weddings, Reviews, Calendar, Payments, Settings
- **Center:** stats row (inquiries this month, bookings YTD, avg response time, rating) + recent inquiries list

**Primary CTAs:**

- "+ Add new package" (top of My Packages)
- "Respond" on each unanswered inquiry
- "Update prices for next year" (visible only Dec 1–31)

### 6.7 Inquiry Detail (Vendor side)

When vendor opens an inquiry:

- Couple info, event details (venue, date, guest count)
- Quote-building form: package, total price, payment milestones, custom inclusions, message
- "Send quote" CTA

### 6.8 Coordinator Dashboard (`tayo.app/coordinator`)

**Layout:**

- Header: name + Tayo Integrated badge
- Stats row: active weddings, pipeline, bookings YTD, commission balance
- Table view of weddings: couple, date, stage, tier, RSVPs, vendors booked, days out, "Open dashboard" action
- Right side panel: Coordinator Code + commission tracker + "Refer a couple" button

### 6.9 Tayo Staff Admin (`admin.tayo.app`)

**Layout:** full admin shell.

- **Sidebar:** Vendor Approvals, Vendor Certifications, Coordinator Approvals, Disputes, System Health, Financial Reports, User Management
- **Main content area:** depends on which item selected (mostly tables with filter / search / row actions)

---

## 7. V1.0 Feature Scope (Definitive List)

Legend: ✓ V1.0 must ship, ◐ V1.0 if time permits, ○ V1.5+

### Authentication & accounts

- ✓ 5 user roles: couple, guest, vendor, coordinator, Tayo Staff (+ stylist as coordinator subtype)
- ✓ Magic link login for all roles
- ✓ Google OAuth for guests
- ○ Phone OTP login (V1.5)
- ✓ QR deep-linking for guests with auto-account-creation
- ✓ `My Events` home for users with multiple event memberships
- ✓ Single canonical event URL with role-aware rendering

### Couple planning

- ✓ Event creation with default checklist auto-loaded (21 categories)
- ✓ Budget tracker with 46 PH categories (per `05_Default_Filipino_Wedding_Template_v1.docx`)
- ✓ Timeline with 21 categories
- ✓ Day-of run-of-show with 30-row default template
- ✓ Mass-role assignment (1st reading, 2nd reading, psalm, prayers of the faithful, offertory, etc.)
- ✓ Seating chart drag-drop (table + closeness tier + side)
- ◐ Seating chart with venue-layout positioning (V1.5 polish)
- ✓ Guest list import from CSV
- ✓ Voice / video guestbook entries

### Vendor system

- ✓ Vendor directory with category, location, budget, free-transport zone, Tayo Recommended filters
- ✓ Vendor application + Tayo Staff approval workflow
- ✓ Tayo Certified flag (manual verification by staff)
- ✓ Tayo Recommended badge (curated list)
- ✓ Packages with full inclusions schema (fixed / swappable / optional / bonus)
- ✓ Package swap rules (e.g. engagement shoot OR pre-wedding video OR save-the-date)
- ✓ Package exclusivity clauses surfaced as "What's NOT Included"
- ✓ Transport radius + outside-radius rate type (per_km / flat / quote)
- ✓ Hidden expense calculation (overage rates: pax_above, hours_above, distance_above)
- ✓ Annual price-lock with December update window (Dec 1–31 each year)
- ✓ Side-by-side package comparison (3 packages max)
- ✓ Tayo Exclusive QR placements per package

### Vendor recruitment

- ✓ Couples can add their own vendors that aren't yet on Tayo
- ✓ Tayo Staff outreach pipeline (status: pending_outreach → contacted → declined / joined / certified)
- ✓ Auto-link the recruitment request to the vendor's account when they join

### Inquiries & bookings

- ✓ Inquire Now mechanic (gated contact — email / phone hidden until inquiry sent)
- ✓ In-app messaging between couple and vendor
- ✓ Vendor quote builder (package + custom inclusions + payment milestones)
- ✓ Booking confirmation flow (couple accepts quote → booking row created)
- ✓ Inclusions snapshot frozen at booking time

### Photos

- ✓ Photo upload to Cloudflare R2 (presigned URL pattern)
- ✓ Face tagging via AWS Rekognition
- ✓ Personal album generation (photos containing each guest)
- ✓ Upload from QR scan (anyone scanning the event QR can upload)
- ✓ Voice / video guestbook (treated as a photo zone)
- ✓ Shot list with 109 default Catholic-wedding shots
- ✓ Shooter mode (vendor / official photographer view)
- ✓ 6-month download window for shooters
- ✓ QR-scan tagging on the wedding day (shooter scans guest's QR → autotags them)

### Per-event landing page

- ✓ Variation C design (Cormorant + Manrope + monogram)
- ✓ Story / Schedule / Venue / RSVP / Gallery sections
- ✓ Custom monogram per couple
- ◐ Custom subdomain (`maria-juan-2026.tayo.app`) — DNS work (V1.5 if not ready)
- ✓ RSVP form integrated with `guests.rsvp_status`

### AI assistant

- ✓ Tayo Kasalan AI chat (Claude Sonnet)
- ✓ 5 free queries per day for everyone
- ✓ Unlimited paid (included in Premium / Pro Event tiers)
- ✓ Vendor recommendation tool integrated into chat
- ◐ Filipino-Catholic-peso knowledge base seed (rolling, throughout V1)

### Coordinator / Stylist features

- ✓ Multi-event switcher
- ✓ Couple-level access for assigned events
- ✓ Stylist subtype with palette / mood board / seating-only access
- ◐ Coordinator scheduling / calendar view (V1.5 if pressed)

### Integrated Coordinator program

- ✓ Unique coordinator referral code per coordinator
- ✓ Commission tracker (% of vendor bookings made through their referrals)
- ✓ 5-perks unlock (verified badge, priority support, lower commission rate, early-access features, free Pro tier on own wedding)

### Payments

- ✓ PayMongo integration (cards + GCash + Maya)
- ✓ Milestone scheduling (reservation, downpayment, balance, custom)
- ✓ Deposit + balance tracking against `bookings.payment_milestones`
- ✓ Webhook handling for payment status updates

### Defaults

- ✓ Default 21-category planning checklist auto-loaded
- ✓ Default 46-category budget skeleton auto-loaded
- ✓ Default 30-row day-of run-of-show auto-loaded
- ✓ Default 109-shot Catholic-ceremony shot list auto-loaded
- ✓ Default mass roles list auto-loaded
- ✓ Default vendor categories list auto-loaded

---

## 8. API Endpoints

All endpoints are Next.js App Router Route Handlers (`apps/web/app/api/.../route.ts`). All requests must include a Supabase auth session unless the endpoint is explicitly public. The admin app at `admin.tayo.app` uses the service-role key and has its own endpoints under `/api/admin/...`.

Response format is JSON. Errors follow `{ error: { code: string, message: string } }`.

### Events

- `GET /api/events/[slug]` — public event view (story, schedule, venue, public gallery)
- `GET /api/events/[slug]/dashboard` — role-specific event view, returns role + role-specific payload
- `POST /api/events` — create event (couple only)
- `PATCH /api/events/[id]` — update event (couple or coordinator with permission)
- `DELETE /api/events/[id]` — soft delete (couple only)

### Guests

- `GET /api/events/[id]/guests` — list guests
- `POST /api/events/[id]/guests` — add guest (auto-generates QR token)
- `POST /api/events/[id]/guests/import` — CSV import
- `PATCH /api/guests/[id]` — update guest details
- `PATCH /api/guests/[id]/rsvp` — update RSVP status (guest can only update own row)
- `DELETE /api/guests/[id]` — remove guest
- `POST /api/guests/[id]/regenerate-qr` — regenerate QR token

### Vendors

- `GET /api/vendors` — search / filter vendors (query params: category, location, budget_min, budget_max, free_transport_zone, recommended_only)
- `GET /api/vendors/[slug]` — vendor profile
- `POST /api/vendors/apply` — vendor application
- `PATCH /api/vendors/[id]` — update vendor profile (vendor only, own profile)
- `GET /api/vendors/[id]/packages` — list packages
- `POST /api/vendors/[id]/packages` — add package (vendor only)
- `PATCH /api/packages/[id]` — update package
- `POST /api/packages/[id]/duplicate` — duplicate package as starting point
- `POST /api/packages/compare` — compare 2–3 packages side by side

### Inquiries & bookings

- `POST /api/inquiries` — create inquiry (couple only)
- `GET /api/inquiries` — list inquiries (filtered by role)
- `GET /api/inquiries/[id]` — inquiry detail
- `POST /api/inquiries/[id]/quote` — vendor sends quote
- `POST /api/inquiries/[id]/decline` — vendor declines
- `POST /api/bookings` — confirm booking from quote (couple accepts)
- `GET /api/bookings/[id]` — booking detail
- `PATCH /api/bookings/[id]` — update booking (status changes, milestone updates)

### Budget & timeline

- `GET /api/events/[id]/budget` — budget lines
- `POST /api/events/[id]/budget` — add line
- `PATCH /api/budget/[id]` — update line
- `GET /api/events/[id]/timeline` — planning timeline tasks
- `POST /api/events/[id]/timeline` — add task
- `PATCH /api/tasks/[id]` — update task

### Day-of timeline & seating

- `GET /api/events/[id]/day-of` — day-of run-of-show
- `POST /api/events/[id]/day-of` — add row
- `PATCH /api/day-of/[id]` — update row
- `GET /api/events/[id]/tables` — seating tables
- `POST /api/events/[id]/tables` — add table
- `PATCH /api/tables/[id]` — update table
- `POST /api/tables/[id]/assign-guest` — assign guest to table

### Photos

- `POST /api/photos/upload` — get presigned R2 upload URL (returns `{ url, fields, object_key }`)
- `POST /api/photos` — register uploaded photo (after upload completes)
- `GET /api/events/[id]/photos` — list photos
- `GET /api/photos/[id]` — photo detail with tags
- `POST /api/photos/[id]/tag` — manual tag
- `POST /api/photos/[id]/auto-tag` — trigger Rekognition face detection + tag
- `DELETE /api/photos/[id]` — delete (uploader or couple)
- `GET /api/events/[id]/album/[guest_id]` — guest's personal album

### Shot list

- `GET /api/events/[id]/shot-list` — list shots
- `POST /api/events/[id]/shot-list` — add shot
- `PATCH /api/shot-list/[id]` — update / mark captured

### AI

- `POST /api/ai/kasalan` — Tayo Kasalan AI chat endpoint (rate-limited: 5/day free, unlimited paid)
- `POST /api/ai/recommend-vendors` — AI-driven vendor recommendation given event context

### QR resolution

- `GET /api/qr/[token]` — resolve QR token to event + role + auto-login session

### Vendor recruitment

- `POST /api/vendor-recruitment` — couple adds an unknown vendor
- `GET /api/admin/vendor-recruitment` — staff list
- `PATCH /api/admin/vendor-recruitment/[id]` — staff updates outreach status

### Payments

- `POST /api/payments/intent` — create PayMongo payment intent for a milestone
- `POST /api/payments/webhook` — PayMongo webhook handler (signature-verified)
- `GET /api/bookings/[id]/payments` — payment history for a booking

### Admin (under `admin.tayo.app/api/...`)

- `GET /api/admin/vendors/pending` — vendor applications awaiting review
- `POST /api/admin/vendors/[id]/approve`
- `POST /api/admin/vendors/[id]/certify`
- `POST /api/admin/vendors/[id]/recommend`
- `GET /api/admin/disputes`
- `GET /api/admin/system-health`
- `GET /api/admin/financials`

---

## 9. External Service Integration Notes

### Anthropic Claude

- **What it does:** powers Tayo Kasalan (couple-facing chat) and AI-driven vendor recommendation.
- **Models:** `claude-sonnet-4-5` (default), `claude-opus-4-7` (Pro Event tier), `gemini-flash-lite-latest` (cheap routing for trivial classification only).
- **Free tier limits:** none (paid from day one). Set per-project monthly budget to ₱30,000 for V1.
- **API key setup:** Anthropic Console → org-level key → store in `ANTHROPIC_API_KEY`.
- **Code package:** `@anthropic-ai/sdk`. Wrap in `packages/ai/claude.ts` with per-tier model routing.
- **Critical gotchas:** strict prompt-injection defense (the AI runs against user-supplied wedding context). Always sanitize event data before passing to model. Never let Kasalan emit URLs that aren't from the Tayo allowlist.

### FLUX 2 Pro / Replicate (V1.5)

- **What it does:** photo-realistic image gen for AI-suggested aesthetic palettes.
- **Free tier limits:** none — paid per generation, ~$0.04 per image.
- **Code package:** `replicate`. Wrap in `packages/ai/flux.ts`.
- **Critical gotchas:** generations are async — use Replicate's webhook callback rather than polling.

### AWS Rekognition

- **What it does:** face detection + face matching for photo tagging.
- **Free tier limits:** 5,000 images / month for first 12 months.
- **Region:** `ap-southeast-1` (Singapore) — closest to PH.
- **API key setup:** AWS IAM user with `AmazonRekognitionFullAccess` (scoped to face collection ops).
- **Code package:** `@aws-sdk/client-rekognition`.
- **Critical gotchas:** create one Rekognition Collection per event (`tayo-event-[uuid]`). Delete the collection 6 months after the wedding to comply with DPA 2012 retention.

### Cloudflare R2

- **What it does:** stores all photos, videos, voice memos, monograms.
- **Free tier limits:** 10 GB storage + 10M Class A operations / month + unlimited egress (this is why we use R2).
- **API key setup:** Cloudflare dashboard → R2 → API tokens → create read+write token scoped to `tayo-uploads`.
- **Code package:** `@aws-sdk/client-s3` (R2 is S3-compatible) with custom endpoint.
- **Critical gotchas:** use presigned URLs for direct browser-to-R2 uploads — never proxy uploads through Vercel (Vercel has 4.5MB request body limit).

### PayMongo

- **What it does:** PH payment processing (cards + GCash + Maya).
- **Free tier limits:** none — paid per transaction (~3.5% + ₱15 per card, ~2.5% for GCash).
- **API key setup:** PayMongo merchant onboarding (KYC required, allow 4 weeks).
- **Code package:** custom wrapper in `packages/payments/paymongo.ts` (no official PayMongo SDK).
- **Critical gotchas:** webhook signature verification is critical. Use the `paymongo-signature` header and HMAC-SHA256.

### Resend

- **What it does:** transactional email (magic links, RSVP confirmations, vendor inquiry notifications).
- **Free tier limits:** 100 emails / day, 3,000 / month.
- **API key setup:** Resend dashboard → API keys. Verify sending domain (`tayo.app`) via DNS.
- **Code package:** `resend`.
- **Critical gotchas:** SPF / DKIM / DMARC must be configured on `tayo.app` for delivery to Gmail / Outlook.

### Twilio

- **What it does:** SMS for RSVP reminders (optional V1).
- **Free tier limits:** $15 trial credit.
- **PH-specific:** sender ID registration required — allow 6–8 weeks.
- **Code package:** `twilio`.
- **Critical gotchas:** PH SMS regulations are strict — every SMS must include opt-out instructions.

### Vercel

- **What it does:** Next.js hosting + serverless functions + edge network.
- **Free tier limits:** 100 GB bandwidth, 100 hours of build time. V1 will need Pro plan ($20/mo per seat).
- **Critical gotchas:** Vercel function body limit is 4.5 MB — never proxy file uploads.

---

## 10. Development Phases

V1 is broken into 4 sprints, ~6 weeks each, totaling ~24 weeks (~6 months). The sprint plan assumes a team of 2–3 engineers + 1 designer + 1 PM.

### Sprint 1 (Weeks 1–6) — Foundations

**Goal:** working couple + guest flow end to end, with a public landing page and a logged-in dashboard.

- Repo setup + monorepo (pnpm + Turborepo)
- Supabase project + initial schema migrations
- RLS policies for `users`, `events`, `event_roles`, `guests`
- Auth flows: couple signup, guest auto-signup via QR
- QR token resolution + deep-link handling
- Couple dashboard shell + sidebar nav
- Public event landing page (Variation C, Cormorant + Manrope + monogram)
- "My Events" home
- Basic budget tracker (no vendors yet, just manual line items)
- Basic timeline with seeded 21-category default
- Basic guest list (add, edit, RSVP, CSV import)
- Sentry + PostHog wired up
- Vercel preview deployments on every PR

**Sprint 1 exit criteria:** a couple can sign up, see their dashboard, add a guest, send an invitation email, and the guest can RSVP via the event URL.

### Sprint 2 (Weeks 7–12) — Vendor Side

**Goal:** vendor lifecycle from application to booking.

- Vendor application + Tayo Staff approval flow (in admin app)
- Vendor dashboard shell
- Package management with full schema: inclusions, swap rules, exclusivity clauses, transport radius, hidden expenses, QR placements, addons, overage rates
- Vendor browse with filters (category, location, budget, free-transport, Tayo Recommended)
- Vendor profile page with Packages / Portfolio / Reviews / Contact tabs
- Inquire Now mechanic
- In-app messaging (couple ↔ vendor)
- Vendor quote builder
- Booking confirmation flow (couple accepts quote)
- Vendor recruitment requests
- Annual price-lock + December update window logic

**Sprint 2 exit criteria:** a vendor can apply, get approved, add a package, receive an inquiry, send a quote, and the couple can confirm a booking. Booking shows up in the couple's budget tracker.

### Sprint 3 (Weeks 13–18) — Photos + AI

**Goal:** photo system + AI chat working.

- Photo upload to R2 via presigned URLs
- Thumbnail generation (sharp on Vercel function)
- Face detection + face matching via AWS Rekognition
- Personal album generation (photos containing each guest)
- Shot list with 109-shot default seed
- Shooter mode (vendor / official photographer view)
- 6-month download window
- QR-scan tagging on the wedding day
- Voice / video guestbook upload
- Tayo Kasalan AI assistant (Claude Sonnet)
- Vendor recommendation tool integrated into chat
- Rate limiting (5 free queries / day, unlimited for paid tiers)

**Sprint 3 exit criteria:** a guest scans the event QR on the wedding day, uploads a photo, and finds it auto-tagged in their personal album within 60 seconds. A couple can chat with Tayo Kasalan and get a vendor recommendation.

### Sprint 4 (Weeks 19–24) — Polish + Launch

**Goal:** ready for production launch.

- Coordinator dashboard (multi-event switcher)
- Integrated Coordinator program (referral codes, commission tracker, 5-perks unlock)
- Tayo Staff admin tool (full feature set)
- PayMongo integration + milestone scheduling
- Mass-role assignment UI
- Day-of run-of-show editor
- Seating chart drag-drop
- All default templates auto-loaded on event creation
- E2E tests covering the 5 critical paths
- Lighthouse 90+ on landing pages
- Accessibility audit with axe-core
- Bug fixes, perf optimization
- Production deploy to Vercel + DNS cutover

**Sprint 4 exit criteria:** all features in Section 7 marked ✓ V1.0 are shipped, all tests pass, Lighthouse scores meet target, production environment is stable, and 5 internal users have completed end-to-end test weddings.

---

## 11. Testing & QA

### Unit tests (Vitest)

- Utility functions (slug generation, distance calculations, milestone date math)
- Business logic (cost engine, swap-rule evaluator, exclusivity-clause checker)
- Zod schemas (parse + validation)

Target: every file in `packages/shared/` and `packages/ai/` has tests.

### Integration tests (Vitest + Supabase test mode)

- Database operations against a local Supabase instance
- RLS policy verification (couple can read own event, cannot read other events)
- API route handlers with mocked auth sessions

### E2E tests (Playwright)

Five critical paths must pass on every PR:

1. **Couple onboarding:** couple signs up → creates event → adds guests → sends invitations
2. **Guest path:** guest scans QR → RSVPs → uploads photo → finds personal album
3. **Vendor lifecycle:** vendor applies → gets approved → adds package → receives inquiry → sends quote → couple books
4. **Coordinator path:** coordinator opens couple's dashboard via Coordinator Code → completes a task on the couple's behalf
5. **AI recommendation:** couple uses Tayo Kasalan → gets vendor recommendation → inquires

### Visual regression

Playwright screenshot snapshots on the public landing page (Variation C) and key dashboard pages.

### Accessibility audit

`@axe-core/playwright` integrated into the E2E suite. Zero serious violations on landing pages, dashboard, vendor profile.

### Performance budget

Lighthouse 90+ on landing pages on both mobile and desktop. Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1.

---

## 12. Reference Documents

Developers should read these in order before starting work:

- `01_Competitor_Analysis.docx` — strategic context, market positioning
- `02_Competitor_Analysis_Consolidated_v2.docx` — competitor + AI stack analysis
- `03_Strategy_Discussion_Log_v1.docx` — decisions made (v2 pending)
- `04_Tayo_App_Mockups_v1.html` — visual mockups across all roles
- `05_Default_Filipino_Wedding_Template_v1.docx` — comprehensive default checklists (21 timeline categories, 46 budget categories, 109-shot list, mass roles, day-of run-of-show)
- `06_Couple_Landing_Page_Designs_v1.html` — design system + 3 landing page variations
- **THIS DOCUMENT** — `07_Tayo_V1_Developer_Specification.md` — build spec

---

## 13. Open Questions / Decisions Pending Before Build Starts

These decisions must be resolved before Sprint 1 begins (or before the dependent feature in later sprints).

- [ ] **Brand direction:** confirm Variation C from `06_Couple_Landing_Page_Designs_v1.html` as primary direction. Owner: Founder + designer. Due: Week 0.
- [ ] **Logo design:** finalize Tayo wordmark and the per-couple monogram generator template. The monogram generator must produce a unique SVG per couple from initials + a curated set of motifs. Owner: designer. Due: Week 2 (so Sprint 1 can render real monograms on the landing page).
- [ ] **Final tier pricing:** lock Essentials / Premium / Pro Event tier prices before payment integration. Owner: Founder + finance. Due: end of Sprint 3 (before Sprint 4 payment work).
- [ ] **Concierge re-pricing:** from ₱9,999 to ₱25,000+ before launch. Owner: Founder. Due: end of Sprint 3.
- [ ] **Lifetime Album re-scoping:** cap at 5–7 years or re-price to ₱2,999. Owner: Founder + ops. Due: end of Sprint 3.
- [ ] **Vendor onboarding launch list:** which 50–100 vendors per category in NCR / CALABARZON to invite first. Owner: ops + founder. Due: end of Sprint 2 (so Sprint 3 / 4 can run real outreach).
- [ ] **Coordinator launch list:** identify first 10–20 PH coordinators to invite as Integrated. Owner: ops. Due: end of Sprint 3.
- [ ] **AI corpus:** 6–12 month curation effort to build Filipino-Catholic-peso knowledge base. Owner: founder + content lead. Due: rolling, with V1.0 corpus minimum-viable by Sprint 3 exit.
- [ ] **DPA 2012 compliance:** NPC registration, DPO appointment. Owner: founder + legal. Due: before public launch.
- [ ] **Vercel vs Cloudflare Pages:** confirm Vercel is final hosting choice. Cloudflare Pages would save money but has less mature Next.js App Router support. Owner: tech lead. Due: Week 0.
- [ ] **Subdomain strategy:** decide whether custom subdomains (`maria-juan-2026.tayo.app`) ship in V1 or V1.5. DNS automation cost is non-trivial. Owner: tech lead. Due: end of Sprint 3.
- [ ] **PayMongo merchant account:** start KYC at Week 0 so the account is live before Sprint 4. Owner: ops. Due: Week 0.
- [ ] **Resend domain verification:** SPF / DKIM / DMARC on `tayo.app` must be set up in Week 0 so test magic-link emails deliver to Gmail. Owner: tech lead. Due: Week 0.
- [ ] **Default checklist sign-off:** the 21-category timeline, 46-category budget, 109-shot list, and 30-row day-of run-of-show in `05_Default_Filipino_Wedding_Template_v1.docx` must be reviewed and signed off by a real Filipino-Catholic wedding coordinator before Sprint 1 ends. Owner: ops + coordinator advisor. Due: Week 6.
- [ ] **AI rate limiting strategy:** confirm 5 free / day for free tier, unlimited for Premium / Pro Event. Confirm whether Premium really gets unlimited or whether we cap at, e.g., 200 / day to prevent abuse. Owner: founder. Due: end of Sprint 2.

---

*End of document.*
