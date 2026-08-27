## 2026-08-27 · fix(security): the third host clone, the keepsake's hardcoded `true`, and the arm the funeral fix never reached

Four defects found by an adversarial pass over PRs #4890 and #4891 — the two that
had just fixed the *first* two copies of the same shape. All three of the
reported ones were verified by hand against `origin/main` and against production
before anything was changed.

**1 · A THIRD COPY OF THE HOST CHECK, HOLDING THE PRE-FIX RULE.**
`app/[slug]/hub/page.tsx` carried its own inline `event_members … select('member_type')`
read and answered `Boolean(memberRow)` — the column asked for, never compared.
`event_members` is the event's PEOPLE table and `'guest'` is one of its types
(the QR scan-to-join writes one), so any signed-in guest read as a HOST, which is
what `?phase=` keys on: they could force `dayOfPhase` to `live`/`post` and switch
on day-of surfaces the couple had not launched — the live-stream embed, the
mirrored photo wall, the recap door — on a PRIVATE celebration. It now asks the
one shared `isSignedInEventHost`, whose docblock names exactly this
"hosts may preview" rule as its reason for existing. **A clone inherits the bug
its twin fixed — third instance.**

**2 · THE PRINT KEEPSAKE HANDED A RESTRICTED STORY TO A STRANGER.**
`app/[slug]/print/page.tsx` passed `belongsToEvent: true` as a literal, and
`storyAudienceAdmits` answers a story kept to *the people of this celebration*
with exactly that boolean. On a PUBLIC or UNLISTED event an anonymous visitor
could print, in full, the story the couple had restricted — the same words the
page beside it correctly refused them. The docblock justifying the literal was
FALSE: it claimed `canViewSlugEvent` "admits the event's own people", but that
gate opens with `if (openToStrangers(visibility)) return true` (public||unlisted),
which admits strangers outright and establishes nothing about membership;
`robots: noindex` is not access control. It is derived now, fails closed, and
runs through the same rule the on-screen story uses
(`app/[slug]/_lib/belongs-to-this-event.ts`) so the two cannot drift.

**3 · THE FUNERAL FIX WAS INERT FOR EVERY SIGNED-OUT VISITOR.**
`resolveProfileByEvent` / `resolveRoleSetKeyForEvent` read `public.events`
through the COOKIE-SCOPED session client. Measured in production: all three
SELECT policies on that table are `roles={authenticated}`, so policies admitting
`anon` = **ZERO**. A signed-out read came back empty and both resolvers fell
through to WEDDING_PROFILE — on the four signed-out-reachable surfaces (the join
door, the face-data notice, the post-event story, the guest column card) plus the
join door's two server actions. So the mourner who scanned a wake's QR was told
about "the couple" and offered "Maid of honor", "Ring bearer" and "Veil sponsor":
the register PR #4793 exists to protect, arriving wrong through the one arm
nobody reviewing it was signed in to. Both now read the event's own type with the
service-role client — **a deliberate widening, stated rather than slipped in**:
what crosses is three columns describing what KIND of celebration this is, turned
into a noun and a list of role names, which the event's own public page already
renders to anonymous visitors. For the ~13 signed-in dashboard callers the answer
is unchanged. One read now serves both resolvers instead of two.
⚠ The column grant was never the blocker —
`has_column_privilege('anon','public.events','event_type','SELECT')` is already
TRUE; RLS refused the row. "Add the grant" is the obvious wrong fix.

**4 · THE GUARD THAT WAS MEANT TO PREVENT #1 COULD NOT.**
`host-means-host.test.ts` pinned a HAND-TYPED list of three paths, while
`slug-access.ts` asserted it "pins BOTH by source so a third copy cannot quietly
hold a laxer rule". It could not, and that sentence is corrected. The guard now
DERIVES its file set from the app + lib trees, failing on any `event_members`
read that asks for `member_type` and never compares it — with FLOORS, so a sweep
gone blind fails instead of reading as a pass. A new class guard
(`signed-out-words-are-the-events-own.test.ts`) pins the mechanism behind #3
rather than its call sites, also floored.

**AND THE DERIVED SWEEP FOUND SIX MORE INSTANCES OF THE SHAPE** (it was written
to catch one). A fourth real clone in the save-the-date view beacon
(`app/api/std/view/route.ts`) suppressed the count for ANY member while its own
comment named couple/coordinator — so a guest's view was silently deleted from
the couple's number; fixed. Five were benign existence checks that merely
over-selected the column (`patiktok/upload`, `checklist`, `schedule`,
`wizard-actions`, `join/success`) — each now asks for a column it has an opinion
about. `wizard-actions` said "Not a host of this event" while admitting any
member: the WORDS are corrected, the behaviour deliberately is not, because
narrowing an authorization gate the dashboard layout already opens is a product
call and not a typo fix. Named, not changed.

Prod at the time of the fix: 5 events (2 open) · 6 event_members rows, **all**
host-type · 2 non-wedding events. So #1 and #4's clone are latent today and one
QR scan from real; #3 bites on two live celebrations right now.

SPEC IMPACT: None. No schema, no migration, no price, no owner-locked decision
moves. `DECISION_LOG.md` is untouched — this repairs three shipped defects and
one decorative guard.
