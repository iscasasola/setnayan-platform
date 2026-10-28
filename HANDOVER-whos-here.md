# HANDOVER — Home › Who's here (PR #7031, branch `claude/home-whos-here`) — paused 2026-10-29 (Mac out of memory)

## State
- PR #7031 is a DRAFT, label `do-not-auto-merge`, auto-merge off. Head `2662eb0b` = merge of origin/main (baselines
  regenerated). CI for that head had NOT finished when paused — re-check: `gh pr checks 7031`.
- Built and committed: migration `20271295895751_hub_viewers.sql`; `lib/whos-here.ts`(+`.server.ts`, `.test.ts`);
  `app/api/hub/seen/route.ts`; `app/[slug]/_components/hub-seen-beacon.tsx` (mounted in site-body); middleware
  `HUB_BUST_EXEMPT_PATHS`; `event-team-presence.tsx` (layout); `home-cards/home-whos-here-card.tsx` +
  `home-whos-here-guest-sheet.tsx` (lazy); page.tsx (3 placements); export/erasure; Ugat J58; exposure/port/screens
  baselines; `tests/db/who-is-viewing-the-hub.db.test.ts`; `/dev/home-lab?whos=…`; load harness `--beacon 1`.
- Earlier CI round fixed: ugat screens stale, socket guard (layout presence now in LAYOUT_MAY_REACH, gate
  `TEAM_PRESENCE_DISABLED`), both-ends result logging, one-render marker, formatCount, no "Your team", guest sheet lazy.
- Corpus DECISION_LOG row pushed (811162dc).
- Walk done (128 shots + 3 tap shots) in `~/Documents/Claude/Projects/shots-2026-10-28/whos-here/` — taken BEFORE the
  sub-line copy changed "Your team now" → "On the dashboard now" (re-shoot 2–3 for the record).

## Not done — exact next steps
1. `gh pr checks 7031` → fix any red (the last full run was on an older head).
2. LOAD CHECK (never ran — the build died under memory pressure twice): `~/Documents/Claude/Projects/wh-walk/wh-load.sh`
   (heavy lane; next build wired to the stub on 54327 → `next start` 3872 → 500 guests/120 s, `--edge 1 --beacon 1
   --strangers 100 --storageless 0.2`). Read `wh-walk/load-beacon.json` → `beacon` block (posted vs skippedInBrowser,
   outcomes guest/debounced/visitor, rowWrites, bustCookieSet must be 0, reopenCacheHit). Paste into the PR body in
   place of `LOAD_RESULTS_PLACEHOLDER` (`gh pr edit 7031 --body-file …`).
3. Re-shoot: `wh-walk/wh-serve.sh` (walk lane, port 3871) then `node wh-walk/wh-walk.mjs live,unread 375,1280 chromium,webkit light,dark`; `touch wh-walk/STOP`.
4. Update the PR body: socket-guard exception + `TEAM_PRESENCE_DISABLED` (in changelog fragment already, not yet in body).

## Owner decisions flagged
- Window 30 min (not 15) — must be ≥ the 30-min debounce.
- The layout now holds ONE presence socket per visible team dashboard tab (exception to "the chrome is not live").
- No guest-facing /privacy line written — DPO/legal copy call.
