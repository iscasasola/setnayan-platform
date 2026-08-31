## 2026-08-31 · docs(build-sessions): the board stops lying about five merged sessions

The C-programme tracking board still listed C7, C2, C8, C11 and C5 as `ready` / `after C6` /
`needs VAPID check`. **All five had merged** — #5029, #5031, #5036, #5032, #5042. A sixth row
called C10 "needs follow-up" when C10b (#5021) had already done it.

Refreshed against `origin/main` @ `86efe2917`, and every ✅ carries the **code anchor the overseer
checked**, not the session's own report:

- C7 → `HOME_TITLE` is now `'…Plan any Filipino event free…'`, no longer wedding-only
- C2 → `app/vendor-dashboard/shop/venue-type-actions.ts` exists
- C5 → `app/[slug]/avatar/_components/avatar-maker.tsx` exists
- C8 → `Notification.requestPermission()` is on the **guest seat-claim path**, which was the point
- C11 → `comebackPricePhp` derives the midpoint; the NULL tier fails closed, tested
- C10b → `CLAUDE.md` line 51 strikes `0 ORDERS EVER` and states 6

**C1 is IN FLIGHT** (spawned today); its premise was re-verified the same day —
`git grep -l kinship-derive origin/main -- 'apps/web/**'` still returns only the module and its own
test. **C4 is the last session** and stays gated on C1: both rewrite the People area.

### Two prompt-file corrections found while doing it

- **`C1.md`'s header still read `Wave 4 · after P0-b`** — a gate that cleared when #5025 merged on
  2026-08-30. The GATES block *inside* the same file had been corrected; the header had not, so a
  reader who trusted the top of the file would have waited for a gate the middle of the file says
  is open. Header now states the clearance and its PR.
- **`C11.md` contradicted itself in the money-path section.** A leftover line read *"For every tier
  above that is 40 / 2 = 20 today"* directly beneath the paragraph explaining that the implied
  discounts are **40.02 · 40.03 · 40.04 · 40.20, not a clean 40**, in a prompt whose central
  instruction is *do not hard-code 20*. Line removed; the ❌ heading widened from `HARD-CODING 20`
  to `HARD-CODING 20, OR ANY PERCENTAGE, IN THE MONEY PATH`.

🔑 **A tracking board is the one document that cannot be checked by reading it.** It agrees with
itself no matter how wrong it is — five stale rows read exactly like five accurate ones. It must be
re-derived from `gh pr list --state merged`, never from its own last state. Noted in the board.

SPEC IMPACT: None — repo-local programme tracking, no product decision changes.
