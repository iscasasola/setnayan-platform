## 2026-09-09 · feat(story): the guests' layer is theirs until the host publishes

Build step **0.3** of `Design_Editorial_By_The_Minute_2026-09-07` (`01_The_Story.md`
§2, `04_Consent_And_Privacy.md` rule 8, `08_Build_Order.md` step 0.3). Nothing
renders the by-the-minute story yet — this is the fence going up before the
things that need it are built on top of it.

**The problem.** `event_editorial.status` is **one audience for the whole
story**, and that was enough while the page was all-or-nothing: before publish a
stranger got the graceful fallback, so there was nothing to leak. The
by-the-minute page breaks that on purpose — it grows *in public* while the day
happens (the invitation, the room, the live broadcast), and only the guests'
half stays back. One column cannot say "this part is public now and that part is
not".

**Hiding the entries is the wrong fix, and it is the one everyone reaches for.**
The design review found the photos correctly withheld and every *shape* of them
still public to a pre-publish stranger: the index, the dial's bar **heights**,
the minute sheet, the cover's counts, the Relive player and the closing words.
A `display:none` on a node whose contents were serialised into the page is the
same photograph, one View Source away.

**What landed** — `apps/web/lib/the-guests-layer-is-theirs-until-you-publish.ts`:

- `storyLayerAdmits(layer, status, viewer)` over three layers. The host's own is
  readable as it happens (the event's **own** privacy lock governs it, and a
  second opinion here is how two gates start disagreeing); the guests' maps to
  the `event` audience until `published`; the edition keeps `status` unchanged.
- **No migration.** `03_Data_Requirements.md` §2.5 asks for "a per-layer flag",
  and a stored flag is what a reader of that line reaches for — but the mapping
  is *total*, nobody has asked for a story whose guest layer opens earlier or
  later than this rule, and a column would only add a second opinion that can
  disagree with `status` plus a backfill for the seven rows in production.
- `redactStoryLayers(data, viewer)` takes the withheld layers **out of the
  payload** — Kwento, challenge answers, guest columns, the gallery, the essay,
  the day chapters, the photo wall, the cover's counts and the locked close —
  before a component is handed any of it. Monotone by construction, the way
  `consent-veto.ts` is: no branch adds anything, so a bug here cannot open what
  the shipped gate closed.
- `drawnBins()` is the only way to turn capture counts into bar heights, and it
  withholds one for **two independent reasons**: a bin after `now` is a baseline
  tick for *everyone including the host* (a bar's height is data about a minute
  that has not happened — drawing one is a lie, not a leak), and before publish
  the heights are the guests' layer.
- A withheld count is `null`, **never `0`** — "0 photos" is a claim about the
  day, and a false one while 492 captures sit behind the gate.

**Wired into all three public readers**, each with the viewer it already
resolved: `EditorialContent` (before `composeCopy`, so the words are never built
out of withheld layers), `/[slug]/print` (paper does not revalidate), and — new
— the gallery-anchor probe in `site-body.tsx`.

**That probe was a live leak, small and real.** It asks the story loader how
many photo blocks an edition has ~120 lines before the story renders, and that
count decides whether a **Gallery tab appears in the menu**. A stranger before
publish was told the guests had been shooting by a tab that only exists when
they have. The viewer is now resolved **once**, above its first reader, instead
of at the `<EditorialContent>` call below it.

**The guard** (`…is-theirs-until-you-publish.test.ts`, 19 tests) **asserts the
payload, not the CSS** — it serialises the redacted object and searches it for
the literal values, because a test matching `data-layer` or a stylesheet rule
would have passed on the exact page the review rejected. It also **walks** `app/`
+ `lib/` for every caller of `loadEditorialData` (8 today) and requires each to
redact or sit on a written baseline; the baseline is checked for staleness in
both directions.

Sabotage-measured, 8 mutations, occurrence counts before/after: neutering the
gate (1→1) fails 3; leaving the counts in (1→1) fails 1; giving future bins a
height (1→1) fails 1; deleting the redaction from the story (1→0) or the print
sheet (1→0) fails 2 each; a new unredacted reader (8→9 files) fails 1; the probe
reading unredacted again (1→0) fails 2; redacting after `composeCopy` (line
163→185) fails 1.

⚖ **OWNER GATE Q1 IS STILL OPEN AND WAS NOT DECIDED HERE.** Are aggregate counts
and bar heights public before publish? Built to the documented default — **no**,
flat baseline and no counts — behind a single named constant
(`COUNTS_ARE_THE_GUESTS_LAYER`). Flipping it is that one line.

⚠ **Known imprecision, deliberately the safe direction.** `galleryPhotos` /
`essayPhotos` are a union of the couple's own uploads and the day's Papic
captures, already resolved to display URLs — by the time they reach the
redaction the two provenances are indistinguishable, so both are taken. A
pre-publish stranger loses a few of the host's own photos, which is what "not
published yet" means anyway. Carrying provenance through the loader belongs with
the captures index that will need it.

⚠ `/[slug]/recap` is on the baseline: it is gated by its **own** publish flag
(`event_recaps.status`), which is independent of the story's. A host who
publishes the recap while the story is still a draft has chosen to. Worth
revisiting when the fourth publish state ("Taken back", `07` Q6) lands.

SPEC IMPACT: None — implements `08_Build_Order.md` step 0.3 as designed. No
schema change; §2.5's "per-layer flag" is satisfied by derivation, and the
reason is recorded in the module. Q1 remains open in `07_Open_Questions.md`.
