# HANDOVER — prints wear the Hub look (2026-10-21) — STOPPED AT THE OWNER'S GATE

Owner: *"shouldn't this mimic the event hub design? and so does the other prints?"*

## State
- `lib/print-hub-look.ts` (`printLookFromHub`) puts on paper what the Hub ALREADY resolved — colours from
  `guestLookFrom(…).vars` (the guest page's own resolver), fonts from `site_font_key` + `site_roles` through the page's
  sanitisers, picture scrim from `resolveAdaptiveTheme` (what `main-ground-layer.tsx` calls). No second resolver.
- Guard `lib/every-print-wears-the-hub.test.ts` — 54/54 print tests pass after merging origin/main (`npx tsx --test`).
- NOT WIRED: `lib/print-set.server.ts` still builds `printLookFor(…)` (today's look).
- Gate renders: `~/Documents/Claude/Projects/shots-2026-10-21/prints-wear-the-hub-gate/` (6 PNGs + contact-sheet.png;
  lab script + server-only shim in `work/`; run from apps/web: `NODE_PATH=<work>/shim npx tsx <work>/lab-render.ts <out>`
  — no `--conditions=react-server` any more, loaders.ts now pulls next/navigation).

## After the owner's yes
1. `print-set.server.ts` (the one `printLookFor(` call): wrap with `printLookFromHub`, fed by the event row through
   `guestLookFrom(row, await resolveHubTheme(row), proActive)` and the picture tint via `lookSampleTint`/
   `mainGroundLayerFor` (stored `HubTint.frame` — never re-measure the photo). That covers every SET piece at once
   (invitation, entourage, details, menu, pass, poster, story-poster, card, passes).
2. Walk the 6 non-gate set pieces at their own sizes (CR80 pass, A3 posters) — the frame/panel is only proven on 5x7.
3. Owner questions: is a Hub-worn print the PRO "themed" version (DECISION_LOG "EVERY PRINT IS FREE IN THE CLASSIC
   LOOK; THE THEMED VERSION IS PRO")? Do the FREE A4 reports (qr-codes, guest-registry, seating-pack, caterer-report)
   stay plain?
4. DECISION_LOG row + changelog SPEC IMPACT with the yes.
