## 2026-08-21 · change(ui): a page starts at its content — the back arrow and the big page name are gone

**Owner, pointing at the Alaala page's back chevron and its 36px title:** *"i still see this
across most of pages"* — and, asked which part, choosing to remove the back arrow and the big
page name **entirely, so each page starts straight at its content.**

This is the third rung of the same complaint. 2026-07-21 deleted the eyebrow. 2026-08-18 deleted
the lede paragraph (behind an (i)) and then deleted 78 of the 132 ledes outright. This one deletes
what was left of the row.

**What changed, in one place.** `app/_components/page-masthead.tsx` is the single render site for
every dashboard, vendor-dashboard and admin page header — 137 call sites in 133 files. It now:

- renders the `<h1>` as `sr-only` — in the document for screen readers, skip links,
  `aria-labelledby` and heading order, and worth **zero pixels**;
- renders **no back chevron at all**. The `back` / `backLabel` props are deleted, along with the
  29 call sites that passed them;
- renders **nothing else** when a page passes neither `lede` nor `actions` — no box, no margin.
  That is 64 of the 137;
- keeps `actions` (25 old headers hold the ONLY doorway to another surface) and keeps the (i)
  where a page still carries a sentence you need in order to use the page (55 of them). Those 73
  pages get one compact strip instead of a 36–44px header.

**Three stragglers ported to the shared masthead** rather than left hand-rolling the retired
stack: the wedding playlist (eyebrow chip + 36px title + paragraph), and both discount-code admin
pages (title + paragraph).

**WHAT IT COSTS, MEASURED — 16 routes lose their only on-page way UP one level.**
`lint-port-no-lost-controls` named them and the baseline was regenerated in this PR so each
removal reads as one line of diff: 6 account spokes and 2 event pages that pointed at
`/dashboard` or the event home (both of which the shared top bar and rail still reach), 4 website
sub-pages → the website hub, `samahan/new` → Samahan, `/admin/studio` → `/admin` + `/admin/pricing`,
`demo-vendors/inquiries` → demo-vendors, and 2 vendor-dashboard spokes. Set-compared before and
after: exactly those 16, **0 actions lost, nothing unrelated absorbed**.

⚠ Below 1024px there is no rail, this product has no breadcrumb anywhere, and the installed PWA
has no browser back button. The h1 and the chevron were the two things answering *where am I* and
*how do I get out* on a phone. Putting a small arrow back on just those 16 deeper pages is one
prop if the owner wants it.

🛡 `page-masthead.test.ts` was **inverted, not deleted** — its old test was literally called *"the
title is never invisible"*. A future session cannot restore the title and call it a fix. Four new
assertions, each mutation-checked with the occurrence count printed before → after (sr-only 1→0,
back-nav tokens 0→1, early return 1→0, `sm:ml-auto` 1→0), every one RED.

Verified: typecheck clean · 9134 unit tests pass · masthead, port-controls, bottom-nav, nav-icon,
radius, contrast and legibility lints green. **Not seen on a screen in-session** — these are all
pages behind a login, and the production build cannot run on this machine.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-21 (supersedes the 2026-08-18 one-row header lock).
