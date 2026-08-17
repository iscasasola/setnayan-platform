## 2026-08-17 · refactor(admin): the last ten top-level pages wear the one console table

Lane D of the admin console-table conversion (archetype shipped in #4506). Nine
of ten surfaces now render `<ConsoleTable>`; the tenth keeps one deliberate
exception, recorded below. `RAW_TABLE_BILL` falls 31 → 22.

**Converted** — `account-deletions` (recently-reviewed) · `completions` ·
`compliance/data-sheet` (2 of 3 tables) · `demo-vendors/inquiries` · `disputes` ·
`offline/_components/offline-diagnostic` · `papic-storage` (both tables) ·
`settings/payment-methods` · `vendor-partnerships` · `website-media/media-table`.

### The brief said none of these lied about a refused read. Seven of them did.

Measured on `f880f375f` by BINDING SITE rather than by the `data ?? []` spelling,
which is what the original scan matched — several of these never bind `error` at
all, so there is no `if (error)` for a scan to find:

- **`papic-storage`** — neither read's error was bound. A refused read printed
  "No measured captures yet — telemetry populates as new Papic photos are taken"
  (i.e. blamed the absence on nobody having taken a photo) with four stat tiles
  reading 0.0% / 0 / 0.00 GB / 0 beside it. Its stranded-copies read went further:
  `.catch(() => ({ total: 0 }))` rendered the **green** "None stranded — every
  Drive copy is landing." A thrown read reported as an all-clear, in the
  reassuring colour.
- **`compliance/data-sheet`** — `factsRes.error` never checked. Every NPC field
  rendered `[TO CONFIRM]`, indistinguishable from genuinely-unsettled fields, and
  the sub-processor table rendered "No sub-processors recorded." on the document
  the owner prints and files. Declaring no cross-border sub-processors because a
  read failed is the worst instance of this defect in the admin tree.
- **`disputes`** — stats read bound `data` only ⇒ four confident zeros, i.e. "no
  disputes this quarter" on the disputes desk.
- **`vendor-partnerships`** — the live table sat inside `{live.length > 0 ? … :
  null}`, so a refused read made the whole section **vanish**.
- **`demo-vendors/inquiries`** — printed "No demo inquiries yet" plus instructions
  to go re-seed demo vendors: it told the reader to fix data that may already exist.
- **`account-deletions`** — `recentErr` logged, never surfaced.
- **`completions`** — rendered its error banner AND "Nothing needs attention" at
  the same time; the second half wins, because it sounds like an answer.

Only `settings/payment-methods` branched on the error first, as documented — its
correct behaviour is preserved, not replaced with something weaker.

### Caps: four files cap TWICE; the register listed one each

`disputes` 200 **and** 5000 · `vendor-partnerships` 25 **and** 500 ·
`account-deletions` 200 **and** 50 · `papic-storage` listed "no cap" but caps
twice at `ROW_CAP`. Every one is now a named constant passed to the same place it
is applied.

Two of them are **not** list caps and are disclosed in words instead, because
`cap` would be the wrong tool:
- `disputes`' 5000 backs a **count**, so filling it does not shorten a list — it
  makes all four banner numbers understated with no visible symptom.
- `completions`' 500 caps the **source scan**; the rendered list is a JS filter
  over it and is always shorter, so `cap` alone could only fire when every
  scanned row was also stuck. Measuring downstream of the cut under-reports it.
- `vendor-partnerships`' 500 feeds a `<select>`. A truncated picker is a vendor
  who cannot be chosen with nothing saying why; it now says so.

`vendor-partnerships`' 25 was checked before wiring: `SearchParams` carries only
the three flash keys, there is no offset/page/cursor anywhere in the file and no
next control. It is a **ceiling, not a page size**.

### One table is deliberately NOT converted

`compliance/data-sheet`'s third table is `FieldTable`, a printed **field sheet**
of `<th scope="row">` label/value pairs, rendered five times. `ConsoleTable` is a
columns-with-headers records component: wearing it there would add a visible
"Field | Value" header row to a document filed with the NPC and drop the
row-header semantics a screen reader uses to announce each field. Same call as
`ugat-console.tsx`. The file therefore **keeps its bill line**, and the reason is
annotated at both the component and the guard so the line does not rot into
"somebody forgot".

### Also

- 🪤 **`offline-diagnostic` rendered `className="m-table"` and there is no
  `.m-table` anywhere in the repo.** `.m-card` exists, so the name read plausible
  and styled nothing. Removed with the table, not ported across.
- ⚖ **`disputes`' local `StatCell` is retired and its four tone tints are
  genuinely lost.** Traded on purpose: `StatCell` took `value: number` so it could
  not render "unknown". The labels already say Open / Resolved · vendor /
  Resolved · couple / Withdrawn; the colour was reinforcement, the number being
  true is not. Same for `papic-storage`'s local `Tile` and `completions`'
  `CompletionsTable`.
- 🔒 **Judgement queues keep no fast buttons.** `disputes`' Resolve stays a
  confirm-gated form in its own cell because `resolveDispute` throws without an
  outcome and throws again unless a non-withdrawn outcome carries notes; same for
  `completions`' Uphold. The shape is decided by what the action refuses to run
  without.
- 🎨 **7 gold-as-text occurrences fixed** (`disputes` 5, `demo-vendors/inquiries`
  2) — all `hover:text-terracotta` on links, which the gold slot makes 3.37:1.
  This was **not optional**: the guard's colour rule iterates
  `[ARCHETYPE, ...CONVERTED]`, so a file cannot join `CONVERTED` while it still
  has one. It caught a real one mid-conversion.
- `MediaTable`'s `unreadable` boolean becomes `listingError` — the caller already
  held the reason the folder could not be read and was flattening it away.

### Verification

Test-proved and measured, **not observed**: admin sits behind a login, so none of
this is visible from a session. Do not read it as verified live.

- 8,566 unit tests pass; all 10 guard assertions pass.
- **5 mutations, each with the occurrence count printed before → after to prove
  the sabotage landed**, each turning the guard RED, restore returning GREEN:
  drop `readError` (1→0) · drop `cap=` while keeping `.limit(` (1→0) · restore a
  `data ?? []` coercion (1→2) · hand-roll a `<table>` back in (0→1) · re-add a
  converted file's stale bill line (present 1→2). Restored from an explicit
  backup copy, never `git checkout --`.
- The bill was **re-derived by measuring**, not hand-edited.

SPEC IMPACT: None. No schema, price, SKU or owner-locked decision touched.

### Port baseline — regenerated AFTER the extractor fix, absorbing only the three real removals

The first run of `lint-port-no-lost-controls` reported four losses. One was a
false positive: the `/admin/demo-vendors/inquiries` back link is intact —
`PageMasthead` renders `<Link href={back}>` — but the extractor's `HREF_RE`
matched only the literal token `href`, so a destination handed to a shared
component under any other prop name was invisible. Absorbing it would have
recorded that route with **zero** destinations, after which a real removal of
that link would pass silently.

The baseline was therefore NOT regenerated until #4522 widened the extractor
(`back`/`backHref`/`returnTo`/`cancelHref`, plus `_surfaces`/`_sections` into the
walked set — 41 files it had never read). Regenerated on top of that, absorption
checked **per route** rather than by totals:

```
routes: 402 → 402   ROUTES GONE: 0
destinations lost: 0   actions lost: 0   blocks lost: 3
   /admin/completions    lost block: CompletionsTable
   /admin/disputes       lost block: StatCell
   /admin/papic-storage  lost block: Tile
```

Exactly the three deliberate component removals, each one readable line — which
is what the lint exists to produce. No fourth item, and no previously-invisible
removal from another lane surfaced.
