## 2026-08-11 · fix(live-wall): the couple can finally say where their photo wall shows

**The ₱2,500 SKU is called "Live VENUE Photo Wall". It also ran on every invited
guest's phone, and there was no way to stop that.** During the celebration the
same screened feed the venue projector shows was mirrored onto the wedding page,
the guest hub and a JSON freshness feed that re-serves 24 tiles every 25 seconds.
A couple who revoked every venue screen code — the only "off" the product
offered them — would reasonably believe the wall was off. It was still in a
hundred hands.

**The setting to stop it had existed since 2026-11-04 and was never connected.**
`events.live_photo_wall_visibility` (migration `20261104000959`) had **zero
readers, zero writers**, and no database consumer beyond its own CHECK
constraint and the `events_host` projection. All five production events sat on
the untouched default. This is the **third "gate with no handle"** in this
project: a column that nothing writes, or nothing reads, silently disabling a
shipped feature.

### The gate is now one function, not three call sites

Three separate guest surfaces each asked `eventSkuActive(…, 'LIVE_WALL')` and
nothing else. Checking the column in three places is three chances to forget,
and the next guest surface makes four — so ownership and the couple's choice are
**fused into one call**, `guestWallMirrorActive()`, and the permissive half of
the question is no longer reachable on its own from a guest surface:

- `app/[slug]/_lib/loaders.ts` — the wedding page (identified + anonymous trees)
- `app/[slug]/hub/page.tsx` — the guest hub
- `app/[slug]/live-wall/route.ts` — the 25s freshness feed

That last one matters more than it looks: hiding the block while leaving the
route open would keep the wall one URL away from anyone holding the couple's
slug, and the block would repopulate itself. **Turning the mirror off closes the
data, not the component.**

**The venue projection is deliberately untouched.** `/wall/[eventId]` and
`/api/wall/[eventId]/feed` keep calling `eventSkuActive` directly — the venue
screen projects regardless (owner-locked 2026-06-11) behind its own single-use
screen code. A test asserts the boundary in both directions, so neither half can
drift into the other.

### The couple's side

- A **couple-only** switch on the wall card (a coordinator may run the day; only
  the couple decides whether their whole wedding is mirrored onto personal
  phones — same rule as `setPoolGalleryOpen`, not `saveWallConfig`).
- The card **says the phone mirror exists**, on the card that controls it. The
  one honest sentence about it previously lived on the website privacy page, a
  surface nobody managing the wall would ever meet. A control without the fact
  beside it is not a control.
- The switch keeps its **own error slot** — a shared one could scroll out of
  sight while the switch showed the state the couple asked for and did not get,
  and this is the one control where believing it worked is the entire harm.
- A **0-row update is not success**: Supabase resolves with `{ error: null }`
  when the WHERE matched nothing, so without that check the switch would report
  "saved" for an event that no longer exists.

### Data honesty (migration `20271133739556`)

The old default, `'tagged_only'`, was aspirational — **nothing anywhere filters
the mirror to the photos a guest appears in.** Storing it while showing
everything is the `sponsored_included` disease: a stored value whose NAME
misleads every later reader. The default becomes `'all_with_consent'` and the
five production rows move with it, recording the behaviour they already have.
Zero events own `LIVE_WALL` in production, so nothing visible changed for anyone.

`'tagged_only'` stays **legal** in the CHECK because the per-guest filter is a
real future build, but the app writer can only ever emit `'all_with_consent'` or
`'off'`, and a legacy `'tagged_only'` row resolves to "show everything"
deliberately and under test — so the fallback can never be mistaken for working
filtration.

### Two directions of failure, both deliberate

- `asWallGuestVisibility` **fails OPEN**: an unrecognised value must not silently
  delete a feature the couple paid ₱2,500 for. Only the couple, saying `'off'`,
  turns the mirror off.
- `guestWallMirrorActive` **fails CLOSED** on a read *error*: if we cannot tell
  whether the couple said no, we do not put their wedding on a hundred phones.
  (Supabase resolves with `{ error }` rather than throwing — a gate that ignores
  `error` reports "no objection" on a failed read.)

### Every assertion was mutation-tested

14 sabotages, each verified to have actually applied before the suite ran; 13
went red on the first pass. **One stayed green and was decorative**: it asserted
`/live_photo_wall_visibility/` over the whole function body, which the type cast
satisfied even with the query gutted to `.select('event_id')`. Re-anchored to
`.select('live_photo_wall_visibility')` — same shape as the sabotage guard that
matched `f.event_dateX` on a prefix. A guard matching a string rather than the
thing the string does is decoration.

Suites: 7625 unit + 188 in bracket-path directories + the db replay, all green.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-11 — the Live Photo Wall's guest
phone mirror is now a couple-controlled choice, default on (recording shipped
behaviour), and the venue projection is unchanged. `'tagged_only'` — the
per-guest filter — remains **named but not built**, and is an owner call.
