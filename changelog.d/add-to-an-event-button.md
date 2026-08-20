## 2026-08-21 · feat(marketing): "Add to an event" on every service page

Owner ruling, 2026-08-21, over four messages: the service page is **identical**
signed out and signed in except for one button — *"each service when opened will
have a button to add to event"* — which *"will let them pick which event this
will be added to"*, showing *"only ... events that is compatible to this"* and
*"the ongoing and upcoming only"*, plus *"allow them to also create an event"*.
Shape chosen by the owner from three prototypes: **dialog**.

**It is a SWAP, not an addition.** The kit branches on `studioKey` in exactly one
place, around the primary CTA, and renders the page's own link on the other side
— so a signed-out page is unchanged. Heading, lede, price anchor, secondary CTA
and every section below are untouched in both states.

🔑 **NOTHING IS WRITTEN.** The button resolves to `addOnHref` — the door the
product already uses to open a service inside an event. No order, no charge, no
mutation. That is why it can ship without a payment path behind it.

**Filtering runs on the server**, in `add-to-event-data.ts`, because
`events-for-studio-app` reaches `surfaceEnabled` → `event-type-profile` →
the Supabase server client. Importing that from a `'use client'` component would
put the server client in the browser bundle. It also means a stranger's browser
never receives the names of somebody's celebrations. One profile read per
DISTINCT event type, not per event.

**The create row goes exactly where "start planning" already goes.** One route
into creating a celebration from this page, not two that drift — and it means we
make no claim about which KINDS a service works with, a claim that would need a
read of every event-type profile to stay true and would rot the first time an
admin changed one.

🔴 **`min-height:0` ON EVERY ANCESTOR OF THE SCROLL AREA IS LOAD-BEARING**, and
the owner caught this in the prototype: *"the create event is gone."* A flex item
defaults to `min-height:auto` and refuses to shrink below its content, so with a
long list the panel grew past its own `max-height` and the pinned create row was
clipped off. **It was in the DOM the whole time — which is exactly why checking
the DOM did not catch it.** Measured in a real viewport: with `min-height:auto`
the row's bottom edge lands 558px below the panel and fails a hit test; with the
fix it is inside and the topmost element at its own centre.

**At scale:** soonest first and undated last (server-side), a search past six
rows, a scrolling list, and the create row pinned outside the scroll.

🛡 `add-to-event-is-the-only-difference.test.ts` — 5 assertions, **executed and
mutation-proved outside the toolchain** (no `node_modules` here): 8 checks green;
a second signed-in branch, a create row with its own route, and a page that
forgets its key each turn a check red; restoring returns all eight to green. It
strips comments first, because the comments quote the strings under test.

⚠ Source-level: it proves the kit has ONE auth-shaped branch. It cannot prove
what a browser paints.

⏭ `/patiktok` is wired with the rest — it is still an active, sellable SKU. If
it turns out not to work, the fix is deactivating the SKU, not hiding one button.

Not verified locally: no `node_modules` in this checkout and `npm run build`
cannot complete on this machine. Typecheck, lint and the unit run are CI's.

SPEC IMPACT: recorded in the corpus `DECISION_LOG.md` (2026-08-21).
