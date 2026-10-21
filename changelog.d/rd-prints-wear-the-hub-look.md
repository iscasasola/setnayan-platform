## 2026-10-21 · feat(prints): every print wears the event's own Hub look — GATE (resolver + 3 pieces, not wired)

Owner, on Studio › Prints (a plain cream Entourage card beside a Hub with a picture, its own colours and fonts):
*"shouldn't this mimic the event hub design? and so does the other prints?"*

- `lib/print-hub-look.ts` — `printLookFromHub`: the print's look from what the Hub itself resolved — the guest page's
  painted bag (`guestLookFrom(…).vars`, read back by `boardColours`), the four fonts (`site_font_key` + `site_roles`,
  page roles), and the Hub's picture background with its own scrim, made print-safe (picture to the bleed under the
  Hub's scrim, words on a feathered paper panel ≥ 0.85 and ≥ the Hub's scrim, every ink ≥ 4.5 : 1).
- `lib/print-pieces.ts` / `lib/print-layout.ts` — Hub faces print (`hub-<key>` → the Logo's TrueType outline files,
  traced in `next.config.ts`); `headingFont` / `labelFont` / `frame` on `PrintLook` (absent = byte-identical);
  the Entourage can wear the Hub's style (On the axis · Lines — lone people centred with the page's role word).
- A Hub face whose outlines break on paper falls back to Cardo (measured: Josefin pinned to 400 draws a 27-em "O").
- NOT WIRED: `loadPrintSet` still builds today's look — awaiting the owner's yes on the gate contact sheet.

SPEC IMPACT: None yet (the build is held at the owner's gate; the DECISION_LOG row lands with the yes).
