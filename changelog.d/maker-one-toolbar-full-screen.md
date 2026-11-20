## 2026-11-20 · feat(maker): the Event Hub Maker — one toolbar, full screen, a way back (drawing v17)

Owner, 20 Nov: *"Yes, build it"* on `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html`, final at v17
("build with opus 5.5"). DECISION_LOG rows of 20 Nov: "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED" ·
"MAKER EDIT ROWS RUN BY IMPORTANCE" · "ONE LOOK HOME" · "MAKER TABS REVISITED" · "POST EVENT LEAVES THE EVENT HUB" ·
"MAKER PAYWALL" · "EVENT HUB SETTINGS REGROUPED; UPLOAD YOUR OWN SONG IS ◆" · "MAKER · WAY BACK + BUILT-IN GUEST
PAGES" · "OWN TEN THEMES — PARKED" (the themes stay as shipped).

PR #8072 merges `rd/maker-one-toolbar-opus-parallel` (the parallel build of the same toolbar) and `main`.

- **Full screen.** The app's bars step away while the Maker is open (`useChromeAway`); ‹ (the house BackButton) leaves
  to the event's Today. Top bar: ‹ · Stage ▾ · 👁 · ✓ Apply · ⚙ — 👁 is on a phone too and replaces holding ▶.
- **One toolbar on every scene.** Head ‹ · name · page ▾ (opens Pages) · › · ✕; foot Edit · Style · Animate ◆ and a
  worded ⤢ Expand (Logo, Love Story, Schedule, E-Gifts — never Dress code). ◆ shows only to a couple without the full
  Event Hub. ▶ sits inside Animate.
- **A tap always selects; nothing is picked on arriving.** The resting bar: "Tap any scene to edit it · Look · Pages".
- **The way back:** ✕, the phone's Back (closes Expand first, then the toolbar — the one `useBackCloses` entry; the
  risen editor no longer pushes a second one), drag the handle down, a tap outside a scene, Esc. Full screen: ✓ Done,
  ⤡ Minimize, Esc, Back.
- **⚙ Event Hub settings in v17's order:** Sharing · changes right away (Live for guests — "Guests can open it now" /
  "Hidden from guests" — · Address · Who can view · Which version guests see) · On every page (Event Bar) · Share and
  print (Event QR · Prints) · History · waiting for ✓ Apply ("Nothing waiting") · Event info 🔒 (names, date, venues,
  parents in Today › Event settings; guest list, RSVP questions, seats in Guests; Mood Board in Event › Mood Board).
  Look, "What guests see" and E-Gifts left the ⚙ (Look has its own button; the eye lives on each page of Pages;
  E-Gifts is a part on the page).
- **Stage ▾ is four stages** — Save the Date · RSVP · Invitation · The Day (`MAKER_STAGE_MENU_KEYS`).
- **Pages** lists Whole Event Hub first, "Before they come in" (Login · the door, Plus-one welcome, Waiting for you to
  accept — 🔒, each with its ⓘ), then the stage's pages; Me · Live · Camera say what they do.
- **Animate reads Arrives · While showing · Leaves · With the scroll**, and picking a motion plays it at once.
- **Style is named in groups** (Layout, then Background); **Edit runs by importance**, the heading last.
- **✓ Apply:** "◆ Get the full Event Hub and apply" · "Comes with Event Plus, Pro and Ultra." · "Apply without the ◆
  changes"; every ◆ mark in the Maker reads "the full Event Hub", never "Event Pro". Prices are untouched (catalogue).
- **Look › Music:** "Upload your own song ◆ · MP3 or M4A from your phone or computer" — the shipped upload, no new store.
- **"Event name"** labels the title's field; the guest E-Gifts page has a visible Back.

Proof: `build-sessions/shots-maker-v17/` (drawing beside build, 375 light/dark, desktop 1280) and its README's gaps.
Guards re-aimed to the rulings, each saying so; new guard `lib/the-maker-is-drawing-v17.test.ts`.

SPEC IMPACT: None (every ruling is already in `DECISION_LOG.md`, 20 Nov).
