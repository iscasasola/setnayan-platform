# P7 · The small ones — do these when a bigger item is blocked

> **Model: Fable · effort: high.** Four independent items. **One PR each**, not
> one PR for all four.

## 7a · Guest song request (SUP-52) — the highest value of the four

**0** song-request references under `app/[slug]` or `app/papic`:
```bash
git grep -lic "song.request\|songRequest" origin/main -- 'apps/web/app/[slug]' 'apps/web/app/papic'
```
🔑 **The band's inbox is built. The July DB half is built. Every stage exists
except the join.** This is a connector, not a feature — find both ends before you
write anything, and say where they are.

⚠ Beware a **name collision**: this project already has two `RequestsInbox`
components over different tables, and an answers-desk that belongs to suppliers.
**Check the shape, not the name.**

## 7b · DAY-14 dead branch

The "broadcast day has ended" fork renders in **0 of 12** measured combinations.
One file: `apps/web/app/panood/control/[eventId]/page.tsx`.

Tidy-up, not a defect. ⚠ Before deleting, check `git log --diff-filter=D` and
`changelog.d/` — **Live Studio's broadcast-day model was already deleted
deliberately (LS6)**, so confirm this is the leftover and not something live.

## 7c · LR-21 comment nit

Five error boundaries name `instrumentation.ts` as the Sentry path; for the
**browser** it is `app/_components/deferred-observability.tsx`. The five:
```
app/[slug]/error.tsx · app/error.tsx · app/vendor-dashboard/error.tsx
app/providers.tsx · app/_components/deferred-observability.tsx
```
Comment-only. 🔑 **A code comment is not a measurement** — read each file's body
and fix the comment to what the code does, rather than pasting one correction
five times.

## 7d · The FIXTURE shop is counted as a real supplier

The one published shop is **"Saysay Live Band & Hosting (FIXTURE)"** and its
`is_demo` flag is **FALSE**, so nothing filters it out of any "verified
suppliers" count.

⚠ **This is a production data change, not a code change.** Confirm with the owner
before flipping it — the end-to-end booking run (P2) is running against this
exact supplier, and `is_demo = true` may remove it from surfaces that run needs.
**Ask first.**

---

## The rules every one of these prompts inherits

- Read `04_TRAPS.md` before running anything.
- **Never read code from `/Users/icecasasola`** or the primary checkout — both are
  hundreds of commits behind. `git worktree add --detach /tmp/wt-<name> origin/main`.
- **RULE 0** — paste the four searches into your first reply before building.
- **Auto-merge immediately**: `gh pr merge <N> --auto --merge`. Never ask.
- Add a `changelog.d/<branch-slug>.md` fragment with a `SPEC IMPACT:` line.
- **Never weaken a guard to go green** — fix its window, keep its assertion.
- **Probe your runner with a deliberate failure first.** Print the numbers.
- Prune the worktree when the PR merges.
- Test as `testnayan1`, **email + password, never the Google button.**
