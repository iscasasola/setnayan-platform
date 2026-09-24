# P3 · The supplier surfaces that hand out an account number with the rail closed

> **Model: Fable · effort: high.**

## The defect

When the payment rail is switched off, a surface that still renders a payment
account number is telling a supplier to send money into a channel nobody is
watching. #5571 fixed the couple-facing half. The supplier dashboard still has
holes.

## Re-measured 2026-09-18 — the count is NOT the "4" the old register says

| file | honours the switch? |
|---|---|
| `vendor-dashboard/subscription/_components/booth-addon-card.tsx` | ✅ **already done — leave it** |
| `vendor-dashboard/booking-fees/[orderId]/page.tsx` | ❌ |
| `vendor-dashboard/shop/page.tsx` | ❌ |
| `vendor-dashboard/subscription/_components/ai-addon-card.tsx` | ❌ |
| `vendor-dashboard/subscription/_components/papic-challenge-card.tsx` | ❌ |
| `vendor-dashboard/subscription/custom/` | ❌ |

Reachability confirmed — the three components each have **exactly 1 importer**,
so none is dead code.

## 🔑 The command that is easy to skip, and the reason it exists

```bash
git grep -l "<ComponentName>" origin/main -- apps/web/app | grep -v "_components/"
git grep -li "payment.channel\|kill.switch" origin/main -- changelog.d
```

**An enumeration finds what exists, never what is reachable.** A previous sweep
correctly listed 10 payment surfaces and reached a **wrong verdict on 7** of them
— several were dead code, and for one, `changelog.d/` already recorded a written
decision to leave it alone. Re-run both commands before you touch a file.

## The shape to copy — do not invent one

`booth-addon-card.tsx` and `booth-addon-actions.ts` already do this correctly.
**Open them and reproduce their pattern.** Your PR shows the delta.

## The guard

Extend the existing M1-style guard rather than writing a new one, and make it
**count**: assert the number of surfaces that consult the switch, so adding a
sixth surface without the check goes red. A guard that merely asserts *some*
surface consults it passes while five do not.

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
