## 2026-09-09 · feat(story): S11 — the eleven indexes, find in this day, Relive, and were you there

`Design_Editorial_By_The_Minute_2026-09-07` · `01` §3.6–3.7 + §8 · `08` steps 2.4 + 2.5. Extends
the SHIPPED spine (S9 PR #5342, S10 PR #5349, both merged and verified served) — nothing was drawn
beside the prototype and nothing under the clock was replaced.

**RULE 0 first.** `Relive` · `Find in this day` · `Were you there` appear nowhere in `apps/web`
except as three "S11 builds this" notes (`story-spine.tsx:17`, `editorial-content.tsx:154`,
`the-guests-layer-is-theirs-until-you-publish.ts:22`). What DOES already ship, and is reused
rather than rebuilt: `getGuestLiveGallery` (which captures a guest is tagged in, already gated,
already presigned), `askToTakeMyPhotoDown` / `removeMyTag` / `takeMyPhotoOffTheWall` (the guest's
own consent controls), `SaveStoryCardButton` → `/api/og/…?format=story` (the 9:16 card),
`useModalA11y` (the focus trap), `readGuestSession` (the identity).

### The index — eleven honest indexes, and not a second copy of the day

`lib/story-index.ts` (pure) builds captures · voices · asked · letters · the team · films · photo
wall · the room · the look · made with · by the numbers. Every row carries an `href` back to the
minute that renders it in full further up the page; the shipped sections under the clock are
untouched, in the host's own order, because folding them in here would have DELETED what a couple
switched on (the loss S6 exists to prevent).

**The privacy argument is the construction, not a check.** Every guest-layer tab is derived only
from an array `redactStoryLayers` empties; every count goes through `countForLayer`, so a withheld
one is `null` and never `0`; and a guest-layer tab that is empty *because the layer is withheld* is
dropped from the strip entirely — an empty "Captures · 0" chip is a claim about somebody's
celebration. Owner gate Q1 (2026-09-09) holds.

⚠ **`galleryCaptures` is new on the payload and had to be named in `LayeredStoryPayload`.** It is
the same Papic captures `galleryPhotos` already carried, plus the shutter time the loader was
resolving and throwing away (no new query, no widened read). A parallel array of the identical
photographs would otherwise have walked straight past a redaction that only knew the first name.

### Find in this day — the index is the live DOM, and there is no other

`find-in-this-day.tsx` takes **no data props, imports no data module, and issues no fetch**. Its
only source is `document`. Everything a reader may not read was removed from the payload before a
single element rendered, so it is not in the page, so it cannot be a hit — *a stranger cannot
search what a stranger cannot read, because it was never written down.* Groups minutes · voices ·
captures · letters · questions · the team; understands `7:12`, `19:12`, `9:47pm`, `3 hapon`,
`3 ng hapon`, `8 gabi`, `10 umaga`, `12 tanghali`, `2 madaling araw`, and offers "jump to that
minute"; non-matching minutes dim.

Two departures from the prototype, both deliberate: the button, the input and the results are ONE
anchored popover (the prototype's two flat siblings changed the sticky bar's height mid-scroll),
and matches are marked as **segments React renders as text** rather than `<mark>` built into an
`innerHTML` string — safe for hard-coded demo copy, unsafe the moment the text is a wish a guest
typed.

### Relive, and Were you there?

`relive.tsx` crossfades the day's written minutes. Prev/next are two full-height halves at zero
opacity that return on focus — invisible to the eye, never to the keyboard; focus is managed by the
shipped `useModalA11y`; `prefers-reduced-motion` is honoured by the SCRIPT (no autoplay at all, not
merely no fade). Its slides are `dayChapters`, which the redaction empties — so a pre-publish
stranger gets no button, not a disabled one.

`were-you-there.tsx` + `_lib/your-own-day.server.ts`: 🔒 **there is no name field, for anyone,
ever** (owner ruling 2026-09-07). The identity is the signed guest session; every read is
`.eq('guest_id', session.guest_id)` from a signed cookie, with the event checked against the
session's too. It shows the minutes they are in, what they shot, what they said, their table (the
only place a table is ever attached to a person) and the shipped 9:16 card — and it is the only
place a guest acts on their own consent. `askToBeUnnamed` is new and **immediate**, because their
own name on their own sentence is nobody else's; "hide it" stays a request to a person, because the
photograph may hold four others.

### 🔴 TWO COUNTS OF ONE THING, ON ONE PAGE — established, then fixed

The cover said **14 captures** and *By the Numbers* said **15 Photos & moments**. Established from
the QUERIES before either number was touched: `metrics.photos` counts `papic_photos` with **no**
`photo_type` filter (stills AND clips); `metrics.clips` counts the same table filtered to clips — a
strict SUBSET. The old line added the subset to its own superset. Measured in production: 13 stills
+ 1 clip, `impact_metrics` empty so both are live, `14 + 1 = 15`. **The one clip was counted
twice.** They were never counting different populations under one word — the arithmetic was the
whole defect, so the fix is not "make one match the other": `photos` already IS "photos & moments".

The index's captures chip therefore prints the cover's number only when it holds every capture the
cover counted, and prints nothing otherwise — a third number disagreeing with both would have been
the same defect with one more instance.

### Guards — each one sabotaged, with the occurrence count printed

- `lib/the-index-cannot-outrun-the-payload.test.ts` — runs the real pipeline twice, once WITHOUT
  the redaction, and asserts the before-count is non-zero: unredacted **6** guest-layer entries,
  redacted **0**, host **6**. 🪤 **Its count arm was decoration on the first cut and the sabotage
  run found it** — it fed the redacted payload, where an empty withheld tab is dropped, so the loop
  ran over nothing and breaking `countForLayer` outright left it 5/5 green. Rewritten to gate
  entries that are PRESENT, and it now asserts the loop ran. Four sabotages, four failures.
- `app/[slug]/_components/story/no-name-field-on-the-story.test.ts` — every form control on the
  story tree must be argued for by name (3 today: the search box, the "which photograph" select,
  the takedown note). A first-name box fails BOTH arms; a merely unargued input fails one; an
  empty scan fails the floor.
- `lib/story-find.test.ts` — 9 cases over the time grammar, `every`-not-`any` narrowing, the cap,
  the snippet and the marking.

⚠ **`lib/modal-a11y-adoption.test.ts` was scanning RAW source** and reported `find-in-this-day.tsx`
— a file whose docblock explains why it deliberately does *not* claim `aria-modal`. Now routed
through `lib/strip-comments.ts`, which also stops a mere MENTION of `useModalA11y` in a comment
counting as evidence that a file is wired. Re-verified by removing the hook from `relive.tsx`
(occurrences 2 → 0): the guard fails.

TSC_EXIT=0 · ERROR_LINES=0 · `pnpm lint` 0 errors · `lint:legibility` 0 sub-12px · `lint:server-only` clean.

SPEC IMPACT: None — `01` §3.6/§3.7/§8 and `08` steps 2.4/2.5 are implemented as written. The two
departures from `prototypes/story.html` (the search as one anchored popover; segments instead of
`innerHTML`) are recorded above and in the files' own docblocks.
