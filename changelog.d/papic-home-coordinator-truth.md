## 2026-07-30 · fix(papic): the home tile told coordinators "0 cameras out" on an event mid-shoot — an RLS silent-zero I shipped hours earlier

Self-audit of the PR-G work ([#3895](https://github.com/iscasasola/setnayan-platform/pull/3895) / [#3897](https://github.com/iscasasola/setnayan-platform/pull/3897)), prompted by the owner asking for a gaps + security pass. **This is my own defect, found and closed the same day.**

### The bug

All three Papic capture tables are **couple-only** in RLS — verified against prod, not inferred:

| policy | requires |
|---|---|
| `papic_photos_couple_full` | `event_members.member_type = 'couple'` |
| `papic_guest_captures_couple_read` | same |
| `paparazzi_seats_couple_full` | same |

But event-home renders for more than the couple: `events` carries `events_moderator_read` and `community_member_can_read_events` alongside `event_member_can_read`, so **coordinators and multi-host moderators reach this page**.

And the mechanism that makes it bite: **an RLS denial returns `count: 0` with no error.** From the count alone that is indistinguishable from "nothing has been shot".

So `resolvePapicHomeTile`, reading through the *viewer's* session client, resolved `photosGathered = 0` ⇒ `preCapture = true` for a coordinator — and event-home showed them:

- a tile reading **"N shots ready · 0 cameras out"** on a wedding with cameras out and thousands of photos in, and
- the **"your free camera is ready"** nudge, on an event that had been shooting for hours.

**Latent in prod today** (every `event_members` row is `couple` — verified), **live the moment one coordinator exists.** No data leaked: RLS did its job. The failure was the *display* trusting a zero it had no right to trust.

### The fix — remove the class, don't patch the symptom

The counts now read through the **service-role client** (so a zero means zero), and the caller passes **`isCoupleMember` explicitly**. A viewer who is not a couple member gets `null` — no tile, no nudge, no wrong number.

That is deliberately **conservative**: showing a coordinator nothing beats either lying to them or quietly widening couple-only capture data to them. **Extending Papic's home presence to coordinators is a real product question** — it needs an RLS extension or an owner ruling, and it is not something to slip in behind a display fix. Flagged for the owner rather than decided here.

Couple-membership is resolved **once** in `page.tsx` and threaded into `<EventDashboard>`, so the whole feature costs one indexed query rather than two. The component prop **defaults to `false`**: a caller that forgets to thread it renders no tile, never a wrong one.

### Guards, mutation-tested

Three new cases pin it in both directions — a non-couple viewer gets `null` even on a rich, busy event · the nudge never shows to one · and a source-scan asserting the prop defaults false and the read is gated on the flag with no session client.

**Probed, not assumed:** deleting `|| !isCoupleMember` from the resolver fails *"a NON-couple viewer gets null"* by name. Restored → 15/15.

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · `lint:entitlement-gates` OK · **`test:unit` 5,449/5,449 pass**. Prod RLS policies read directly (`pg_policies`) rather than assumed; `event_members.member_type` distinct values confirmed as `couple` only.

### The lesson, recorded

**An RLS-denied read and an empty read are the same value.** Any display that derives a *state* from a count — "nothing yet", "not started", "none left" — must first establish that the reader was actually permitted to see the rows, or it will confidently render the wrong state to whichever role the policy excludes. Same family as the shipped trap *"the frame mounting a surface is NOT authorisation for its queries"*, one layer over: **the count answering is not proof you were allowed to count.**

SPEC IMPACT: `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` §2-G amended + `DECISION_LOG.md`. No price, SKU, schema or flag change; no RLS change (deliberately).
