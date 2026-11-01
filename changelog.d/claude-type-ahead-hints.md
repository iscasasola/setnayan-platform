## 2026-11-01 · feat(guests): rotating example hints, +Role words and a preview line in the Guests add boxes

Owner rulings 2026-11-01 ("all yes"):

- **One shared rotating-hint mechanism** (`lib/rotating-hint.ts` + `lib/use-rotating-hint.ts`): an empty, unfocused
  box steps its placeholder from its own name through its examples about every 3 s; a focus or a typed word freezes
  it; reduced motion shows one still example; it writes the input's `placeholder` attribute only, so a step never
  re-renders the page. Wired into the shared thumb-row field (`ThumbField.hints`) and the add sheet's name box.
- **Guests examples** come from `quickAddTips(...).examples` — this event's offered roles (in the couple's own words
  when renamed) and its real one-word group names, never a person's data; the owner's own line
  "Mr. Roman Atkinson +2 +Groomsmen" leads the role examples. Every example is run through the real parser.
- **`parseGuestInput` reads `+Word`**: a role this event offers (singular or plural — Groomsmen → groomsman — its
  label, its "(…)" word, or the couple's renamed word) becomes the role hint; any other `+Word` is a group, like
  `#Word`. `+N` stays plus-ones. Titles (Mr. · Mrs. · Ms. · Dr. · Atty. · Engr.) already went to `name_prefix`.
- **Preview line** under both add boxes: "→ Mr. Roman Atkinson · +2 · Groomsman · #Barkada", computed from the same
  draft Enter sends (`typedGuestPreview` / `typedDraft`).

Guards: `lib/rotating-hint.test.ts`, `lib/guest-parse.test.ts` (+Role cases), `lib/quick-add-tips.test.ts` (every
example through the parser), `guests/_components/the-preview-says-what-enter-adds.test.ts`.

SPEC IMPACT: None — implements the owner's 2026-11-01 rulings in the shipped Guests boxes; other boxes later.
