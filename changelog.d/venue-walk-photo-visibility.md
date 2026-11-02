## 2026-07-03 · feat(venue-3d): host-controlled guest-photo visibility in the public venue walk (default: own table only)

Guests roaming the public 3D venue explorer (`/[slug]/venue`) can now see guest
PHOTOS on the avatars — but only as the host chooses. New per-event setting
`event_floor_plan.venue_photo_visibility` (`'table'` default · `'all'` · `'none'`),
set from a "Guest photos" popover on the 2D seat-plan editor toolbar (next to
Export PDF), lock-gated like every seating mutation.

The privacy floor is unchanged and hard: `public_venue_scene` (v3) returns photo
refs ONLY to a valid per-guest token holder — the tokenless public view never
gets photos for any setting. `'none'` returns none; `'table'` returns the
token-holder's own tablemates' faces (the same rows that already carry names);
`'all'` returns every seated face but still NO names beyond the own table (faces
widen, the name directory does not). The server page + the public
`/api/venue-scene/[slug]` route resolve each raw stored `photo_url` ref via
`displayUrlForStoredAsset` (batched, deduped) before the client sees it; the
client reuses the shared `GuestPhotoAvatar` + `preloadGuestPhotos` primitive.

SPEC IMPACT: None. Owner decision (2026-07-03, DECISION_LOG) — implements the
"photo avatars in the public venue walk are the host's choice, default
own-tablemates-only" call. Seat plan stays free (no paywall). The `.docx`/corpus
iteration stubs are archive-only and not re-expanded per the de-drift policy.
