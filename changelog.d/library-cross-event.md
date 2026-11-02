### Library hub — cross-event memory home (Photos & Videos · Saved Vendors · Editorials)

New account-level hub at `/dashboard/library` (one sidebar entry "Library" + a row in the account switcher so it's reachable on mobile, where the switcher is the account nav). Three cross-event tabs aggregating across every event the user hosts or attends:

- **Photos & Videos** — album-per-event grid. OWNED events read under RLS (papic_photos + papic_guest_captures, reusing the lib/papic-gallery visibility filter); ATTENDED events read via the admin client but return ONLY the user's own tagged, moderation-clean photos (mirrors lib/guest-live-gallery, scoped to the user's own guest_id). Plus an honest Facebook helper (share the gallery link + how-to-make-an-album guidance — no false auto-upload).
- **Saved Vendors** — cross-event `event_vendors` saves, deduped by vendor, hydrated via vendor_market_stats/admin, linking to `/v/[slug]`.
- **Editorials** — owned editorials always; attended editorials only when `status='published'` AND `landing_page_visibility != 'private'` (the public-link gate). Admin-client reads, all `server-only`.

Reuses PapicGalleryGrid, getSwitcherData, EventMonogram, fetchUserEvents, displayUrlsForStoredAssets. Nav registered the blessed (registry-delegated) way; `nav-registry-defaults` test passes.

SPEC IMPACT: None (new surface; iteration 0021/0025 account area gains the cross-event hub — to be documented in the North-Star follow-up).
