# HANDOVER — PR-D `rd/home-control-row` (builder, 2026-10-24)

Contract: corpus `prototypes/home_control_center_2026-10-24_fable.html` (10067d39, owner "ok" ~16:50) — its Review notes.
Stacked on PR-C `rd/home-service-widgets` (#6861). PR-E `rd/home-ai-and-params` stacks on this.

## State (PR-D)
- Model: `app/dashboard/[eventId]/_components/home-control-faces.ts` (pure; one data shape per widget; literal hrefs).
- Reads: `lib/home-control.server.ts` (Event Hub · Suppliers · Checklist), started in `page.tsx` with the rest.
  The plan Home no longer mounts `EventDashboard only="whatsnext"` (that mode is removed from EventDashboard).
- Compact tile + rotation: `home-tile.tsx` + `home-tile-rotation.ts` (timing constants, pure rules).
- Detail cards + compact grid: `home-control-row.tsx`. Today line + Later fold: `home-parts.tsx`.
- Services: `HomeServiceCard` / `PapicHomeCard` take a `tile` (the phone's closed face) and join `useOneOpen`.
- View Event Hub: `HubViewLink` → the shared `openEventHub(url)` in `lib/open-external.ts` (#6866, merged in from main);
  the local stand-in is gone.
- Fixture shared by the lab and guards: `lib/home-control-fixture.ts`.

## Decisions taken (not covered by the record)
- Cover Settings pill removed (prototype drawn without it; Countdown = Event Settings' one door).
- Suppliers' first face says "N of M booked" (the dashboard's own count) — not "covered": the Suppliers page's
  "Covered N of M" ring is a different, bench-only derivation; printing "covered" over the other number would be two
  facts under one word.
- Guests "role" line not drawn: the shipped role decision is a yes/no (principal sponsors), not a count.
- Services in detail sit two to a row in one grid (row-aligned), not two independent stacks (one DOM for the cards).

## Walk
Fixture stub: copy of `shots-2026-10-24/prb/scripts/fixture-stub.mjs` under `shots-2026-10-24/home-control/scripts/`.

# PR-E `rd/home-ai-and-params` (stacked on PR-D)
- Setnayan AI card = `home-cards/home-planner-card.tsx` (alerts from `lib/home-ai-card.server.ts`, picks from the cockpit).
- Ask box NOT built: no assistant chat exists in the product (the Setnayan AI page is buy + showcase).
- Params: `?q=declined` (existed) · workspace `?tab=quote` (existed) · `#task-<id>` (new anchor) · `?pay=<line_item_id>` (new).
