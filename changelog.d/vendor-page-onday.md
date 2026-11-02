## 2026-07-01 · feat(vendor-dashboard): reskin On-the-Day console to the finalized prototype (editorial palette · live data)

Rebuilt `/vendor-dashboard/on-the-day` (`app/vendor-dashboard/on-the-day/page.tsx`)
to match the finalized 6-menu vendor prototype, in the editorial `--m-*`
palette (paper page bg · obsidian dark card · champagne-gold accents · sage-deep
progress · `--m-line` borders · 12px radii · skeletal Lucide icons, no emoji).
Every number is wired LIVE — nothing is hardcoded to the prototype's sample.

- **Heading + amber banner** — "On the Day" / "Your live event-day console —
  activates only on an event day", then the `--m-orange-4`/`--m-orange-2` lock
  banner explaining the T-1h→T+8h visibility gate (static, design-time copy).
- **Dark event card** (`--m-ink`) — the vendor's OWN event dated TODAY, resolved
  from `fetchVendorPoolBookings` (RLS-scoped) + `get_vendor_event_brief` (the
  SECURITY DEFINER booked-vendor brief RPC) for couple name / date / venue, plus
  the vendor's primary service label from `WEDDING_TILE_LABEL`. Avatar initials +
  "Change event" → the full brief. No booking today → a labelled "No event today"
  state (never a fabricated card).
- **Category pills + console** — Photo/Video · Coordinator · Caterer · Band/DJ,
  with the vendor's own console kind (`resolveDayOfConsoleKind(profile.services)`)
  active. Photo/Video variant shows two cards: **Delivery to the couple — N% done**
  (a 3-stage derivation from the real completion handshake `event_vendors` +
  posted `booking_handovers` — 0 / 60 / 100% = not-started / in-progress /
  delivered, NOT an invented percent) and **Guests — N / M pax** (live
  `brief.pax.attending` / `.invited`). Non-photo kinds route into the surface that
  already owns their day-of tool; coordinators keep the shipped inline `IssuesLog`.
- **Shot list** — the existing device-local `ShotList` (unchanged), section-framed.
- **Capture cards** — Recap capture (N clips) + Photos (N) counted live from
  `editorial_vendor_media` rows for this event (`media_type` clip/photo, cap 3),
  linking to the editorial-media uploader; "Review the couple" reflects the live
  completion/review handshake state (couples review vendors — there is no
  vendor→couple review flow, so the card surfaces the real handshake instead of
  inventing one).
- **Guest review QR** — a server-rendered QR (`qrcode`) encoding the vendor's own
  public page `/v/[slug]#reviews`, with a new `GuestReviewQr` client component
  (Print → clean print sheet · Show fullscreen → in-page overlay). Unpublished /
  slug-less vendors get a labelled "appears once your page is live" empty state.

Verified: `pnpm run typecheck` (clean) · `next lint` on both changed files (0
errors) · `lint:navicon` + `lint:retired` (pass) · production build compiled all
341 pages / static-generated cleanly (the run's tail `ENOSPC` was the sandbox
disk filling during final artifact writes, not a code error).

SPEC IMPACT: None. (Prototype fidelity + live-data wiring only — no pricing, SKU,
schema, or product-decision change. All reads reuse existing RPCs/queries/helpers;
no new tables, RPCs, or RLS policies.)
