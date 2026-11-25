## 2026-11-25 · fix(SW-RAWDB): the database never speaks on screen (final check, area 2, batch 2)

One sweep across areas 2–5 (area 2 builds it, per the fixer orders). An action that was refused used to hand the
database's own message to a person — returned as its error, or written into `?error=` and printed by the page as is,
so a crafted link could also put any words under Setnayan's name. Now the raw words go to the log and the person reads
one plain sentence; pages print fixed words for a known key only.

- Host invitation (`/host/accept/[token]`): fixed sentence + Try again; no `msg` / `expected` read from the address (A2-A9).
- Profile and Groups (samahan) actions: plain sentences, fixed keys; pages fall back to a plain line (A2-C6).
  Lane R pages named by the finding (API keys, linked events) are left for retirement.
- Add a guest and Import: `dup_<role>` / `save_failed` / `plus_one_failed` keys; import says one plain sentence (A2-D7).
  Quick add is lane R and left.
- Sponsors: `sponsor-error-copy.ts` maps keys to words; unknown keys read as the fallback (A2-I18). Disputes: the same
  for the evidence upload (A2-S1, second pass).
- Group join (`/samahan/join/[token]`): fixed words + Try again (A4-14).
- Supplier claim finalize: plain sentence, and Try again instead of "Back to sign in" for a signed-in person (A5-G1-12).
- Papic moderation, photo delivery, guest columns, mood board: `hostRefusal` (new `lib/host-refusal.ts`) instead of
  `error.message` (A3·P-09, A3·S-07 — the raw-text parts only; their word fixes stay with area 3).

Guard: `lib/the-database-never-speaks-on-screen.test.ts` (mutation-checked against main: it catches every original).

SPEC IMPACT: None (plain failure words per CLAUDE.md §3 Toast row; no rule, price or flow changes).
