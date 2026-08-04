## 2026-06-28 · fix(guest): event-day bar "Photos" anchors to the inline live wall, not the JSON feed

The public event-day bar's **Photos** button linked to `/[slug]/live-wall`
during the live window — but that route is a **JSON route handler** (the
`LiveWallBlock` freshness poll feed), not a navigable page. So an anonymous /
public viewer who tapped Photos while the wedding was live (LIVE_WALL owned) was
navigated to **raw JSON**. Pre-existing since the public event-day bar shipped
(#2356); the `/[slug]/hub` rework (#2380) had already side-stepped it by
embedding `LiveWallBlock` inline.

**Fix:** the Live Photo Wall is *already mirrored inline* on `/[slug]` during the
live window (the anonymous PublicLanding renders it for master-QR / cookieless
visitors). So `publicAlbumHref` now anchors Photos to that section
(`/[slug]#live-photo-wall`) instead of the feed; the inline wall `<section>` got
the matching `id` + `scroll-mt-6` (clears the fixed bottom bar). The post-event
branch is unchanged (the viewable `/[slug]/recap` album), and outside live/post
the button self-hides as before.

`routes.guest.liveWall` (a dead helper, zero call-sites) and the
`live-wall-block.tsx` internal `fetch` poll are untouched — the feed route stays
exactly what it is, just no longer used as a navigation target.

tsc clean · next lint clean · production `next build` green.

SPEC IMPACT: None (UX bug-fix on the day-of public bar; iteration
`0031_day_of_guest`).
