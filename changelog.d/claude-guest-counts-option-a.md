## 2026-10-26 · feat(guests): counts strip — three counts + Invite button (option A)

Owner-approved "option A" (2026-10-26, prototype `guest-counts/index.html`, frames a-390 · a-1280) for the counts
strip at the top of Events › Guests (`guests-screen.tsx`, block `data-roster-counts`). Same numbers, same doors, same
hrefs — only the layout moved:

- title row "Replies ⓘ" (the app's one `InfoTip`, explaining that a number filters and what +1 "named / no name yet"
  mean) with "N% replied" on the right;
- the bar is two colours — attending (ok green) then not coming (danger red) over the grey of no reply;
- three big counts (Attending · Not coming · No reply) in a 3-column grid with hairlines between, each still the
  `countDoor` filter door (aria-pressed, tap again to clear);
- "+1s · N named · M no name yet" on its own line, with "N of M shown · × Clear" when filtered;
- "N to invite" became the filled brand pill **Invite N ›** (same `/guests/send`, same `data-roster-to-invite="door"`);
  with nobody left to invite there is no button — a quiet "✓ Everyone invited" (`data-roster-to-invite="words"`), shown
  only when someone `mayBeInvited`, so a list of just the couple claims nothing;
- "Download as Excel" became the outlined pill **⤓ Excel** beside it (same `/guests/export`, `download`, hidden on a
  failed copy as before);
- from 1024 px the counts sit left and the +1s line and the two buttons right.

`.counts` / `.replied` / `.countsDoor` keep their look for People (`people-roster-view.tsx` imports this sheet).
Pins updated honestly (`counts-equal-the-rows`, `the-counts-filter-what-they-count`,
`a-seat-with-no-name-can-be-released`); new guard `the-counts-strip-is-option-a.test.ts`.

SPEC IMPACT: None
