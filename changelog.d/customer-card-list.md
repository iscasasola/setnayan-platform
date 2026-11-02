## 2026-07-03 · feat(vendor): Clients list — customer-card entry points + stage chips

The `/vendor-dashboard/clients` list now routes into the Customer Card from every
committed bucket, matching the disclosure-ladder card that already renders for
booked and accepted-inquiry vendors:

- Booked rows: "Event brief" link renamed to "Customer card" (same href); a
  `Booked` stage pill sits beside the event name.
- In-conversation rows: a new "Customer card" link to
  `/vendor-dashboard/clients/[eventId]` (the card now works for accepted
  inquiries), alongside the existing Open chat. Each row shows `Quoted` when a
  non-draft `vendor_proposals` row (status `sent`/`viewed`) exists for that
  event, else `In conversation` — derived from ONE batched `.in('event_id', …)`
  query across all listed events (no per-row queries).
- Outside clients: an `Imported` pill per row.
- Intro copy now names the customer card (brief, quotes, payments, files,
  schedule, team notes).

Stage pill tones reuse `THREAD_STAGE_TONE`/`THREAD_STAGE_LABEL` from
`lib/vendor-thread-stage.ts`. No migrations, no server-action or layout changes.

SPEC IMPACT: None — design source 03_Strategy/Customer_Card_Prototype_2026-07-03.html
