## 2026-11-25 · fix(area 7): final-check lane A batch 2 — the venue walk's live refresh, the hosts' supplier workspace

Final check (25 Nov), area 7, lane A — no screen redesign, each fix names its finding:

- A7-01 — the guest venue walk's live refresh asks `/api/venue-scene/[slug]` (the page's own joins: your table's name, the couple's colours, guest photos, booth logos and — new, shared through `withBoothShopFacts` — each booth's shop slug, `bookable` and 3D Booth add-on) instead of the raw RPC, so it no longer drops them after a minute. The route answers 503 on a failed read (kept as "not news"), never "taken down".
- A7-27 — "Save costs" / "Save crew" go through `CostsForm` (same action, no new server action): a failed save keeps the row and says "That did not save. Nothing changed — please try again."
- A7-22 — a refused self-added supplier contact read shows "We couldn't load their contact details", and no form whose Save would blank the stored address.
- A7-23 — refused delivered-work, appointments, colour-sharing and crew-meal reads say so (`ReadRefusedNotice`), never "nothing there" / "Off" / "Feeding 0".

Tests: `workspace-reads-and-saves-are-honest.test.ts` (new); `lib/venue-live-scene.test.ts` and `lib/s41c-supplier-batch-a-reads-are-honest.test.ts` now hold the route call (same strength: slug + token, log before "not news", keep the last scene).

SPEC IMPACT: None — honest states and a data join on already-drawn pages.
