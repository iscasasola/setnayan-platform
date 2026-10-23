# HANDOVER — PR-C `rd/home-service-widgets` (builder, 2026-10-24)

Contract: `prototypes/home_service_widgets_2026-10-23.html` (corpus 16e42418) + owner answers (Pro folded into the
Event Hub · no visits · order Papic → Event Hub → Planner, Live, Music, Booth · Planner = quick view with its four
figures · Music's Hub writes share the Hub's Apply). Stacked on PR-B (`rd/papic-prb-local-start`). Desktop = PR-D.

## State
- Shell `_components/home-service-card.tsx` (quick view · grows in its own frame · failed = "Couldn't load" + Reload).
- Cards `_components/home-cards/*` with reads `lib/home-*-card.server.ts`; drawn only for the couple on the web
  (`serviceCards = couple && !storeShell && !appleFacts`); the app and coordinators keep the shipped rows.
- Event Hub: parts per page (PickMenu) → `hubDraftAction` with the Maker eye's own value (`stage_show`), the shipped
  `HubDraftDock` Apply bar; ◆ line `hubProLine` (never a price).
- Booth: Primary/Backup template = the booth's own pick; its cookie now `sn_patiktok_booth_v2_<event>` at
  `/dashboard/<event>` (old one read as fallback on the booth).
- Planner: quick view only (four figures). Live: card only where `liveStudioRoamEnabled()`.
- Tour `customer_home_widgets_v1` mounted on Home.

## Open (owner)
- Music "Use on my Event Hub" still writes LIVE (`adoptPakantaSongAsSiteMusic`): the Hub draft cannot carry a Music
  Maker song yet (not a public-bucket ref; `site_bg_music_source` not drafted; the draft would hold it for Pro).
- Music Source stays a door into the Maker's Music panel (picking a song / uploading is the Maker's panel).
- The prototype's "Visits" is dropped (owner); "Published as a control" left as a state line (writes live).

## Walk
Fixture stub + scripts: `~/Documents/Claude/Projects/shots-2026-10-24/prb/scripts/` (stub with `INTERNAL=1 WIDGETS=1`,
`FAIL=table,…` for refused reads), PR-C walk `~/Documents/Claude/Projects/shots-2026-10-24/prc/scripts/shots.mjs`.
Dark shots force `.dark` — the event tree is not on the dark ready-list yet, so production paints it light.
