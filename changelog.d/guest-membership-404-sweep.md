## 2026-08-13 · fix(navigation): four more doors that opened onto a 404 for an invited person

`app/dashboard/[eventId]/layout.tsx` admits `member_type = 'couple'` only (plus
an accepted, non-removed `event_moderators` row). Any link that sends a
`member_type='guest'` membership into a `/dashboard/[eventId]/…` path is a 404
shown to somebody who was just told they belong — it reads as the host shutting
them out, not as a bug.

PR #4415 closed three such doors on the events board and put the answer in
`lib/event-board.ts` so the next surface would inherit it. It did not. An
adversarial pass on 2026-08-13 found four more, on four different surfaces, each
re-deriving "where may this person go" locally and getting it wrong the same
way. All four are fixed here, against the same helper.

⚠ **Nobody is hurt by this today.** Prod holds 5 `event_members` rows and every
one is `'couple'` — zero guest memberships exist, so none of these four has ever
fired. They are all on the path the FIRST real invited guest takes.

**1 · Library › Photos — a guest saw her own thumbnails and pressed them into a
404.** `AlbumCard` built ONE destination for both roles — the host's Papic
studio — and rendered it twice (the thumbnail strip and the "View & download"
button), on a card that two lines above computes `hosting` and prints an
"Attended" chip. An attended album now opens the event's own public address,
where her tagged photos already live.

**2 · Alaala story assignments — the bell went nowhere.** `dispatchNudgeEmail`
sends the same request twice. The EMAIL is correct and its own comment states
the rule. The in-app twin — delivered to the account resolved BY `guest_id`, so
by construction an invited person, never the couple — set
`relatedUrl: /dashboard/${eventId}/alaala`, which the notification list renders
as an "Open" button. The bride's aunt asked for the first-dance story tapped
Open, got not-found, and nothing told her the email held a link that worked. The
in-app twin now points where the email points.

**3 · Samahan › Events — the row grew an arrow that meant "you can open this".**
`fetchViewerEventIds` selected `event_members` with NO `member_type` filter, so
every membership counted and an invited row rendered as a `<Link>` into the
organiser shell, with a hover arrow. Ironically the row for an event the viewer
is NOT on said the honest thing. Replaced by `fetchViewerEventMemberships`,
which carries the `member_type` the caller always needed.
🔑 **RLS IS A FLOOR, NOT A SCOPE** — the read really was scoped to the viewer;
"is a member" was simply never the question.

**4 · Library › Editorials — the fallback WAS the 404.** `primaryHref` was
`item.relation === 'owned' ? editorHref : publicHref ?? editorHref`, so an
ATTENDED card on an event with no slug fell back to the organiser-only editorial
editor. Repeated on the "View editorial" button. A card with nowhere to go now
renders no link at all — the same call `eventBoardHref` makes when it returns
null rather than building `/null`.

### Two things the brief got wrong, corrected before building

- It said to reuse `lib/guest-membership-session.findGuestSeatForUser` from
  PR #4416. **#4416 is still OPEN and BLOCKED** — that helper does not exist on
  `origin/main`. Nothing here depends on it; the shared answer is `eventStance`
  in `lib/event-board.ts`.
- It cited a `closedReason` precedent in `lib/event-board.ts`. **No such symbol
  existed.** The idea did (that module returns null rather than a broken path),
  so `stanceClosedReason` is added here and the concept now has a name.

### New in `lib/event-board.ts`

- `eventAlbumHref` — the same stance question for a card that opens an ALBUM.
- `stanceClosedReason` — what to SAY when there is no href. An invited person
  must not read "Ask an organizer to add you to this event": she already was.
  Different state, different sentence.

🪤 **`Album.slug` IS NOT A NAVIGATION VALUE** and reusing it would have been a
silent regression. It is gated on EFFECTIVELY-PUBLIC because it anchors a
broadcast Facebook link; an invited person opening her own album on an
*unlisted* wedding may go there perfectly well. The data layer now carries both
— `slug` for the share card, `href` for the person. Two questions, two values.

### Guards — `lib/guest-doors-are-not-dashboards.test.ts` (14 tests)

Two layers, because testing the primitive is not testing the caller: the
predicate was already correct and shipped on 2026-08-13 while all four of these
surfaces ignored it. Each caller is asserted at SOURCE, sliced to the exact
function that owns the decision, so a failure names the component that
regressed.

**9 sabotages, every one measured by occurrence count before → after, every one
confirmed RED.** Three of them found real holes that reading had not:

- 🪤 **The slicer was itself decorative on its first run.** It took the first
  `{` after the function name as the body — but three of these four call sites
  are components taking a destructured prop (`function AlbumCard({ album }…)`),
  so brace-matching returned `{ album }`. Every "must NOT contain `/dashboard/`"
  assertion passed against a twelve-character string. Fixed by paren-matching
  the parameter list first, plus `assertUsable`, which refuses a slice too small
  to be a body — a guard that cannot see its subject must fail loudly.
- 🪤 **Then the comment-stripper ate code.** Keyed on "not preceded by `:`" to
  protect `https://`, it swallowed the literal `` `/dashboard//studio/papic` ``
  from `//studio` onward, leaving `/dashboard` — so the guard went green against
  sabotaged code. Now keyed on start-of-line-or-whitespace.
- 🪤 **Two second instances were unguarded.** The "View editorial" button
  (mutating its gate to `true ?` restored the broken link, suite green) and the
  samahan closed-reason copy (hardcoding the old sentence fixed the LINK and
  left the COPY telling an invited person to get herself added). Both now have
  their own assertions. **The card carries its destination twice — one gate per
  rendering site, or the second one is the defect.**

🔑 **A guard can match a string rather than the act**: two assertions went red
against CORRECT code because the fix's own comment quoted the defect it removed.
Comments are prose; every assertion runs against the stripped body.

### The port-controls baseline moves by exactly one line — deliberately

`lint port keeps every control` failed on the samahan route: *"can no longer
reach `/dashboard/[seg]`"*. **The claim is true and the escape hatch was checked
before it was taken**, because regenerating a baseline is deciding that a
removal is fine.

It is fine here, and NOT because the organiser lost anything: `eventBoardHref`
still returns `/dashboard/${event_id}` for a `couple` membership. The literal
simply MOVED from the page into the helper, so a static per-route scan no longer
sees it on that route. What actually changed is that the link became conditional
on `member_type` instead of unconditional — which is the entire fix.

Baseline regenerated in this same PR: 793 → 792 destinations, one readable
deleted line. That is the guard working as designed, not being silenced.

### Named, not built

- **Accepted moderators are absent from the samahan memberships map.** Prod
  holds 3 `event_moderators` rows and the dashboard admits them, but they carry
  no `event_members` row — so they were already missing from the old Set and are
  missing from the new Map. Pre-existing wrong-but-safe (they read "ask an
  organizer" instead of getting a link), NOT a regression introduced here.
  Widening that read to a second table is a separate change.
- Site 4's null-slug attended card is reachable **by construction** (the gate
  admits `visibility != private` without requiring a slug) but has **no row in
  prod today** — the one slug-NULL event is private. Fixed on principle.

Verified: `tsc --noEmit` exit 0 · 14/14 guards green · prod read directly for
every claim above (`event_members` by type, `events` slug/visibility,
`event_moderators` count, and the column-level SELECT grants on `events.slug`
and `event_members.member_type` before naming either in a query — an ungranted
column rejects the whole query rather than throwing).

SPEC IMPACT: None. No schema, price, SKU or owner-locked decision changes. The
`member_type` → destination rule is unchanged; four surfaces now obey it.
