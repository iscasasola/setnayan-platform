## 2026-11-14 · style(studio): template wave 1 — Studio, Live and Pabuya pages follow the design template

Template wave (owner, 14 Nov: "let's launch them all to cloud now"), first PR of the folders under
`app/dashboard/[eventId]/` assigned to this builder: Studio's Patiktok, Papic, Panood, Live Studio Control, Photo
delivery, Playlist, Pakanta, Setnayan AI, guest columns and indoor blueprint, plus `live` and `pabuya`. Style only —
same words, same data, same actions; shared pieces only (`ActionButton` classes, `InfoTip`, `PickMenu`/`PostedPick`).

- **Paragraphs** of 110+ characters keep their first sentence as the line; the rest sits behind its ⓘ.
- **Read-only cards** are plain sections under one hairline (dashed drop zones, clickable and coloured boxes keep theirs).
- **Hand-made buttons** wear the shared pill (`ab ab-brand ab-main` for the filled main verb, `ab ab-neutral` otherwise).
- **Native selects** are the ▾ picker: `PickMenu` in client components, `PostedPick` (same field name) in server forms.
- **Typewriter capital captions** are the sheet's sans section label; status words, counts and prices lose the
  typewriter face (codes, URLs, keys, file names and folder paths keep it).
- **Hex** on the camera print sheet is tokens; 9–11 px words are 12 px; ink below 70 % on words is 70 %.
- **Left as `main` has it:** files other open PRs edit (#7605, #7545, #7547, #7608, #7635, #7687), and
  `pabuya/_components/pabuya-message-editor.tsx`, whose shipped editor is pinned by `studio-round-3-follows-the-owner`.
- Guards re-pointed, not weakened: `life-flash-card.test` accepts the shared filled pill as the CTA colour;
  `the-app-opens-what-apple-sells` reads the custom-reel line as its web-only `InfoTip`; label-on-fill record rewritten.

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`).
