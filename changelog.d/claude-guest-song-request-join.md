## 2026-09-18 · feat(song-desk): a guest can ask the band for a song (SUP-52)

Every stage of guest song requests shipped in July except the join: the table and
the guest RPC lane with its caps (`guest_submit_song_request`, #3813), always-on
requests with a band pause (#3891), and the band's paid inbox
(`vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/requests-inbox.tsx`).
Nothing on `/[slug]` could post. This adds the guest's end:

- `app/[slug]/_components/song-request-card.tsx` — "Ask the band for a song", on the
  guest tree in the live window, beside the live wall.
- `app/api/song-requests/route.ts` — guest-session cookie → live-window check →
  audience check → Tier-1 moderation → the existing service-role RPC.
- `lib/guest-song-request.ts` — **the card shows only when a booked act can READ the
  requests.** `song_requests_open_for_event` calls every un-paused event OPEN,
  including a wedding with no band or a free-tier band (seeing requests is the paid
  part), so a button driven by it alone would say "sent" to nobody. The check runs
  the band's own gate — `fetchVendorRoomEvents` then `resolveSongDeskAccess`, with
  the event tiles passed in (the probes.ts 2026-08-15 lesson).
- A repeat ask (`ON CONFLICT DO NOTHING`, zero rows) says "already on the band's
  list", not "sent".
- Guard: `lib/a-guest-can-ask-the-band.test.ts` (6 tests; 6 sabotages each turn one red).
- `scripts/dup-rule.baseline.txt` regenerated: +6 lines for the route's deliberate
  3-column `events` read (date + venue coords for the live window), the same narrow
  read `app/vendor/fit/[ref]/page.tsx` already carries; −13 stale lines for code
  already fixed elsewhere.

Not built: the open (walk-in / master-QR) lane has no guest-facing surface yet.

SPEC IMPACT: None. This builds the unbuilt PR 7 request button in
`Song_Desk_BUILD_ORDER_2026-07-27.md`. It adds no schema and no pricing.
