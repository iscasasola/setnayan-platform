## 2026-10-08 · feat(suppliers): Find's thumb row — expand all · search · add your own (Suppliers PR2a, part 1)

Owner 2026-10-07 evening (`SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2,
"UPDATED 2026-10-07 EVENING / LATE"; acceptance pictures 19–22): the thumb bar
in Find is **⇕ Expand all / Collapse all · Search all suppliers or add your own
· ＋ Add your own** — a floating, frosted row above the bottom bar. Stacked on
Suppliers PR1 (`rd/suppliers-shell-three-modes`).

- **The row owns nothing.** Its three controls are the bench's own (which
  categories are open, the search text, the add-your-own form); the row is only
  where they now live. Nothing new is read or written; +0 server actions.
- **Expand all** opens every category; a tap on a header then folds just that
  one; **Collapse all** closes them. (One-open-at-a-time is unchanged while not
  all are open.) The rule is `isCategoryOpen` in `lib/suppliers-shell.ts`.
- **Search** is the bench's shipped search (your suppliers by name or category;
  rows with a hit unfold by themselves; the marketplace results under it). It
  moved from a box above the folders to the thumb, runs 250 ms after the last
  keystroke, and typing never rebuilds the box.
- **＋ Add your own** opens the shipped manual-supplier form for the ONE open
  category; with none open it asks "What they do" first — one dropdown of only
  the categories on the event.
- **Universal rules:** one fit state for the row and the field keeps 60 %
  (`useFitRow`); it slides up once Find is on screen and down ~300 ms before
  the body swaps (the shell waits only when a row is up); glass — the row has
  no background, the field is frosted (`.sn-glass-row`, registered in
  `floating-rows-are-glass.test.ts`), Add keeps its terracotta.
- `SuppliersModeContext` (new, `suppliers-mode.tsx`) is how a body — a slot the
  shell cannot hand props to — learns which body is on screen and when the
  couple is leaving it.

## 2026-10-08 · feat(suppliers): Find is one flat list of category rows; an added category stays (Suppliers PR2a, part 2 · rows)

Owner rulings 2026-10-08 ("1. yes 2. go 3. ok").

- **Which rows an event shows.** Its own onboarding picks — a wedding's too
  (they were ignored on this page since 2026-06-28, which is why a wedding saw
  every category) — or, with no plan of its own, the "popular four" for its
  type (`popularTilesFor`, the Find page's own list). A category that holds one
  of the couple's suppliers, or a booking, ALWAYS shows. Everything else waits
  under "+ Add to your event".
- **An added category stays.** `restoreTileToPlan` (the existing action — +0
  exported actions, no migration) now also keeps the category in the event's
  `style_preferences.added_categories`, after a host check, through the shared
  `writeStylePreferenceKey`. A write that fails is said, never reported as saved.
- **What this changes on the checklist: nothing.** The onboarding picks list
  (`interested_categories`) is read — in the onboarding picker's own vocabulary
  — by the checklist's budget scope, the checklist suggestions, the brief sent
  to suppliers and the onboarding auto-inquiry fan-out. Appending a category
  there would have added checklist budget lines for the ~15 categories that
  share a picker key, done nothing for the rest, and could have been swept into
  a still-pending fan-out that messages suppliers. So the added category has its
  own key, which nothing else reads.
- **No folder level.** Find is one flat list: icon · name · "· N yours" · one
  state word (Booked ✓ · Covered ✓ · N quote in · N to decide) · chevron. The
  icon strip that drew the same categories a second time is gone.
- **"Cover your event · Covered N of M"** — N now counts a category that is
  booked or covered (it counted only "I'm done"), through `<Count>`.
- **"+ Add to your event"** is ONE dropdown under the list (it was a chip pool
  at the foot of each folder); **"Not needed · Remove ‹Category›"** names what
  it removes and keeps its confirm.
- **`Build N/M`** is counted over the ring — the rows Find shows — through the
  same `resolveBenchRing` the list uses.

- **An open category's header pins** under the date · place line and the
  control, so it can be folded from deep in its list; the icon pops and the
  body unfolds a beat later. Opening a row lands its first card under the
  pinned block — one frame after the commit, and again when the unfold has
  finished (no guessed delay).
- **The pinned category is the scope.** The thumb row's words follow it
  ("Search Catering or add your own" → "Search all suppliers…" when nothing is
  pinned); typing filters that category's own cards by name; Add opens the form
  for it. A pinned header's first tap goes back to its first card; a tap at its
  top folds it (rule 6).

## 2026-10-08 · feat(suppliers): the verbs on a supplier's card, by step (Suppliers PR2a · verbs) + three faults measured at 375

**Faults the controller measured on the preview (375 px), fixed:**
- "+ ＋ Add to your event" → one plus mark (the shipped words carry their own).
- The thumb row's search field showed only "S": the row is a portal and did not
  exist on the first render, so the fit pass ran once on nothing and never
  again. The controls are their own component now, so it mounts WITH the row;
  the field's 60 % is also held in CSS.
- "Coordinator…" / "Lights & Sou…": the name and "· N yours" are one run of
  text that wraps, never an ellipsis.

**Verbs by step** (`lib/supplier-card-verbs.ts`, one table, executed in its test):
saved → *Ask for a quote · Remove* · asked for a quote → *Nudge · Chat · Remove* ·
quote in → *Read their reply · Remove* · taken on the date → *Ask about another
day · Remove* · priced → *Add to build | In your build · Book · Chat | Your
record · Remove* · added by you, no price → *Your record · Remove* · asked to
book → *Nudge · Chat · Withdraw* · booked → *Pay | Payments | Set price · Your
record · Chat · Workspace*. One colour per meaning; one main verb per row; the
row drops its words as one (`useFitRow`).

- The table decides which buttons show. Whether an action is ALLOWED is still
  `resolveBenchCardActions`; a verb is offered only when that already holds it
  (no Chat or Nudge without a conversation, no Book without a lock id, no
  Remove on a booked or asked supplier, no Pay unless one is due).
- Every control is the shipped `ActionButton`; Book is still the one lock
  path (`AccordionLockButton`), Ask for a quote the one inquiry path, Withdraw
  the one withdraw path — each now carries its word in the label span.
- **Remove** on a card (it existed only as an undo): asks first, runs the
  shipped `deleteVendor`, and a refusal is said in words.
- **Nudge** posts one line — the prototype's — in the EXISTING conversation,
  through `sendChatMessageCore`, so the one-follow-up-before-they-accept rule
  applies and a refused nudge is reported in the core's own words. It rides the
  existing `contactShortlistVendor` action: **+0 exported server actions**.
- **Pay** on a card is the Booked row's own link (`teamRows`), passed down; a
  booked supplier with nothing due shows "Payments".

**Still to come in PR2a:** service cards (the `ServiceCardFace` shape), "More to
compare" always on with a count and its own sort, the supplier sheet.
`＋ Add "…"` with the typed name and the record sheet are 2b.

SPEC IMPACT: None — builds the plan's PR2 thumb row as written; what is
deferred to the next part is listed above and in the PR body.
