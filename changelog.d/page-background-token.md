## 2026-11-12 · feat(admin): Admin › Colours — the app's colours by job, and the page background is its own setting

Owner, 12 Nov 2026: *"we want a page in admin that controls the background, the money button color, the decision button color, the frame inside, the private chat, the on color for toggle buttons"* — keep the background white, *"pressable buttons has a different color with frames on top"*. Approved the Fable prototype (corpus `Design_App_Colours_2026-11-12/app-colours-admin.html`) with "i like it", then "Yes, start wave 1".

**Nothing moves on screen until the owner saves a set.** Every default equals what `globals.css` paints today, and an unsaved set emits no stylesheet at all.

- **The page has its own colour.** `--sn-page-bg` (Tailwind `bg-page`) is read by `body` and the 25 full-height wrappers that painted `bg-cream`/`bg-paper`. Before, the page shared `--color-cream` with cards and the white words on filled buttons, so tinting the page would have greyed every button label.
- **Decision is split from toggle.** `.ab-brand` and `.button-primary` read `--sn-decision` (never declared in `globals.css`; each consumer falls back to exactly what it read before). Recolouring a switch that is on no longer recolours every Next/Add/Publish.
- **One saved setting.** `platform_settings.app_colours` (JSONB, NULL = today's colours), read once per cache window by the root layout (`getAppColours`, remembered under the platform-settings tag) and written as `html:not(.dark)` tokens in `<style id="sn-app-colours">`. Light mode only; the guest Event Hub (`.sn-editorial` and the guest islands) is handed back today's values.
- **Admin › Colours** (`/admin/colours`, Catalogue tab, beside Settings): four moods (Current · Sunrise · Ocean · Dusk), one row per job with its readability line and a one-tap nearest readable shade, a live preview of a couple's Home, Save and Reset to current. Save is refused, in the editor and again on the server by the same `judgeAppColours`, when words would not read (WCAG 4.5 / 3) or two filled button kinds look alike (ΔE < 20). Audited as `app_colours_edit`.
- **Saved now, drawn later:** the header band, frame (fill, corners, lift), icon tiles and the three liveliness switches are labelled "applies in the next update". Their tokens are declared with today's values and nothing reads them yet.
- `scripts/colour-job-map.mjs` — the scanner behind the element map (`map/` in the same corpus folder).

Guards: `lib/app-colours.test.ts` (defaults = globals.css, no stylesheet when unsaved, guest islands handed back, the gate, every offered fix passes) and `lib/app-colours-in-globals.test.ts` (the split; seen RED with `.ab-brand` put back on bare `--sn-accent`). Four existing accent guards updated to read the fallback.

SPEC IMPACT: `Design_App_Colours_2026-11-12/` (prototype + element map) and the `DECISION_LOG.md` 2026-11-12 ADMIN › COLOURS row, already in the corpus. Two owner calls stay open there: the 2026-08-21 "pages start straight at content" lock vs the header band, and whether the focus ring and nav active colour follow decision or toggle.
