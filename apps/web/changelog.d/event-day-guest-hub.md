## 2026-06-28 · feat(guest): fullscreen no-scroll event-day hub (Phase 2 of the guest-hub program)

The owner's centerpiece for the event-day guest experience: instead of a long
scrolling page, a guest on the day opens ONE screen-filling, no-scroll hub with a
bottom MENU that toggles between the day-of functions — "everything shows in
realtime, fills the screen, menu to toggle between functions."

**New, separate route — the long `/[slug]` page stays 100% intact.** `/[slug]/
page.tsx` is 4,100+ lines serving guests, anonymous visitors, STD/reveal, RSVP
and day-of; rewriting it would risk regressing all of that. The hub is a fresh
route at `/[slug]/hub` reachable from the event-day bottom bar that already
exists. The current page is unchanged except for two additive props (below).

**The shell (`_components/hub/hub-shell.tsx`, client).** `fixed inset-0` flex
column — a slim signature header (safe-area top) + the panel stage (the only
scrollable region, for a long Schedule) + the bottom toggle menu (safe-area
bottom). The page itself never scrolls. The menu shows ≤5 primary pills + a
"More" overflow sheet (responsive ruleset); an active panel is a filled ink pill
(the one restrained signature moment). It's a PANEL TOGGLE (one route, client
state), not route navigation, so it deliberately does not mount the canonical
`<BottomNav>` (which is `usePathname`/`<Link>`-driven) and is not named
`*-bottom-nav.tsx` — the delegation lint guard keys on that name. Overlays use
`useModalA11y`; realtime is `useDayOfLiveTick` → `router.refresh()` (the existing
pull-only "live propagation" — no push/socket infra), and the active panel
survives the refresh.

**The panels (`hub/page.tsx`, server — resolves identity + every panel's data,
hands each as a ReactNode to the shell):**
- **Now** — happening-now / up-next (`WhatsHappeningCard`) + the guest's seat &
  door-arrival tile.
- **Schedule** — the full live program (`ScheduleWidget`, auto-refreshing).
- **Directions** — Google Maps · Waze · Apple Maps (`NavLinksRow`) to the venue.
- **Watch** — Panood live embed (live window + staged `panood_watch_url`).
- **Camera** — Papic launch: the guest's paid roll (`/papic/me/{qr_token}`) and/
  or the candid camera (`/papic/guest`), same gates as the existing hub bar.
- **Photos** — the guest's live "photos of you" grid (`getGuestLiveGallery`) +
  the public album (Live Wall during the day, recap after).
- **Me** — the guest's personal QR (for crew tagging + the souvenir desk) + the
  3-shot day-of face enroll (`DayOfFaceEnroll`).

A **no-guest viewer** (anonymous open) degrades to public panels only (candid
Camera + public Photos, no personal QR / "photos of you" / face enroll), the same
posture as `public-event-day-bar.tsx`. Identity is resolved exactly as the page
does (the `setnayan_guest_session` cookie). Host/demo `?phase=event|post` preview
is honored so a couple can preview their hub off the day. All personal reads are
gated + graceful-degrade so the route never crashes on a partial install.

**Entry point (additive).** `GuestHubBar` + `PublicEventDayBar` gained an
optional `hubHref`; `/[slug]` passes `/${slug}/hub` during the live/post window,
rendering a top-left "Live hub" chip. With no prop both bars are byte-identical
to before.

Reuses (not rebuilt): `lib/day-of-mode.ts`, `lib/use-day-of-live-refresh.ts`,
`schedule-widget.tsx`, `whats-happening-card.tsx`, `guest-hub-card.ts`
(`pickNextScheduleBlock`), `nav-links.tsx`, `lib/panood-watch.ts`,
`lib/papic-guest.ts`, `lib/papic-limited.ts`, `lib/guest-live-gallery.ts`,
`day-of-face-enroll.tsx`, `lib/qr.ts`, `lib/use-modal-a11y.ts`.

tsc clean · next lint clean · lint:botnav / lint:navicon / lint:radius pass ·
production `next build` green (`/[slug]/hub` in the route manifest). Seat plan
stays free; no new SKUs; prices remain admin-catalog-driven; RA 10173 posture on
face/QR matches the existing day-of surfaces.

SPEC IMPACT: None (new guest-facing surface within the locked V1 day-of scope;
iteration `0031_day_of_guest` is the reference home — logged at the bottom of the
corpus `DECISION_LOG.md` per the relaxed sync mandate).
