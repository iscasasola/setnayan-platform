## 2026-10-07 · feat(maker): Studio's tools redrawn to the prototype — Info · E-Gifts · Prints · RSVP · Look (PR 4 of 6, behind the flag)

The new Maker's Studio (`makerStagesStudioEnabled` — off for couples, on for internal accounts)
opens its tools as the approved prototype draws them, over the SAME editors and the SAME writes
(plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 4). With the flag off the
Maker and Event Details render as shipped (`maker-stages-studio-ships-dark.test.ts`).

- **Full screen** — every Studio tool but Look fills the phone under its Tool ▾ row: CSS only, drawn
  by the server beside Details (`lib/studio-details.ts` `studioFullScreenCss`); 0 bytes of first-load JS.
- **Info** — ONE scrolling form: Event Name · Date and Venue **read-only** ("Set when you lock your venue
  in Suppliers") · Opening line · Special message · **What to bring** (`what_to_bring`, drafted) ·
  Event Hub address · **Your Event Hub**: Go live · Who can view ▾ · **Which version guests see ▾**
  (Automatic · Save the Date · Invitation · The Day · After · **All of them** = the shipped
  `setOpenBrowse` + `setLaunchPhase(auto)`, one control — `lib/which-version-guests-see.ts`) · Event Bar ·
  QR Shape/Pattern/Colour + Copy/Download · quiet rows Restore · Reset… · About (Settings had no home
  on the new phone frame — PR 1). The gifts leave Info for E-Gifts; Info/E-Gifts/Prints are a
  regrouping of the shipped items (`studioDetailsGroups`), nothing added.
- **E-Gifts** — What guests see (the shipped `PabuyaCardList`) · one switch per way to give (GCash ·
  Maya · Bank transfer · PayPal) with its number and name · the thank-you line — the E-Gifts page's own
  live writes (`saveEgiftMethod` / `setEgiftMethodEnabled`), said "Guests see this right away".
- **Prints** — the eleventh tile is ONE form: every set piece, every print for the day, Download the set
  (count = `PRINT_SET_KEYS` + `FREE_PRINT_KEYS`); the NFC spot moves among the Finer Details switches.
- **RSVP** — Reply by (instant, said) · **How guests answer ▾ All at once · One by one** (the shipped
  `oneAtATime`, drafted) · Words · What the reply asks · Celebration ▾ ◆. No "How guests get in".
- **Look** — one full-width `ISegmented` Background · Colours · Fonts · Music over the same Look editors,
  Background opening with the owner's one line.
- **Love Story** — its scrapbook (cards, each opened in place) fills the screen.
- `lib/main-ground-shade.ts` — Shade's five steps on the shipped readability rule (never under AA);
  NOT yet drawn (the guest render is its own PR).
- New guards: `which-version-guests-see-is-one-control` · `how-guests-answer-is-one-at-a-time` ·
  `info-shows-date-and-venue-read-only` · `prints-tile-draws-every-piece` · `shade-never-crosses-the-floor`.
- Dev labs: `/dev/maker-lab?studio=1` draws the new Maker on fixtures.

Not built (no field exists — reported to the owner, nothing invented): Schedule's For ▾ (`audience` is a
view filter, never stored — STOP per the plan), Love Story titles and grip order, Info's A note from us ·
Countdown line · Titles · To each guest, E-Gifts registry link, Look's Pattern · Blur · Focus · Shade ▾
(drawn) · Body text · Plays · editing the five colours here (the draft refuses a single-colour palette
edit today), the QR on/off switch, "Saved" in the Tool row.

SPEC IMPACT: None — builds the 2026-10-06 approved prototype behind the flag; the gaps above are listed in
the PR for the owner, no decision changed.
