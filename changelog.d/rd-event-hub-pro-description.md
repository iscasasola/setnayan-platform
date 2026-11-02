## 2026-09-28 · fix(pricing): Event Hub Pro's catalogue description stops selling colours

Colours became free for every couple in the free-vs-Pro redraw (#6075; owner: *"free to change design, change text, size, color, background color, only when you start adding themes will it be pro. adding media for background."*). The one thing that PR left open was the `COUPLE_WEBSITE_PRO` row in `platform_retail_catalog_v2` — the text the public pricing page shows — which still said "your own colours for the page and its buttons".

- Migration `20271250830175_event_hub_pro_description_drops_colours.sql` (allocated with `pnpm migration:new`) rewrites that ONE row's `description` to the redrawn Pro list: the cinematic reveal, a Save-the-Date video, background music, the photo gallery, photo or video behind any scene or the whole page, the Pro themes (invite link included), fonts and animation, an animated logo, and a logo on every QR code — plus the Setnayan mark taken off. No count of themes (it rots); "Editorial editing" is not named (free for everyone). Price, `is_active`, aliases and gates untouched; idempotent.
- Guard: `tests/db/sellable-promises.db.test.ts` — "Event Hub Pro does not sell colours".
- Applied by the deploy pipeline (`supabase db push --include-all`), never by hand.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — the row "AS BUILT — THE FREE-VS-PRO REDRAW" marks its one OPEN item (this description) CLOSED by this migration. No decision changes.
