## 2026-11-15 · perf(speed): wave 5 — first responses start their reads together

Owner-approved speed pass. Measured slow on the walk: Maker 2.9 s · supplier Files 3.8 s · client hub 2.8 s ·
Suppliers 2.0 s · shop/Hub first response 2.2–3.9 s · admin website-media 2.9–4.2 s. No page shows anything new or
different; no read is added (one exception: Suppliers on an event type with no marketplace reads the viewer it then
does not use); every refused read still reaches the screen exactly as before.

- **Maker (`/dashboard/[eventId]/website/editor`)** — the post-event read no longer waits for the whole story loader
  before it reads the back cover, the table count, the entourage and the gift count: they start beside it (the back
  cover chains off the event row for its date). Before the day, the gift count runs beside its two rows. The section
  map's public schedule count is started with the Maker's other early reads instead of after the widgets.
- **Supplier client card — Files and Hub** — the files read (files · quotes · cards · every presign) ran TWICE per
  request (Files and Hub are both built on every client page); one `cache()`d read now serves both. The chat's shared
  files start beside it (the filed ids only filter, so they are awaited after the chat query). On Files the board now
  streams behind `<Suspense>`, as Hub already did.
- **Suppliers (`/dashboard/[eventId]/vendors`)** — who the viewer is is read beside the event type’s profile; the saved
  plan (already started on every path, just late) starts with the page’s other early reads.
- **`/[slug]` (shop addresses and 404s)** — when the event stamp answers with zero rows, no second event read is made
  (the stamp asks the same `slug ILIKE` question). A refused stamp still falls back to the direct read.

Left for after other PRs (they edit these files): the client card `page.tsx` (#7713, #7544), the couple's supplier
workspace (#7632), the embedded on-the-day Hub (#7632), `/v/[slug]` (#7717, #7696), the admin layout (#7753).

SPEC IMPACT: None.
