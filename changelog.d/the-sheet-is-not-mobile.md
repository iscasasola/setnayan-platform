## 2026-09-06 · docs(guests): the quick-view sheet is not reachable on a phone

`guest-drawer.tsx` called itself "the mobile / below-xl QUICK-VIEW guest SHEET"
from the day it shipped, and `guest-detail-body.tsx` repeated it. It is not
reachable on a phone. The only thing that opens it is `QuickViewButton`, and the
only place that renders is `DesktopRow` — which lives inside the roster's
`hidden … sm:block` table. Below 640px that table is `display:none`, so a phone
has ZERO triggers and a row tap goes straight to `/guests/[guestId]`.

Measured on the shipped page: **0 visible triggers at 375px, 4 at 768px.**

**Why a comment was worth a test.** On 2026-09-06 a session added a destructive
control to this sheet, then reasoned about it as a PHONE hazard — "a panel a
host opens casually while scanning a roster" — and reported that severity to the
owner. The severity was overstated, and the source of the error was the file's
own name for itself. Nothing in the type system, the tests or CI disagreed,
because none of them read prose. `CLAUDE.md` already documents this exact
failure mode: a false belief that spread through six migration headers, under
the rule "do not treat a comment as evidence."

So the new guard does NOT pin the prose as its primary claim — it pins the
MOUNT. If anybody makes the quick view reachable on a phone, the tests go red
and the docblock must be revisited in the same commit, which is the only
mechanism that keeps a comment honest over time. One assertion does cover the
prose (that the reach note and its measurement survive), deliberately reading
the RAW file, since a stripped one cannot see a comment at all.

Three files touched, comments only — no runtime change:
`guest-drawer.tsx` (docblock + section header), `guest-detail-body.tsx` (the
repeated claim), and the new
`apps/web/app/dashboard/[eventId]/guests/_components/the-quick-view-is-not-on-phones.test.ts`
(4 tests; three mutations measured RED — a second mount → 2 failing, the table
losing `sm:block` → 1, the reach note deleted → 1).

Suite 60/60 · route-scoped `tsc` exit 0 (ordered after the last edit,
sentinel-confirmed) · `lint-one-comment-stripper` and
`lint-no-engineering-notes-in-ui` clean.

SPEC IMPACT: None. Comments and a test; no behaviour changes.
