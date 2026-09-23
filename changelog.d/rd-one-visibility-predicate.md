## 2026-09-23 · fix(visibility): one predicate for "is this shop publicly findable"

**A shop set to `hidden` kept a clickable credit on Real Stories.** That is not a
risk of anything being built — it is shipped today. `lib/showcase-db.ts` reads
the credited suppliers through the **admin client**, which sees every row
regardless of RLS, and it asked about `verification_state` but **never about
`public_visibility`**. So a shop that asked to be hidden was gone from search,
gone from its own page, and still advertised from a story, with nothing saying
so.

**Three surfaces now ask the one predicate** (`@/lib/vendor-visibility`), which
already existed — the problem was never a missing rule:

| surface | was | now |
|---|---|---|
| `lib/showcase-db.ts` (story + journal credits) | **no filter at all** | `PUBLIC_SURFACE_VISIBILITIES` |
| `app/sitemap-vendors.xml/route.ts` | `.eq(…, 'verified')` hand-spelled | asks |
| `app/(shell)/explore/compare/page.tsx` | `.in(…, ['verified'])` hand-spelled | asks |

The two hand-spelled ones gave the **right answer today**, which is exactly why
neither could ever fail and exactly why they were worth fixing now: the owner has
asked for a second condition (a supplier owing a settled booking fee disappears
from every public find-me surface), and on that day each would have kept
answering the old question silently.

**The guard** — `lib/every-public-surface-asks-one-predicate.test.ts` runs the
pure rule in `lib/visibility-caller-rule.ts` over the tree and fails when a NEW
caller filters on the column without importing the predicate. It asserts a
property (*does the decision come from the one module?*), never a phrasing: a ban
on the literal `'verified'` would miss `.in(…, SOME_CONST)` and convict prose.

🔴 **The survey found 16 self-spelling callers, not 2.** They are listed in
`lib/visibility-callers.baseline.txt`, which says plainly that they have **not**
been reviewed one by one — several are certainly correct to ask their own
question (admin lists hidden shops; the fraud runner and the Ugat map count every
row). The guard's job is to stop the list growing, not to bless it. Classifying
the 16 belongs with whoever builds the fee penalty, because that is when a wrong
answer starts costing a supplier their listing.

Also removed two rotted line-number citations in a `compare/page.tsx` comment
("line 184" pointed at a filter that had moved to 195).

**Measured, not asserted.** Four sabotages each went red: showcase stops asking
(1 of 5), a new hand-spelled caller appears (1), the baseline is emptied so the
guard checks nothing (2), and the baseline names a file that already asks (1).

SPEC IMPACT: None. This restores an invariant the codebase already intended; the
fee-visibility penalty it clears the way for is a separate, unbuilt decision
recorded in `DECISION_LOG.md`.
