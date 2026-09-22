## 2026-09-22 · chore(overview): delete `digest-sub`, an inert rule whose only possible use is harmful

`apps/web/lib/digest-sub.ts` exported `digestSubWorthShowing(sub)` — a predicate deciding whether a
digest row's grey second line on the couple's Event Overview earns its place (it survived only if it
carried a DATE or a REFERENCE code). It had a careful docblock recording two real traps fixed in it
(a bare month word is not a date; an `/i` flag on the reference regex once made ordinary prose
match), and `digest-sub.test.ts` held ~23 assertions across 7 cases.

**Nothing ever called it.** Measured on `origin/main`: `event-dashboard.tsx` imported it on one line
and invoked it zero times, while the panel rendered `{group.sub}` and `{item.sub}` unconditionally.
Re-measure the shape (the symbol is gone, so this is the recipe, not a live command):
`grep -rn "digestSubWorthShowing" apps/web --include="*.ts" --include="*.tsx"` returned the
definition, the test file, and a lone import — no call site — and
`git show "${REF}:apps/web/app/dashboard/[eventId]/_components/event-dashboard.tsx" | grep -c digestSubWorthShowing`
returned **1** on `origin/main`, so it predated every open branch.

🔑 **THE DECISION WAS NOT "IT IS UNUSED", IT WAS "RUNNING IT WOULD BREAK SOMETHING".** The predicate
was executed against every `sub:` the digest model can produce — 15 rendered values across 13 source
sites, the dynamic ones instantiated with real shapes rather than invented prose. **KEEP 2 · DROP 13.**

| verdict | sub | source |
|---|---|---|
| KEEP | `Order placed · ref A7K2QX` | order with a reference code |
| KEEP | `Due 12 Dec` | a dated decision detail |
| DROP | `We couldn’t check your guest list just now — refresh to see them.` | **the unreadable-sources row** |
| DROP | `Lock your reception venue` | **the Sai item's own instruction** |
| DROP | `Order placed · payment pending` · `21 categories still open` · `Saved options waiting on a lock` · `3 waiting` · `1 waiting` · `Key people your ceremony needs` · `In the order Sai would take them` · `About 1,200 more covers your guest list` · `Money waiting on you` · `Contract needs your signature` | the remaining nine |

**Two of the thirteen drops are harmful, which is what settles it.** The unreadable-sources `sub` is
the ONLY text naming *which* sources failed and what to do about it; its row's own docblock records
it as the S41b fix — *"🔑 A REFUSED SOURCE IS NOT 'NOTHING DUE' … Before, a refused payments read
simply dropped every payment falling due from a list that looked complete."* Wiring the predicate
would strip that explanation and leave a bare "Some dates couldn't load", **partially undoing a
shipped fix**. The Sai item subtitle is the instruction itself. So the module's stated premise —
*"everything else it used to repeat is still written in full on the decisions board directly below"*
— is false for at least those two.

**Deleting this is not deleting working code; it is deleting code that measurably must not be run.**
An inert module whose only possible use is harmful is a trap waiting for a future session to "finish
the wiring", and ~23 green assertions read exactly like coverage of a shipped behaviour. The
measurement is written out above on purpose, so the decision is reversible by READING rather than by
re-deriving it.

⚠ **THE SAME SHAPE IS NOT RARE.** Sweeping 4,061 non-test sources and 8,010 `lib/` exports found
**22** symbols imported by a non-test file and never used there — including three money-adjacent ones
(`VENDOR_AI_ADDON_FALLBACK_PHP` → `app/vendor-dashboard/subscription/ai-addon-actions.ts`, and
`MAX_ONBOARDING_DISCOUNT_PCT` / `DEFAULT_ONBOARDING_DISCOUNT_PCT` → `app/admin/pricing/actions.ts`).
Handed to the controller as a list; nothing acted on here.

🪤 **THE SWEEP'S FIRST TWO ANSWERS WERE BOTH WRONG, and the second cause is this repo's own
documented trap.** Version one counted raw text matches, so symbols appearing only in a COMMENT read
as unused imports. Version two still flagged `updateSession` in `middleware.ts` — obviously called —
because a hand-rolled comment stripper destroyed **78% of that file** (22,592 → 5,004 characters),
taking the call site with it. That is exactly what `lib/strip-comments.ts` exists to prevent; its own
docblock records a regex version once blanking 5,104 lines across 1,031 files. The final sweep uses
the repo stripper and **probes itself before reporting** — two positive controls the earlier versions
got wrong, one known-true negative (`digestSubWorthShowing` itself), and a check that the stripper
preserves file length — and withholds every finding if any probe fails. A detector that has not been
shown to find a planted case is not evidence.

SPEC IMPACT: None — the rule never ran, so no rendered behaviour changes. No locked decision, SKU or
price is touched.
