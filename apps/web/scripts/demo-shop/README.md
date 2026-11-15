# 🎬 Demo shop · Setnayan Productions

The supplier shop every plan picture on **For Suppliers / For Coordinators** is taken from, and the source of its own
calling card and tarps. Owner **Juan dela Cruz** · events production (photo, video, live stream, lights and sound) ·
based in Tagaytay, serving Metro Manila, Cavite and Laguna.

Every screenshot is the **real page** the app serves, drawn from rows in a **local, throwaway** database — never a
drawing, and never production. ⚠ Not the owner's real shop "SetnaProd" (`/setnaprod`).

| File | What it is |
|---|---|
| `setnayan-productions.fixture.ts` | The shop as data: name, owner, five services, the eight picture keys, the five plans. |
| `seed-setnayan-productions.ts` | Writes the fixture at one plan. Called by the existing demo seed: `seed-demo-vendors.ts --showcase=setnayan-productions --plan=<plan>`. |
| `images/` | The pictures, by stable key (`sp-logo-mark` · `sp-logo-wordmark` · `sp-juan` · `sp-hero` · `sp-debut` · `sp-corporate` · `sp-livestream` · `sp-drone`). **Drop the Higgsfield photos in here with the same file names** and re-run the shots. |
| `make-placeholder-images.mjs` | Makes a labelled placeholder for any key that has no file yet. Never overwrites. |
| `replay-into-postgres.ts` | Replays every migration into a local Postgres, reusing the db-test harness (`tests/db/replay-migrations.ts`). |
| `local-supabase.mjs` | A local stand-in for the Supabase API: PostgREST + the two auth calls the app makes. Writes `.local-env` (gitignored). |
| `demo-shop-shots.mjs` | Takes every shot and builds the contact sheets in `docs/demo-shop/`. |
| `app/dev/supplier-print-lab` | The calling card and tarps for a shop (dev only, 404 in production). |

## Plans

| Plan | `tier_state` | Verified | What the fixture shows |
|---|---|---|---|
| Free | `free` | no | Public by self-publishing, before verification. No seal, not in search, **one** live card. |
| Verified | `verified` | yes | The seal; in search; cards within `TIER_CAPS.verified`. |
| Supplier Plus | `solo` | yes | Own web address; cards within `TIER_CAPS.solo`. |
| Pro | `pro` | yes | Pinned review; all five cards. |
| Ultra | `enterprise` | yes | Nationwide reach; all five cards. |

Which cards are live is **computed from `TIER_CAPS`** (parent categories × cards per category), never typed —
`lib/the-demo-shop-follows-the-plan-table.test.ts` holds it.

## Run it (all local)

Needs a local Postgres 16 (`initdb`/`pg_ctl`) and a PostgREST 12 binary.

```bash
# 1 · a throwaway Postgres on :54329 (any data dir)
initdb -D /tmp/sp-pg -U postgres --auth=trust && pg_ctl -D /tmp/sp-pg -o "-p 54329 -k /tmp" -l /tmp/sp-pg.log start
```

```bash
# 2 · every migration, into database setnayan_demo (≈2 min)
PGHOST=/tmp PGPORT=54329 pnpm -F @setnayan/web exec tsx scripts/demo-shop/replay-into-postgres.ts
```

```bash
# 3 · the local Supabase stand-in on :54321 (leave running)
POSTGREST_BIN=/path/to/postgrest node apps/web/scripts/demo-shop/local-supabase.mjs
```

```bash
# 4 · the app against it (leave running)
cd apps/web && set -a && . scripts/demo-shop/.local-env && set +a && NODE_OPTIONS=--max-old-space-size=8192 pnpm dev
```

```bash
# 5 · every shot + the contact sheets (seeds each plan in turn)
cd apps/web && node scripts/demo-shop/demo-shop-shots.mjs
```

`--only=shop|views|prints|sheets` runs one part. `CHROMIUM_PATH=` points at a Chrome if Playwright's own is not
installed.

## What to know

- **Dark.** Requested the way a person gets it (Dark chosen, signed in, phone prefers dark), then the page is asked
  whether it painted dark. Today none of these pages has joined dark mode (`DARK_READY` in `lib/appearance.ts`;
  signed-out visitors are always light), so every "dark" shot is recorded as *not painted* instead of being saved as a
  copy of the light one. When a page joins `DARK_READY`, its dark shots appear with no change here.
- **The reach map** loads OpenStreetMap tiles from the internet. Where that is blocked the map is blank.
- **The QR codes** point at `https://www.setnayan.com/v/setnayan-productions`, which does not exist in production.
- **Bookings** are closed on Setnayan until launch; the seed opens them on the LOCAL database for its two bookings
  and puts the setting back (a Free shop is public only while they are closed).
