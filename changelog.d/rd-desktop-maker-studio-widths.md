## 2026-10-19 · feat(maker-desk): Studio on a desktop is the phone's screen with room; the event's name in the top bar; Preview ▾ Desktop is the guest's real desktop page (desktop Maker, doc PR 5)

Owner rulings: 2026-10-07 "DESKTOP ADAPTATION APPROVED — ALL FIVE A" (`MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`
§ Studio, § Top nav, answer 4 "Real"). Still dark for couples behind `makerDesktopColumnsEnabled`; a phone is
untouched (its Studio rules stay `@media (max-width:1023.98px)`, byte for byte).

- **Studio's tools** (`maker-desk.tsx`, CSS on the desk rule set): each is the phone's own screen — which half shows
  is the phone's own list (`STUDIO_FORM_ITEMS`: the form alone; `STUDIO_PAGE_ITEMS` + the Seat plan: the page
  alone); the old desktop navigator is not drawn (Studio ▾ in the top bar lists the pages, as on the phone). A form
  stands in one 760-px column; Mood Board · Logo · Wedding March · Seat plan take 1100 px; the march keeps its
  Not-walking tray at the foot (its parents are the march's own rows, as on the phone); Look keeps its page beside
  its controls (two columns, the controls 384 px), its background previews a 2-column grid with the hover ring.
  The phone's form skin (`STUDIO_SKIN_CSS`, `STUDIO_INFO_HAIRLINE_CSS`, now exported) is worn by the desktop's
  screen through `deskScoped`, which gives every selector the desk switch. The Studio home's tiles go four across
  (kept, though the bar no longer leads there — owner 2026-10-08).
- **The event's name in the middle of the top bar** ("Event Hub · Maria & Jose", the prototype's words): the launch
  page reads `display_name` on the query it already runs and hands it to the shell only with the columns on; the
  lazy `MakerDesk` draws it, from 1280 px (under it the bar has no room).
- **Preview ▾ Desktop draws the guest's real desktop page**: measured, the page column (584 px at 1280) drew the
  guest page's narrow layout. The page is now drawn at a guest's desktop width (1280) and scaled into the column
  (`useDeskGuestDesktop` → `--desk-pv-k`); the canvas's own measures read the scale, so a tap picks and the frame
  lands on the part (walked: a tap on the date picked Date, its frame on it).
- Guard: `lib/studio-on-a-desktop-is-the-phones-screen.test.ts` (the phone's lists; the doc's widths; the skin
  scoped; the name only with the flag, only from 1280) — sabotaged 4 ways, red each. The desk guard's selector
  splitter now splits at top-level commas only (a nested `:is(…,…:has(…))` list was cut mid-way).

NOT IN THIS PR (named): the event's name is the PUBLISHED one (a name typed and not yet applied shows after ✓ Apply);
area 1 part 2 — the guest Event Hub on a desktop: `prototypes/event_hub_guest_desktop_2026-10-15_fable.html` has no
DECISION_LOG approval row, so it is not built.

SPEC IMPACT: None — builds the approved `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md` PR 5 and its top-nav name.
