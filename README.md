# Setnayan

> Set na 'yan. Philippines-first life-events platform. V1 weddings.

This repo holds the **Setnayan V1 single-codebase build** — one Next.js app distributed to:

- **Web** at `setnayan.com` (Vercel)
- **Desktop** for macOS + Windows via Tauri
- **Installable PWA** on iPhone, Android, iPad

Native iOS/Android Papic + DSLR pairing are Phase 2.

The product specifications and decision log live outside this repo at
`~/Documents/Claude/Projects/Setnayan/`. `CLAUDE.md` there is the canonical
source of truth for product behavior; this repo is the implementation.

## Repo layout

```
.
├── apps/
│   └── web/                Next.js 15 App Router (the one product surface)
│       ├── app/            routes (auth, login, signup, health, …)
│       ├── lib/supabase/   server + browser + middleware-refresh clients
│       ├── public/         manifest.json, service worker, PWA icons
│       └── scripts/        rls-audit.sql (CI deploy gate)
├── packages/
│   └── shared/             cross-app types (PublicId, AccountType, …)
├── src-tauri/              Tauri 2 desktop wrapper (.app + .exe + .deb)
├── supabase/
│   ├── migrations/         SQL migrations (canonical schema + RLS)
│   └── seed.sql            dev seed (re-runnable)
├── .github/workflows/      ci · build-desktop · lighthouse
└── .env.example            Sprint 0 canonical env keys
```

## Sprint 0 — what shipped

Sprint 0 iteration is **0013 platform_stack_and_sync**. Spec lives at
`~/Documents/Claude/Projects/Setnayan/0013_platform_stack_and_sync/`.

| Acceptance | State |
|---|---|
| Next.js 14+ App Router with `output: 'standalone'` | ✅ `apps/web/next.config.ts` |
| Tailwind with locked breakpoints (sm 640 / md 768 / lg 1024 / xl 1280) | ✅ `apps/web/tailwind.config.ts` |
| `.env.example` with Supabase / R2 / Daily.co / Resend / Anthropic / Sentry / PostHog / Better Stack keys | ✅ `.env.example` |
| PWA manifest + service worker + maskable icons | ✅ `apps/web/public/manifest.json` + `sw.js` + `icon-192.svg` + `icon-512.svg` |
| `generate_public_id(type_letter)` per `Account_ID_Format.md` | ✅ migration `20260512000000` |
| 4 RLS helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`) | ✅ migration `20260512000000` |
| 4 base tables (`users`, `events`, `event_members`, `event_join_tokens`) with `S89X-` public_id | ✅ migration `20260512000000` |
| RLS enabled + canonical Pattern A/B policies | ✅ migration `20260512000000` |
| Supabase email/password + magic-link (no OAuth popups) | ✅ `apps/web/app/login` + `signup` |
| `/health` returns 200 | ✅ `apps/web/app/health/route.ts` |
| Owner auto-issued `is_internal=TRUE` on signup | ✅ DB trigger keyed off `iscasasolaii@gmail.com` |
| Tauri scaffold (`src-tauri/`) | ✅ Cargo.toml + tauri.conf.json + main.rs + lib.rs |
| GitHub Actions `build-desktop.yml` producing `.app` + `.exe` | ✅ macOS + Windows matrix |
| Lighthouse ≥ 90 config (Perf / A11y / Best / SEO / PWA) | ✅ `.lighthouserc.json` + `lighthouse.yml` |

## Local development

```bash
# Once: enable pnpm via Corepack (Node 22)
corepack enable
corepack prepare pnpm@9.12.0 --activate

# Install
pnpm install

# Copy env template
cp .env.example .env.local
# …then fill in real Supabase / R2 / Daily.co / Resend / Anthropic keys.

# Run the web app
pnpm dev

# Typecheck / lint
pnpm typecheck
pnpm lint

# Tauri desktop (requires Rust toolchain + Tauri CLI prerequisites)
pnpm tauri:dev          # boots web at :3000 and wraps it in a Tauri window
pnpm tauri:build        # produces .app / .exe / .deb in src-tauri/target/
```

### Supabase

Migrations live in `supabase/migrations/` and are applied via the Supabase CLI:

```bash
# One-time link to the Supabase project
supabase link --project-ref <project-ref>

# Push the canonical schema
supabase db push

# Verify the RLS deploy-gate is clean
psql "$DATABASE_URL" -f apps/web/scripts/rls-audit.sql
```

### Tauri icons

`src-tauri/icons/icon.svg` is the master. The desktop build workflow runs
`tauri icon` to convert it to the required PNG / ICO / ICNS formats. Locally,
do the same once before `pnpm tauri:dev`:

```bash
pnpm add -g @tauri-apps/cli@^2
tauri icon src-tauri/icons/icon.svg
```

## Decision log + spec

This repo deliberately doesn't duplicate product decisions. The canonical
sources live in the specs folder at `~/Documents/Claude/Projects/Setnayan/`:

- `CLAUDE.md` — full decision log, most recent at bottom
- `CLAUDE_Code_Build_Prompt.md` — tech-stack and pattern lockdowns
- `02_Specifications/Account_ID_Format.md` — the `S89X-` ID contract
- `02_Specifications/RLS_Policy_Pattern.md` — 8 RLS patterns + 4 helpers
- `RETIRED_ITEMS.md` — what NOT to build (token wallet, STNYN wordmark, …)
- `API_Integration_Checklist.md` — external service prerequisites
- `0013_platform_stack_and_sync/` — this Sprint 0's spec + tests + fixtures

## Commit conventions

Conventional commits, iteration-scoped:

- `iter(0013): wire R2 signed-URL helper`
- `iter(0021): add overview surface card`
- `cross: align brand tokens across web + tauri shell`
- `chore: bump pnpm to 9.x`
- `docs(0024): clarify STD render quota`

PR titles include the iteration number in the same `iter(NNNN):` form.

## License

Private. © Setnayan.
