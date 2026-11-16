## 2026-11-16 · fix(rise): Discover Filters and the chat ＋ rise full screen

#7595's ruling is "rise full screen, everything" (DECISION_LOG 2026-11-10), but two sheets still rose about half height (W1 walk, 16 Nov). Both now open through the ONE `RiseScreen`:

- **Discover › Filters** — the shipped filter form, split out of the drawer as `FilterDrawerForm` (one set of fields), framed by `RiseScreen` (title "Filters", the form's own Apply footer pinned). `/explore`'s drawer is unchanged and draws the same form.
- **Chat ＋ ("Add to the chat")** — the same rows, risen out of the ＋; the title and its ⓘ are the screen's own head.

Guard: `the-rise-screen-is-one-full-screen.test.ts` test 7 (sabotaged twice, red).

SPEC IMPACT: None — applies the 2026-11-10 ruling to two missed sheets.
