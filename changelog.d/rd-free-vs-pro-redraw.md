## 2026-09-28 · feat(maker): free vs Pro redrawn — colours and text are free; themes, media, fonts and motion are Pro · no "coming next" copy

Owner, verbatim: *"free to change design, change text, size, color, background color, only when you start adding themes will it be pro. adding media for background."*

- **Pro → Free:** a part's own colour and size (and a run of letters' colour and size); the Part sheet's other Text rows — weight, B · I · U, alignment, line and letter spacing; the page's **button colour**. One list decides it: `HUB_ELEMENT_PRO_FIELDS` / `HUB_ELEMENT_FREE_FIELDS` and `HUB_FREE_LOOK_EVENT_COLUMNS` in `lib/hub-look-pro.ts`.
- **The server agrees with the UI:** `canvasLookChange` compares only a part's font and motion (and a run's font); `site_button_color` is no longer a look column, so Apply writes it; `updateSiteColors` no longer asks Pro for it; the guest page paints it for every event (`pro-site-vars.ts`).
- **A held scene still gets its free edits:** `canvasFreePart` — a free couple who drafts a colour and a Pro font on one part gets the colour live at Apply; the font stays in the draft. Fail-closed (if the result would still add a look, nothing is written). The Apply bar counts that scene once.
- **Still Pro:** themes, media behind a scene or the page, a part's own font and animation, the typeface, Candlelight, magic move, scene motion, adding a scene of your own, the Pro QR.
- **The marks moved:** the Part sheet no longer wears one "Pro" mark on its title; only Font ▾ and the Animate tab do (hidden in the app-store shell for a couple without Pro). The scene's "parts" list lost its Pro mark. The Colours panel shows the button colour to everyone.
- **Pro list 10 → 9:** "Background color" and "Button color" out, "Photo and video backgrounds" in; CTA "Unlock all nine". The buy page's benefits and the Studio blurb stop selling colours; the Post Event tour stops calling a scene template Pro.
- **No promises of a later build in the Maker:** `MAKER_COMING_NEXT` is gone; the View menu's disabled "Both" row is hidden (not built); the hero note and the Theme panel's "all ten themes arrive in the next build" line are removed. The Snap grid note (no promise) stays as `MAKER_SNAP_NOTE`.
- Guards: `lib/free-vs-pro-redrawn.test.ts`, `lib/the-maker-promises-nothing.test.ts`; seven existing tests updated to the new truth.

⚠ Not done here (needs a migration): the `COUPLE_WEBSITE_PRO` description in `platform_retail_catalog_v2` still says "your own colours for the page and its buttons" — the public pricing page shows it.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — new row "AS BUILT — THE FREE-VS-PRO REDRAW + NO "COMING NEXT" IN THE MAKER" (what moved, what stayed Pro, the open catalogue-description migration, and one reading for the owner to confirm: weight / B·I·U / alignment / spacing read as free).
