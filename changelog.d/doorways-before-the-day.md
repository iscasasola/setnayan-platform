## 2026-08-06 · fix(guest): the two guest doors were built on the one surface nobody can reach in time, and nothing ever said "we'll be streaming"

Follow-up to `finished-pages-need-doorways.md`, which said so itself in its own "known gap": the doors it built land on the **day-of hub**, and the only link to that hub appears once the wedding is **live or over**. The 3D room's card reads *"Look around the reception before you arrive"* — printed on a page you cannot open until you have arrived.

### What was actually true (all three claims verified against shipped code first)

**CONFIRMED — the doors are unreachable before the day.** `app/[slug]/hub/page.tsx` mounts both cards; the hub's inbound links (`PublicEventDayBar`'s hub chip, the nav's `watch` destination) are gated `dayOfPhase === 'live' || 'post'`. Nothing on the event page itself pointed at either destination.

**CONFIRMED — no "we'll be streaming" notice exists anywhere.** `loadLiveLayer` reads the watch URLs **only** when `dayOfPhase === 'live'`, and both render sites are live-gated. A relative overseas could not learn a livestream was planned until it had already started.

**CONFIRMED, and worse than reported — one destination *does* refuse a viewer the door admits.** `/[slug]/pabuya` runs `canViewSlugEvent` against the **raw** `events.landing_page_visibility` column. Both surfaces that draw its card decide what *they* render from `resolveEffectiveVisibility`, which additionally reports `'public'` the instant a **scheduled launch** falls due — before anything has written the column (the write is deferred to an `after()` task that is allowed to fail). In that window a stranger reads a fully public wedding page, taps "Send a blessing", and is `redirect()`ed straight back with no explanation.

**REFUTED — neither page is time-gated.** `/venue` asks only whether the floor plan is published (`public_venue_scene`: `published_at IS NOT NULL` + the `seating` surface — no date anywhere, confirmed in `20271113090000_venue_scene_any_event_type.sql`); `/pabuya` asks its flag, its `website` surface, its visibility and its enabled destinations. So the doors need **no phase**, and none was added — "it must be time-gated" was the assumption that would otherwise have shipped a rule with nothing behind it.

### The change

- **`app/[slug]/_components/guest-doorway-strip.tsx`** (new) — the two doors and the broadcast sentence, rendered from decisions made elsewhere.
- **`app/[slug]/_components/site-body.tsx`** — one mount, **outside both identity trees**. A relative arriving on a shared link has no cookie and renders through the anonymous tree; the invited cousin renders through the guest tree; all three items belong to both. Mounted **below** the invitation, not above it like `VendorDoorway`: that banner addresses someone who is not here for the invitation, and an invitation has to open with the invitation. Suppressed on the full-bleed Save-the-Date film.
- **`app/[slug]/_lib/site-nav.ts`** — `DoorwayInput` gains **`pabuyaViewerAllowed`** (required, so every call site must answer it), and new `showBroadcastNotice()` beside the slot rules.
- **`app/[slug]/_lib/loaders.ts`** — new `loadDoorwayFacts`; `loadLiveLayer` now also returns `broadcastPlanned`, one extra `events` read by primary key and **only outside the live window and before the day** (after it, the recap carries the replay).
- **`app/[slug]/page.tsx` · `app/[slug]/hub/page.tsx`** — both ask the money-gift page's **own** visibility question. Free on the ordinary path: when the raw and effective visibilities agree, the gate at the top of each surface has already proved the answer.

### Two rulings worth keeping

🔑 **The notice is NOT a link, and that is the same rule as the cards, landing the other way.** A YouTube or Facebook URL saved weeks ahead cannot be known to be open — a scheduled premiere shows a countdown, a link typed for a stream not yet created shows "video unavailable", and nothing here can tell them apart (the Google account that could answer is suspended, appeal `73857927`). So the notice promises only what it can keep: *the player appears on the page you already have open.*

🪤 **`dayOfPhase` cannot tell "before" from "after".** `inactive` is **everything** outside the day-of window — the months before the wedding *and* the Thursday after it — and `post` expires ~2.5 days out. Gated on the phase alone the notice **comes back the following week**, telling that wedding's guests it "will be streamed live" on a date that has passed. Caught before commit; the second input is the calendar. This is the third time this trap has been hit on this route in a week (see `navPhaseFor`'s note).

### Tests

`apps/web/lib/doorways-before-the-day.test.ts` — 32 tests in three parts (decision · wiring · no-door-to-nowhere). **21 mutations were applied to the shipped code and every one was caught**, including the vacuity check the last pass was missing: the "notice has no outbound link" scan is proved able to see a planted one, and it strips comments first so it cannot grade its own prose.

`pnpm test:unit` → **6876 pass / 0 fail** · `tsc --noEmit` clean · `next lint` clean on every touched file.

### Scope note

`apps/web/lib/finished-pages-need-doorways.test.ts` gains **one line** — `pabuyaViewerAllowed: true` in its fixture — because the new field is deliberately required rather than defaulting. A field that defaults to "allowed" is a gate that fails open, which is the class of bug this PR is fixing.

SPEC IMPACT: None. No pricing, SKU, schema or locked-decision change — this adds inbound links to two already-shipped guest pages and one sentence about a broadcast the couple already staged. The money-gift page remains dark behind `PABUYA_PUBLIC_ROUTE_ENABLED`; nothing here flips it.
