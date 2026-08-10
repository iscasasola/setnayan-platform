## 2026-08-10 · feat(papic): three rooms behind a tab strip, nothing moves yet

The couple's Papic page was **twenty cards in one vertical scroll** — choices
made once months before, the cameras run on the day, and the gallery returned to
for years, all interleaved in one column. Owner, walking it on 2026-08-10:
*"not integrated and simplified… we want to avoid having to scroll to access
this."*

It is now three rooms — **Photos · Cameras & shots · Set up** — and the page opens
on the right one: before the capture window → Set up · window open → Cameras ·
after → Photos.

**PR 1 of 12, and deliberately the boring one.** Not a single file moves and not
a single card changes; the existing JSX is regrouped in place behind
`{room === '…' ? … : null}`. That is why all five source-text guards that pin this
page pass **untouched**, and why the port-control baseline is unchanged: the diff
moves lines, it never edits them. Proven mechanically — the three groups
concatenate back to the original body byte-for-byte, and a line-multiset check
reports **0 content lines lost, 9 wrapper lines added**.

**🔑 The landing phase already shipped.** `captureWindowState` returns exactly
`not_started | open | closed` — the same question the capture path asks before
accepting a shot. No new phase logic was written.

**⚠ One deliberate divergence from it.** `captureWindowState` **fails open** on a
null window (correct there — a legacy seat must never be bricked mid-party), so
an event whose window was never set would read `open` and land the couple in
Cameras with no hint that the one thing stopping every camera is a date they have
not picked. Unset lands on **Set up**, and the test that pins this is the one
marked 🚨.

**🔑 The room is DERIVED from the outcome, not added to ~95 redirects.** Four
action files redirect back here with an outcome in the query string and not one
carries a room; editing ninety-five call sites is ninety-five chances to miss one
silently. One pure function does it instead, and it cannot be half-applied.

**And that map's own guard found nine outcomes nobody had counted.** It reads the
action files from disk rather than from a hand-typed list, and reported
`style_set/error`, `quality_set/error`, `showcase_set/error`, `faceTagging`,
`vendorMedia` and — named by nothing before this — **`guestCameras`**. All nine
are emitted by a redirect and read by **nothing**: they are not in the page's
searchParams type, so changing the look, the photo quality, face matching,
showcase state or vendor visibility all confirm *and fail* into the void today.
This PR gives each a room; wiring them to a visible banner is PR 2.

⚠ Two false alarms were removed from that guard before it landed: `seat_set` /
`seat_error` redirect to the `/crew` child page and are read there correctly, and
`next` is a login param. **A guard that cries wolf teaches you to skim past the
one time it is right.**

Also removed: a dead round trip. `eventOwnsPapicSeats(...)` ran on every render
and its answer was destructured into `ownsPapicSeats` and referenced nowhere in
1,785 lines.

Mutation-tested four ways, baseline green, every sabotage verified applied: an
unset window landing in Cameras (caught) · the outcome map falling behind an
action (caught) · an outcome overriding the couple's own tab click (caught) · the
window read as an instant instead of a whole Manila day (caught, 2 failures).
Plus the port wall: deleting the Photos room makes it name `<PoolGalleryCard>`,
`<RecapCard>` and `<VendorMediaControls>` as no longer shown.

SPEC IMPACT: None — no card, price, copy or behaviour changed. The IA itself is
recorded in `PAPIC_THREE_ROOMS_BUILD_PLAN_2026-08-10.md`.
