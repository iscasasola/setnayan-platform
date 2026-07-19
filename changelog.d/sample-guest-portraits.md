## 2026-07-03 · feat(demo): bundle 28 AI-generated fictional portraits for the Maria & Jose sample guests

28 head-and-shoulders portraits (one per sample guest, filename = `guest_id`)
added at `apps/web/public/demo/maria-jose/portraits/<guest_id>.webp` — 512×512
WebP, 6–20 KB each (~452 KB total). Generated via Recraft v3; these are
**AI-generated fictional people** (same precedent as
`apps/web/public/portraits/README.md`) — never caption them as real
individuals. Faces are Filipino, wedding-attired, age-banded by guest role
(principal sponsors older, entourage younger).

`guests.photo_url` seeding for the sample event (raw
`https://www.setnayan.com/demo/maria-jose/portraits/<guest_id>.webp` URLs,
`photo_source='couple_upload'`) follows **post-deploy** as a separate scoped
data update pinned to sample event `947e7bab-893d-454d-b4c5-0a6e23f36009` —
no code path reads these files until then.

SPEC IMPACT: None
