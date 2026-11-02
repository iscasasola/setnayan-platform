## 2026-07-30 · fix(papic): retire the PAPIC_SEATS gates — two surfaces could never light up, and the copy promised five seats

`Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` **PR-D**. Four surfaces gated on `PAPIC_SEATS` — `is_active = false` in prod, **zero orders ever placed**, and retired outright by the 2026-07-29 two-type lock. A gate on a SKU nobody can buy never opens.

**Three of the four fixed; the fourth deliberately NOT widened — see the biometrics section.**

### The day-of launcher — [`launch/page.tsx`](apps/web/app/dashboard/[eventId]/launch/page.tsx)

On the one page that exists to say *"start this now, it's your wedding day"*, Papic sat permanently on the upsell branch for **every** couple — including couples whose event already holds a free shot pool and a free camera. Now gated on `eventPapicActive()`, the canonical "is Papic going for this event" predicate (any live `paparazzi_seats` row **or** an active Papic-inclusive SKU). Reused, not reinvented — and it reads true from real rows rather than a hardcoded `true`, because both free allowances arm at event creation (`ensureFreePapicPoolGrantAdmin` + `ensureFreePapicOneCameraAdmin`) and the free camera *is* a seat row.

The copy was the retired pass talking, and it stated a count the app cannot honour:

- *"Your photo crew is ready — share these **5 seat links**…"* → *"Your cameras are ready — hand them out and the day gets caught from every angle."*
- *"Hand **shooter seats** to friends…"* → *"Hand a camera to anyone you trust…"*
- CTA *"**Share the 5 links**"* → *"Hand out cameras"*

Papic One has **no seat cap** and Pool cameras are unlimited by construction (any phone that scans the event QR shoots from the shared pool), so no number belongs in this copy at all.

### The galleries hub — [`galleries/page.tsx`](apps/web/app/dashboard/[eventId]/galleries/page.tsx)

Worse than a missing upsell: photos **already in** `papic_photos` / `papic_guest_captures`, shot from the free pool or a free camera, had **no card on the couple's own gallery hub**. Real captured media was unreachable from the surface built to reach it. Same `eventPapicActive()` swap — the card now renders for every event, `collecting` until the first shot lands and then `ready` with the live count. Empty-state copy moved off crew/seat framing: *"We're gathering the photos your crew and guests captured"* → *"As your guests and cameras shoot, every photo gathers here."*

### The crew page the new CTA lands on — [`studio/papic/crew/page.tsx`](apps/web/app/dashboard/[eventId]/studio/papic/crew/page.tsx)

Fixing the doorway while its destination still said *"Your **five** seats are ready"* would have been half a fix. The count now derives from the roster already fetched (`seats.length`, singular-aware), and the vocabulary drops "seat": *"Share a **seat link**"* → *"Share a link"*, *"N of M **seats** claimed"* → *"cameras claimed"*, *"**Seat** reissued"* → *"Camera reissued"*.

### ⚠ The face-enroll gate — dead operand REMOVED, but deliberately NOT widened

`[slug]/_lib/loaders.ts` and `[slug]/hub/page.tsx` both read `papicGuestActive || eventOwnsPapicSeats(...)`. The second operand can never be true, so every guest page-load was buying an extra `orders` read for a guaranteed `false` — on a **public** route. Removed (behaviour-identical, one less round-trip per guest hit), along with the now-unused import in both files.

**The spec asked for more than that: make it always-on like its three siblings. I did not do that, and this is the reasoning.** This prompt asks a guest for a **selfie** — biometric data, RA 10173 § 13(b) sensitive personal information. Three facts make widening the wrong default *today*:

1. **Auto face-matching is DORMANT** — no hosted model. An enrollment delivers the guest nothing right now; QR-scan tagging carries the load. (The spec's own §3-5 states this.)
2. **The live `/privacy` page still denies processing biometrics** — a known contradiction already on the register.
3. **Verdict gates 0d/0e are `[PENDING DPO]` since 2026-07-20** — the guest-media ROPA row, and DPO sign-off that the RSVP consent text names guest-phone capture **and face-sorted delivery**. That second one is *precisely* this prompt.

The owner's standing posture is *document-not-block* with a **disclose-then-enable** guardrail. Here the disclosure is knowingly wrong, so the guardrail argues against collecting more biometrics from more people for a feature that does nothing yet. Widening is one line the day 0d/0e close (spec §5 item 11); both files carry a twin comment saying exactly that, so the next session doesn't have to re-derive it.

**Left in place deliberately (authorization, not display):** `papic/actions.ts:280` and `api/upload/route.ts:297` both call `eventOwnsPapicSeats` to authorize a *seat upload*. Those are charge/authorization paths for legacy seat rows, not doorways — widening them would be a security change wearing a copy change's clothes.

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,428/5,428 pass**. Prod reads confirming the premise: `PAPIC_SEATS` `is_active = false`, zero `PAPIC_*` orders ever, and both prod events carry live `paparazzi_seats` rows plus a `free_grant:50` + `camera_grant:5`. No local `npm run build` (7 GB heap → SIGTERM 143).

SPEC IMPACT: Applied to the corpus — `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` §2-D closed with the face-enroll carve-out recorded against §5 item 11, and `DECISION_LOG.md`. No price, SKU or schema change.
