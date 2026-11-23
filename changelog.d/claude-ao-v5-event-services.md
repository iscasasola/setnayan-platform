## 2026-11-24 · style(event-services): Event services and the Today door in the website template (v5)

Owner 23 Nov 2026, specs DECISION_LOG "EVENT SERVICES v5 (WEBSITE TEMPLATE) APPROVED, WITH THE TODAY DOOR". Drawing: `prototypes/buy_event_services_one_place_2026-11-23/frames_v5_website/` + `strip-v5.jpg` + `strip-v5-today.jpg`. Look: HOUSE_DESIGN_STANDARD Part H. **Look only: every function is v4's** (one plan, packs, extras, one cart, one order, `/pay`).

- **Event services** (`studio/website-pro`, `event-services-view.tsx` + a new scoped sheet `event-services-website.css`):
  - A white page with a mono kicker and the one title.
  - "Pick a pack" and "Or just what you need" heads at 19/700.
  - Plan rows split by hairlines, with no boxes.
  - A **tick circle** on every pack row, filled when picked.
  - The price at 17/700; the saving and "Picked" as outlined mono tags.
  - The ⓘ opens the pack's full list **in place**, in a note box (no sheet).
  - The singles use the website's 48 px pictures; photo sizes are 32 px chips.
  - The Switch line and the iPhone app's states sit in note boxes.
  - A flat Pay bar holds the **one** terracotta button. Every other button is a quiet hairline pill.
- **Today:** the Event services row moves to the end of Your services and wears a "New" tag (`ServiceGlanceRow` gains an optional `tag`). Today's own look was already v5 (#8066).
- **Words and pictures** (`lib/event-services.ts`):
  - The single is named "Live Watch", as drawn.
  - `SERVICE_PICTURE` names the shipped files each single shows.
- **Guard:** `event-services-wears-the-website-look.test.ts` (5 tests; four sabotages seen red). The ⓘ guard's reason for this site is updated.
- No migration, no server action, no price typed. Prices still come from `platform_retail_catalog_v2`.

SPEC IMPACT: None. This builds the approved v5 drawing. The differences left are listed in the PR's STATUS: the 16 px house ⓘ; no ⓘ on singles, because the drawing defines no list for them; the Pay icon; quiet pills instead of text links; /pay not restyled.
