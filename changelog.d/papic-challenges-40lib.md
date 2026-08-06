## 2026-07-23 · feat(papic-games): §9 40-challenge library + 20-slot 3-lane board (PR-A/B/C · flag-dark · DB-UNVERIFIED)

Builds the Papic Challenges §9 model (owner 2026-07-23): a Setnayan-supplied **40-challenge library**, and a **20-slot board = couple (≤10) + vendor (≤5) + Setnayan backfill**, with a guaranteed Top-5 and veto-wins-backfill. Council-planned (14 agents, 39 findings/8 blockers — see corpus `0012_papic/Papic_Games_Build_Council_Verdict_2026-07-23.md`). **Owner decisions:** veto wins + backfill · paid challenges Pro+ · ship with the DB blocklist (residual accepted). Adopted defaults: Top-10 ranking PROVISIONAL, allow-vendors default ON, Pabati doorway-only.

- **PR-A** `supabase/migrations/20270919292820_papic_challenge_library_and_board.sql`: new `papic_challenge_library` (40 seed rows, provisional §9.4 `priority_rank`, RLS SELECT authenticated-only); ALTER `papic_missions` (+`library_id`/`capture_kind`/`board_slot`, `source` CHECK→+`setnayan`, two source-scoped partial uniques); `events.papic_vendor_challenges_enabled`; minor-safety BEFORE-INSERT/UPDATE trigger; `ensure_papic_board` (materialize-once / NEVER-delete resolver — de-selection = `board_slot NULL`, dodging the `papic_mission_completions ON DELETE CASCADE` trap; reuses `ensure_papic_auto_missions`); `papic_guest_missions` **v4 DROP+CREATE** (widened, `board_slot` order, v3 role guard carried, completed-off-board UNION, fail-soft, re-GRANT `authenticated,anon`).
- **PR-B** `lib/papic-missions.ts`: pure `resolveChallengeBoard` + `isChallengePromptBlocked` + `BOARD_SIZE`/`COUPLE_SLOTS`/`VENDOR_SLOTS` + types (**NON-AUTHORITATIVE** — a test/preview mirror of the SQL; the DB resolver is the single source of truth); `PapicMissionSource` +`'setnayan'`. 14 new tests → **21/21 pass**.
- **PR-C** guest board wiring: `app/api/papic/guest-missions/route.ts` → `ensurePapicBoard` (Pabati availability computed **server-side** via `eventPabatiActive`, fail-closed); `lib/papic-games.ts` `ensurePapicBoard` wrapper (removed dead `fetchEventMissions`); widened `GuestMissionRow` + `sortGuestMissions` by `board_slot`; panel capture-kind hint.

⚠ **Flag-dark** (`NEXT_PUBLIC_PAPIC_GAMES_V1`). ⚠ **NOT DB-verified** — no local Docker/psql; the migration has never been applied. **PR-D** (Pabati doorway), **PR-E** (couple curation UI), **PR-F** (vendor lane + sell-cap migration) remain. **Do NOT push/PR until the migration is applied + asserted on a real DB.** Full resume instructions: `0012_papic/Papic_Challenges_Resume_Handoff_2026-07-23.md`.

SPEC IMPACT: None new — the design is already in the corpus (`0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` §9, `Papic_Games_Build_Council_Verdict_2026-07-23.md`, `DECISION_LOG.md` 2026-07-23).

---

**Reapplied 2026-08-06.** This work was committed on 2026-07-23 to
`claude/papic-challenges-40lib` and **a pull request was never opened** — not
rejected, never proposed. It sat on the owner's machine for two weeks, found
while auditing why that checkout was 294 commits behind `origin/main`.

Reapplied onto current `main` rather than merged: the original branch is 1,372
commits behind and conflicts. **None of the five code files it touches have
changed on `main` since that branch's base**, so the port is exact — the files
are byte-for-byte what was written, not a re-implementation.

Two deltas, both mechanical:
- **The migration prefix was reallocated forward** (`20270919292820` →
  `20271117738153`) via `pnpm migration:new`. The original sat below `main`'s
  head, and while `--include-all` means it would still apply in prod, the PGlite
  replay runs in filename order — a low prefix is a db-test failure waiting.
- **One typecheck fix in the test file.** `lib[2] = { ...lib[2], … }` no longer
  compiles under `noUncheckedIndexedAccess` (an index read is possibly
  undefined, and spreading it widens every field to optional). Asserted
  non-null, matching the repo's existing idiom. The branch predates the setting.
