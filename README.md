# Tayo

Filipino-Catholic-peso-aware wedding planning platform. V1 webapp first; iOS/Android wraps after the webapp matures.

The authoritative build spec is [SPEC.md](./SPEC.md). Read that first.

## Repo layout

```
tayo/
├── apps/
│   ├── web/              # Next.js app (couple, guest, vendor, coordinator) — tayo.app
│   └── admin/            # Tayo Staff admin tool — admin.tayo.app
├── packages/
│   ├── ui/               # shadcn/ui components + custom Tayo components
│   ├── db/               # Supabase types + migrations + RLS policies
│   ├── ai/               # AI client wrappers (Claude, FLUX, Rekognition)
│   ├── payments/         # PayMongo wrapper
│   └── shared/           # Shared types, utils, constants, Zod schemas
├── supabase/
│   ├── migrations/       # SQL migrations
│   └── seed.sql          # Default checklists, vendor categories
├── docs/                 # Spec, design files, decisions
└── SPEC.md               # Authoritative build spec (Section 3 → 13)
```

## Day-0 prerequisites (before code work)

Per SPEC.md Section 3 — accounts that must be live before development begins:

- [ ] Anthropic Console (API key with per-project budget)
- [ ] Supabase project (free tier; Pro before launch)
- [ ] Cloudflare account (R2 bucket + DNS for tayo.app)
- [ ] AWS account (Rekognition only, ap-southeast-1)
- [ ] PayMongo merchant account (PH KYC — start Week 0, takes ~4 weeks)
- [ ] Resend account + verified sending domain (SPF/DKIM/DMARC on tayo.app)
- [ ] Twilio account (only if SMS in V1)
- [ ] Vercel account (Pro once team > 1)
- [ ] Sentry + PostHog free tiers
- [ ] GitHub org with private repo
- [ ] 1Password team vault for secrets

Per SPEC.md Section 13 — decisions to lock before Sprint 1:

- [ ] Brand direction confirmed as **Variation C** (Cormorant Garamond + Manrope + Aubergine palette + per-couple monogram). See `docs/06_Couple_Landing_Page_Designs_v1.html`.
- [ ] Vercel vs Cloudflare Pages — final hosting choice
- [ ] Subdomain strategy (custom subdomains in V1 or V1.5?)

## Local development

```bash
# Once: install pnpm system-wide via Corepack (requires sudo on macOS for the symlink)
sudo corepack enable
corepack prepare pnpm@9.12.0 --activate

# Install dependencies
pnpm install

# Run web app (port 3000)
pnpm --filter @tayo/web dev

# Run admin app (port 3001)
pnpm --filter @tayo/admin dev

# Run both in parallel (Turborepo)
pnpm dev

# Typecheck / lint / test across the monorepo
pnpm typecheck
pnpm lint
pnpm test
```

Copy `.env.example` to `.env.local` and fill in real secrets (never commit `.env.local`).

## Sprint plan (SPEC.md Section 10)

| Sprint | Weeks | Goal |
|---|---|---|
| 1 | 1–6 | Foundations: auth, RLS, dashboard shell, public landing page, basic budget/timeline/guests |
| 2 | 7–12 | Vendor lifecycle: application → approval → packages → inquiry → quote → booking |
| 3 | 13–18 | Photos + AI: R2 upload, Rekognition face matching, Tayo Kasalan AI assistant |
| 4 | 19–24 | Polish + launch: coordinator dashboard, admin tool, PayMongo, day-of run-of-show, E2E tests |
