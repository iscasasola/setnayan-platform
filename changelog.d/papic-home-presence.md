## 2026-07-30 · feat(papic): Papic finally appears on the couple's home — a bento tile and a one-time "your free camera is ready" nudge

`Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` **PR-G**, the last item in the wave. Owner picked **options A + B** from the mockup at [`06_Prototypes/Papic_Home_Presence_2026-07-30.html`](../06_Prototypes/Papic_Home_Presence_2026-07-30.html) (artifact `50889ae8`).

**The gap:** every event is armed at creation with a free shared pool of shots **and** one free dedicated camera (`ensureFreePapicPoolGrantAdmin` + `ensureFreePapicOneCameraAdmin` in `create-event/actions.ts`), and the couple was never told so anywhere on their home.

### One resolver, two surfaces — `lib/papic-home-tile.ts`

Both need the same three facts, so they share one read: shots from `papic_event_pool_status` (**the same RPC the capture path meters against**, so the tile and the fence cannot disagree), cameras from live `paparazzi_seats` rows, photos from the two capture tables. It rides `<EventDashboard>`'s existing `Promise.all` rather than adding a round-trip, and returns `null` — meaning *both* surfaces render nothing — when the event has no Papic signal at all.

`preCapture` is the single switch that divides the two jobs: while nothing has been shot the nudge shows and the tile leads with shots-ready; on the first capture the nudge retires itself and the tile flips to photos-gathered.

### A · the bento tile — and the blur budget the mockup missed

Pre-capture: **"50 · shots ready · 1 camera out"**. From the first photo: **"312 · photos gathered · 1,840 shots left"** (owner default for PR-G question 2).

⚠ **The mockup drew a 3-across bento. The real thing is a capped 2×2**, and the block carries a documented budget quoted in its own comment: *"focal(1) + digest(1) + ≤4 minis + chrome(2) ≤ 8 above fold"* — `backdrop-filter` being the expensive part. Four minis already exist (Guests · Budget · Schedule · Messages), so an unconditional fifth would have quietly broken a performance budget.

So Papic **earns** its slot instead of taking it. `MAX_MINIS = 4` is now explicit, push order is the priority, and there is exactly one deliberate re-order: **once photos are landing**, Papic is the freshest thing happening at the event and moves ahead of unread threads (which keep their own nav badge one tap away). Before the first photo it stays last and appears only when a slot is genuinely free — the nudge does the introducing instead. That split is the whole reason A *and* B were both worth shipping.

### B · the nudge — `papic-ready-nudge.tsx`

A deliberate **sibling of `SetDateNudge`**: same band geometry, terracotta hairline, eyebrow / title / one-line body / one link / dismiss, same per-event `localStorage` memory. A second nudge style in the same slot would read as a second kind of message.

It retires itself three ways: the host dismisses it (remembered per event, permanently — a one-time setup notice earns that, exactly as set-date does); the first photo lands (the parent stops mounting it); or the tile takes over as the permanent readout.

**It waits its turn** (owner default, PR-G question 3): on a date-less event the set-date nudge already occupies this slot, so Papic's band renders only once a date is set. Two stacked bands read as clutter, and set-date goes first because the entire date-gated public-site lifecycle waits on it. Bonus: a date-less event pays **zero** queries for the gate, since it is only asked when the nudge could render.

**No number in the nudge copy** — what the event holds is admin-editable in `papic_event_pool_config`, and the tile beside it renders the live figures from the same read. A literal in the band would be the one place that drifts.

### Scope correction carried over from the mockup

The spec named three home surfaces. **`today/page.tsx` (retired 2026-06-03) and `for-you/page.tsx` (retired 2026-06-04) are redirect stubs** whose only job is keeping bookmarks alive — this is one surface, not three. Third stale premise in this wave, after PR-A and PR-B.

### Tests — and one that earned its keep immediately

`lib/papic-home-tile.test.ts` (9 cases) pins the three promises the surfaces make each other: `null` ⇒ neither renders · `preCapture` tracks captures across **both** crew and guest tables · the nudge gate stays cheap and fails closed · an unreadable pool degrades to zero shots **without** hiding a real camera.

The first run failed 5 of 9 — and **the stub was wrong, not the code**: `resolvePapicHomeTile` issues its counts inside one `Promise.all`, so a single shared query builder had every `then()` read whichever table `from()` was called with *last*, collapsing three reads onto one answer. `from()` now returns a fresh chain closing over its own table name, and the comment says why so the next parallel-reader stub starts right.

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,439/5,439 pass**. No local `npm run build` (7 GB heap → SIGTERM 143).

### Noted, not touched

`ADD_ON_SKU_MAP.papic` in `lib/add-on-stats.ts` is still `[]` with the comment *"0012 SKUs slot in here once the iteration's catalog rows land"* — and they have landed (five active Papic rows). It is **dormant, not a live defect**: nothing calls `resolveAddOnState` with `'papic'` (verified by grep), so no couple is currently mis-gated. But it is the identical shape of the bug that comment records being fixed for `panood` on 2026-07-21, where a stale map locked a paying couple out of what they bought. Worth closing before anything starts routing Papic through `resolveAddOnState`.

SPEC IMPACT: Applied to the corpus — `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` §2-G closed + §2.1 build log (**the wave is now complete**), and `DECISION_LOG.md`. No price, SKU, schema or flag change.
