## 2026-10-21 · feat(prints): every print wears the event's own Hub look — Event Hub Pro

Owner, on Studio › Prints (a plain cream Entourage card beside a Hub with a picture, its own colours and fonts):
*"shouldn't this mimic the event hub design? and so does the other prints?"* — then, on the gate contact sheet:
*"yes wire all, and yes it's Pro"*.

- `lib/print-hub-look.ts` — `printLookFromHub` puts on paper what the Hub itself resolved: the guest page's painted bag
  (`guestLookFrom(…).vars`), the four fonts (`site_font_key` + `site_roles`, page roles), and the Main background picture
  with the page's own scrim, made print-safe (picture to the bleed, words on a feathered paper panel ≥ 0.85 and ≥ the
  Hub's scrim, every ink ≥ 4.5 : 1).
- 🤍 A FREE EVENT PRINTS PLAIN WHITE (owner, verbatim: *"Free version is the plain white. Themes that follows the event hub
  is pro"*) — `plainPrintLook` / `printLooksFor`: white paper, near-black ink, one neutral grey, Classic's type, no theme
  colours, no Mood Board palette, no picture, whatever theme it saved (Modern and Cyber Neon included — the set is drawn as
  Classic). Before: the theme dressed in the Mood Board, with a free theme's loop still.
- 🔒 `printLookForEvent` — the ONE door: a non-Pro event gets plain white (the very object) and its Hub is never
  read; a Pro event wears the Hub. `loadPrintSet` hands it `printOwnsPro` (the event's entitlement, as viewed) — so all
  nine set pieces (invitation · entourage · details · menu · pass · poster · story poster · card · every guest's ticket)
  follow at once. The sample gallery (`samplePalette`) keeps drawing each theme as the theme.
- `app/[slug]/_lib/main-ground-layer.tsx` — `mainGroundPictureFor`: the page's own `pictureOf` answer for paper (the
  picture's address, its stored measured frame, the page's scrim). No second background resolver.
- The Entourage wears the Hub's style (On the axis · Lines); The march keeps the card's own.
- Hub faces print from the Logo's TrueType outlines (traced in `next.config.ts`); a face whose outlines break on paper
  falls back to Cardo (measured: Josefin pinned to 400 draws a 27-em "O").
- Studio › Prints: one row under Print settings — the diamond and "Your Event Hub look" when owned; ◆ PRO and the prints'
  own door to the centred note when not (`StudioProDoor`, `makerProMark` — never a padlock on the Event Hub, owner
  2026-09-29); nothing in the app-store shell without it.
- The previews' cache key (`printInputsVersion`) now carries the entitlement and the Main background.
- Guard `lib/every-print-wears-the-hub.test.ts` §5–7 (Pro door, no way around it, the measured entitlement, the row).

SPEC IMPACT: DECISION_LOG.md row 2026-10-21 "EVERY PRINT WEARS THE EVENT'S OWN HUB LOOK — AND THAT IS EVENT HUB PRO"
(corpus commits 7eff1451, a2398a08, 6d0f30bf).
