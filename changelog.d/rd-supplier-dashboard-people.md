## 2026-10-10 · feat(supplier): the button rule inside Today's folds (S-PR1b) and Customers › People (S-PR2)

Steps three and four of the supplier dashboard redesign (corpus
`SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 6; prototype
`prototypes/supplier_dashboard_2026-10-08_fable.html` frames 01 and 03; the
owner's answers of 2026-10-10 on the built-vs-prototype sheet — cards 9 and 3).
Built on `rd/supplier-today-rows` (S-PR0 + S-PR1) merged onto today's `main`.

### S-PR1b — the answers that open inside a Today row wear the button rule

- Every control in `app/vendor-dashboard/_components/overview-sections.tsx` is a
  button-rule button now: 14 form submits through `SupplierSubmit` (the shipped
  `SubmitButton` — pending word, double-tap lock, the no-touch veil — wearing
  `ActionButton`'s class list), 8 doors through `ActionButton href`, and the four
  "no" folds open from a quiet grey button (a `<summary>`, so it opens with no
  script). Colour by what the button does: agree · accept · confirm · delivered
  = green; turn down · decline · never arrived = red; reply · open the chat ·
  offer another time = blue; open · view · unlock · keep = grey. Every button has
  its icon. **No word changed.** One bare `<button>` and every hand-classed pill
  are gone.
- `Agree to remove it` stays red (it removes a couple's event; the button
  inventory listed it green) and `Keep it for now` / `Unlock my service` are grey
  (nothing is destroyed — BUTTON_RULE's own settling line for Unlock).
- Guards: `every-supplier-action-is-a-button.test.ts` sweeps the file per
  component and now also refuses a hand-classed `SubmitButton` and a pill-shaped
  `<Link>`/`<a>`; `today-is-rows.test.ts` renders one fold of every kind and
  holds "an `.ab` pill, an icon, its word" as a property plus the tone of each of
  the 22 controls. Two pins were re-aimed with their forms
  (`lib/the-date-change-reaches-the-supplier.test.ts`,
  `lib/answers-desk.test.ts` — the latter could no longer see a submit).
- `/dev/supplier-lab?s=folds&open=<kind>` draws every fold.

### S-PR2 — Customers is People · Dates · Money; People is redrawn

- **Three segments, one table.** `?seg=people|dates|money`
  (`customers/anchors.ts`: `customersSegment`, `ANCHOR_SEGMENT`,
  `SECTION_SEGMENT`). Every old link still lands: a redirect stub's `?tab=` and a
  fold's `?open=` name their segment; `customerLandingHref('payday')` now carries
  `?seg=money` (a bare fragment is invisible to the server); a link saved before
  today that names only `#payday` / `#calendar` / `#bookings` is caught in the
  browser (`SegmentHashLander`).
- **People** — one hairline row per customer: avatar · name · event line (type ·
  date · place) · what they asked about · stage pill · one line. "Waiting first"
  + one Filter ▾. Search (≥ 60 %, runs 250 ms after the last key, never rebuilds
  the box) and **Add** live in the frosted thumb row. The heading, the round +,
  the ⋯ menu, Show ▾, the counts line and the per-row dark pill are gone, as the
  plan's table says.
- **One list, not two.** Outside clients are rows here ("Outside" pill, opening
  in place with Remove); kept notes are one quiet row at the end. The second
  customer list, `clients/surface.tsx`, is retired; `/vendor-dashboard/clients`
  and `?open=clients` land on People. "Is it finished?" is asked with the shared
  `rowReadsCompleted` (the retired list used it; the roster used `status` alone).
- **The closed lines moved, and "Nothing to answer" left Today in the same
  change** (answer 3). A booking ask whose window closed, a flagged delay and a
  meeting time that passed are each the customer's own line on People
  (`customers/people-row.ts`, `lib/vendor-closed-lines.ts` — the desk's own
  predicates). Today now ends at the Shop row.
- **What they asked about.** A row names every category on the couple's one
  inquiry (`thread_service_interests`).
- **Honest reads.** A refused quote read draws "Talking" and no line (never "send
  a quote"); an unread payday draws no money line (never "no plan yet"); refused
  flag reads are said above the list; a failed kept-notes read draws no row.
- **Dates and Money hold the shipped blocks unchanged** until S-PR3 / S-PR4: the
  month calendar, the days-full-per-service tile and the QR codes on Dates; this
  month's payments, the bookings list, the payday timeline and the Quotes /
  Contracts folds on Money. The "Messages" tile is gone (the envelope has the
  count and the door).
- `/dev/supplier-lab?s=people` (`&v=more`, `&v=unread`, `&v=empty`) draws the
  real components on sample data.

No migration. No server action added (the Add sheet posts the shipped
`importExternalClient`; Remove posts the shipped `removeBlock`).

SPEC IMPACT: None to the plan's decisions — this builds § 6 rows S-PR1b and
S-PR2 as written. Deviations from the prototype and the questions they raise are
in the builder's report to the controller (the "Done" row's line, the Add
button's words "Add · free" for the shipped "Import · free", where the leftover
blocks sit until S-PR3 / S-PR4); the corpus status file is the controller's to
update.
