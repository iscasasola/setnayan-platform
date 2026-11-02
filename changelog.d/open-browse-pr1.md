## 2026-07-23 · refactor(guest-site): OPEN-BROWSE PR1 — zero-behavior extraction of `app/[slug]/page.tsx`

First PR of the 5-tab guest-site rebuild (council build plan §3 row 1,
`Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md`). Pure
extraction — **zero behavior, copy, or style change**; every moved component
body is byte-identical to the original (verified mechanically, see PR).

**What moved.** `page.tsx` shrinks 4,351 → 2,736 lines. 18 module-private
components left it for `app/[slug]/_components/` (one component per file,
house kebab-case): `InvitationShell`, `HeroBackgroundMedia`, `WatchLiveBlock`,
`PrivateLanding`, `DayOfBanner`, `PublicHideableWidget`,
`HideableWidgetRender`, `RsvpWidget`, `FaceDataNotice`, `VenueWidget`,
`DressCodeWidget`, `PhotoMomentsWidget`, `YourPhotosWidget`,
`TierComparisonWidget`, `OurLoveStoryWidget`, `SpecialMessageWidget`,
`WhatToBringWidget`, `OurPhotosWidget` (private helpers `Detail`, `RsvpPill`,
`Field`, `Select`, `PhotoMomentModeBadge`, `parsePhotoMomentsConfig`
co-located with their sole consumers). `EventRow`/`GuestRow` — plus the
shared `WatchLiveData`/`LiveWallData` data types the moved components need —
now live in `app/[slug]/_lib/types.ts`; `eventNounOf` in
`_lib/event-noun.ts`. `PublicLanding` + `InvitationSite` deliberately STAY in
`page.tsx` — PR3 merges them into one `SiteBody`.

**Name-collision repair.** `lib/day-of-mode.ts`'s `LifecyclePhase` +
`getLifecyclePhase` (the dashboard bottom-nav menu phase, plan→dayof→after)
collided with the invitation-widgets website pair (save_the_date→rsvp→event→
editorial) that `[slug]/page.tsx` consumes. The day-of-mode pair is renamed
`MenuLifecyclePhase` / `getMenuLifecyclePhase`; all six import sites updated;
cross-pointer comments added at both definitions.

**The public-widget firewall constant.** `PublicLanding`'s inline 10-type
public allow-list is now `PUBLIC_WIDGET_ALLOWLIST` in
`lib/public-widget-allowlist.ts` with a unit suite
(`lib/public-widget-allowlist.test.ts`) pinning that `hero`/`greeting`/
`qr_card`/`rsvp`/`event_details`/`your_photos` can never creep in, the exact
10-member content+order, and full-catalog classification (a new widget type
fails the suite until explicitly classified). The open-browse program's later
CI anonymous-bytes check (PR3) builds on this constant.

SPEC IMPACT: None — extraction only; no product surface, price, or copy
changed. (Corpus updates for the open-browse program land with PR11 per the
council verdict.)
