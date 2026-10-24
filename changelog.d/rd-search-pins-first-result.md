## 2026-10-24 · fix(search): a bottom search shows its first result; the bar rises smoothly and the page makes room for it

The owner reported three things live on 24 Oct. First: *"When we search something on their respective search bars, it does not pin up to the first search result … I need to scroll up to find them."* Second: *"When the search bars peek upward, it overlaps with the content under it and does not look smooth."* Third, on Guests, a name that matched nobody ("Jsjdbd") showed "0 of 235 shown" over an empty strip, and its "＋ Add …" button was hidden.

- **The first result is pinned, through one mechanism** (`lib/search-pin.ts`). The one riding row (`useRidingRow`, `typing-band.tsx`) mounts `useSearchPin`, so every ThumbRow and every other riding row gets it without any change where it is used. When the words in the box have been still for 150 ms, the page scrolls so the first `[data-search-result]` (else the start of `[data-search-results]`) sits just below the top chrome, including a sticky page head or section head. With no result, the Add row (`[data-search-add]`, or a page's own `[data-search-none]`) is placed just above the band. Results that draw later, like a server read or a re-render, are followed for 4 s. A pin never runs while a finger moves on the page or a wheel turns. Marked surfaces: Guests (rows + the no-match Add), Suppliers (folders while searching + SearchAddRow), Memories, People, Discover, Budget and /explore. Chat's composer is in flow and has no results to pin.
- **Why the Add row was hidden** (measured in the lab): the no-match block's Add button is the last thing in a tall block, at 500–544, while the band's top was at 446. Nothing scrolled it into the strip between the chrome and the band. It is now pinned there, with its foot 8 px above the band.
- **The page makes room for the band.** While the band is up, `<body>` gets `padding-bottom: --sn-keyboard-h + --sn-ride-band-h`, measured by the riding row and removed with the band. The content ends above the band, so the last result can scroll into view.
- **The rise glides.** `lib/keyboard-ride.ts` now glides every riding row's host (`rideSmoothly`). Its layout moves once, and a `transform` animation (250 ms ease-out, the iPhone keyboard's timing) carries it from where it was to its new place, both up and back down. A pan of the screen moves it straight away. `prefers-reduced-motion` gets no glide. Measured in WebKit, the row's top in 40 ms samples: before, 726 → 490 in one jump; after, 534 · 505 · 496 · 491 · 490.
- **The row floats.** The thumb row's seats wear the house float token (`--sn-sh-float`, light + dark). The band's plate wears its upward twin, `--sn-sh-rise`, which is the same numbers with y mirrored, plus a dark pair. The shared `.sn-glass-row` stays shadowless (Rule 7 unchanged). The seats drop the Safari mask only inside ThumbRow, because a mask clips the element's own shadow.
- The Maker's own band is not a rider. Its in-flow bar still renders byte-identical (`every-bottom-input-rides-the-keyboard.test.ts` 2b).
- Lab: `/dev/guests-lab?part=screen&many=N` adds N generated guests, so a long list can be walked.

Guard: `apps/web/lib/a-search-pins-its-first-result.test.ts`. It covers the arithmetic, the pin on a stand-in page (no result → Add above the band; a result → at the top), the single mechanism and the surface marks, the room, the glide and the float. Sabotaging each part turns its test red. `discover-search-stays-on-page.test.ts` now reads the Discover results wrapper with its new mark.

SPEC IMPACT: None. This is a behaviour fix to shipped search rows. `--sn-sh-rise` is a mirrored copy of the existing float token, not a new design value.

### Search bands lose "Typing · …" and Done; tapping away closes the keyboard (owner, 24 Oct)

The owner's request, made on a screenshot of "Typing · Search guests" + ✓ Done: *"can this be gone? just tap away and keyboard should disappear"*.

- Every riding search row now wears the **search band**: a per-use `search` option on the shared `TypingBand` `over` mode, not a fork. The band is the plate only, running from the row's host top down to the keyboard. It has no caption and no Done, and it is `aria-hidden`; the field keeps its own label. This applies to Guests, Suppliers, Memories, People, Discover, Budget, /explore and the admin music tools. The chat composer drops its "Typing · Message" band.
- **`useTapAway`** (`typing-band.tsx`) is the one hook. It is used by `useRidingRow` and by the chat composer.
  - A click outside the row blurs the field *after* the click has done its own work, so a result or the "Add …" row opens in one tap.
  - On an iPhone a tap on plain content fires no click (measured in WebKit). The touch itself blurs instead, after a 120 ms settle, so a click that is on its way still lands first.
  - A drag that starts on the page, past a 10 px slop, blurs.
  - Escape blurs. The keyboard's own hide key needs no code: the row stops riding when the keyboard closes.
  - The folded tools (⇕ ≡ ＋) come back on blur.
- The Maker's in-flow and fixed bands are unchanged ("Typing · …" + Done, which means apply there). Guard 2b (byte-identical) is still green.
- /explore's suggestions no longer step 64 px over a band that is gone.
- Lab walk (WebKit 390, stand-in keyboard), after the change:
  - Typing shows only the field and ✕ on the plate.
  - A tap on the page, a drag, or Escape each blur the field; the band goes and ⇕ · field · ≡ · ＋ come back.
  - One tap on a hit's Open goes to the guest's page.
  - One tap on "Add “Jsjdbd” as a guest" acts: it opens the add sheet, because one word is not a full name.
- Guards re-aimed to the owner's ruling (`every-bottom-input-rides-the-keyboard.test.ts` § 3):
  - The riding row draws the band as the search band, and that band has no Face, Done or "Typing".
  - The composer taps away and wears no band.
  - Tap-away blurs after the click, blurs on a tap with no click (after the settle), blurs on a drag past the slop, and blurs on Escape.
