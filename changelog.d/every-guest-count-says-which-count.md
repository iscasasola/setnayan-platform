## 2026-09-09 · feat(vendor-dashboard): every guest count says which count it is, and the target date says who else wants it

Two changes on the supplier's conversation page.

### B · Which guest count is this?

A thread stores TWO headcounts and both are true: `pax_at_inquiry` — what the couple asked with,
what a quote is written against — and the live count they are planning for now. The page showed
both, in different places, and only one of them said so. The header read *"planning for ~170
guests · was 150 at inquiry"*; the accept card, four hundred lines away, rendered a bare
**"150 pax"** on the same screen. The owner caught it on a drawing.

**Money rides on it.** A supplier quotes against one number and is paid against the other, which is
why a *"guest count changed — accept the new total or hold your price"* card already exists.

`apps/web/lib/guest-count-provenance.ts` (new, pure) formats a count with its provenance. Surfaces
pick a BASIS — never a sentence — so a fifth surface cannot invent a sixth wording:

| surface | now reads |
|---|---|
| header | `Planning for ~170 guests · was 150 at inquiry` |
| accept card chip | `150 pax · at inquiry` |
| quote builder header | `Sized to their request · 150 pax at inquiry · 8h · their plan now says 170` |
| customer rail, Guests row | `~170 now` / `150 at inquiry` |

⚠ **A bug found on the way, and fixed.** The shipped header only named the inquiry count when it
was SMALLER (`pax_at_inquiry < headerPax`). A couple who *cut* their guest list saw the second
number silently vanish — the direction that costs a supplier money. The helper names it whenever
the two differ, either way.

⚠ **The quote seed is unchanged on purpose.** The builder still opens sized to `pax_at_inquiry`;
re-seeding it from the live count would quietly move the number a supplier prices against. It is
now *told* the live count so its header can name both. (The binding prototype's booked frame shows
the field pre-filled at the live count — flagged for the owner rather than changed here, because it
moves money.) Neither number is ever dropped: the quote was made against the old one, and hiding
that is how two numbers silently diverge.

### C · Who else wants this date

Owner: *"Target date for vendors will show who are also inquiring for that day so they do not need
to browse their calendar?"* On the accept card and on the customer rail's Target date row:

> **18 Dec** — **2** other couples are asking you about this date · you hold **1** booking that
> week. Accepting does not book it.

`apps/web/lib/vendor-date-demand.ts` (new). Two batched `head: true` counts — never one per row and
never one per day of the week — read with the admin client this route already holds, scoped by a
`vendor_profile_id` the session has proven. No RLS weakened, no new SECURITY DEFINER function.

**🔒 Three boundaries.** Counts, never names — nothing the reader selects could carry another
couple's identity. Supplier side only — the rail marks the line *"Your pipeline only — the couple
never sees this line."* and a guard fails if anything under `app/dashboard/` reaches the module. And
the couple-facing *"N couples inquired for your date"* line on the marketplace bench is untouched
and is not treated as precedent.

**🔑 RULE 0 — what already exists, and why neither piece could serve.** Recorded in the module so
the next session does not re-derive it:

- `get_vendor_same_day_bookings(p_event_id, p_day)` returns this shop's other bookings on a given
  day and its day parameter does generalise — but **step 2 of its body requires the caller to be
  BOOKED on the event on screen** and returns `'[]'` otherwise. The surface this line is for is the
  accept card of a PENDING inquiry, where no booking exists by definition, so it answers `[]` to
  every caller who needs it. It also returns `display_name` and `slug`, which the counts-never-names
  boundary forbids rendering. It is not called and not modified — its booked-gate and its absent
  `vendor_team_members` union are both load-bearing.
- `vendor_whitelist_pressure(p_thread_id)` is closer still and this page already draws it — but it
  counts a NARROWER set (accepted-and-not-yet-locked threads, the whitelist a tier ceiling refuses
  on) and returns no rows at all whenever the ceilings are switched off platform-wide. The owner's
  question is true whether or not caps are enforced. The two lines coexist and say different things.

### Guards

`lib/every-guest-count-says-which-count.test.ts` + `lib/who-else-wants-this-date.test.ts`
(36 tests with `customer-event-summary.test.ts`, exit 0). MUTATION-TESTED — thirteen mutations
applied to real source, each printing anchor occurrences before/after; all thirteen go RED and the
suites restore to 36 pass / exit 0. Including: the header's provenance stripped, the accept chip's
basis label dropped, the old "only when it grew" bug reintroduced, a tilde put on the quoted count,
a fifth surface reading the column raw, the rail's note blanked, the demand read selecting a name,
plural agreement lost, an empty diary announcing itself, the couple's page importing the module, the
week starting on Sunday, the quote builder losing its label, the rail no longer fed the inquiry
count.

⚠ One assertion was **decoration until the mutation proved it**: `assert.match(makerSrc, /pax at
inquiry/)` passed while one of the quote builder's two header branches had lost its label — a match
anywhere in the file satisfied it. It is now asserted by occurrence count (2), and the same mutation
goes red.

The guest-count copy in the customer rail moves from `~230 planning` to `~230 now` (with `150 at
inquiry` beneath it) per the binding design; `customer-event-summary.test.ts` updated with the
reason.

Design is binding: `prototypes/chat_interface_v4_2026-09-09.html`, the supplier frames — ported, not
redrawn.

SPEC IMPACT: None — both are the shipped design's supplier frames being built, not new decisions.
The quote-builder seed question is flagged to the owner in the PR body rather than decided here.

### ⚠ Caught by CI, and by a guard this repo had already paid for

The first push used a bare `events!inner` on both reads. `the-cure-was-already-written-down.test.ts`
failed it: **PostgREST refuses that embed from `event_vendors` with PGRST201** — one direct foreign
key reaches `events` and nineteen junction tables also join the two, so it finds many routes and
refuses rather than guessing. Three shipped features had already died silently that way, one of them
*"another couple is holding this supplier on your date"* — a caution never once shown.

🔑 **A count of the foreign keys did not predict it, and was the wrong question.** Production was
asked for the FKs from `event_vendors` to `events` and answered *one*, which read as
"unambiguous" — the ambiguity comes from every OTHER table that reaches `events`. Verified against
the live REST API instead of reasoned about: bare `events!inner` from `event_vendors` returns
**HTTP 300 / PGRST201**; the FK-named form returns 200. Both embeds now name the junction — the
`chat_threads` one too, which no guard covers and which fails the same silent way — and a new
assertion in `who-else-wants-this-date.test.ts` pins both, mutation-tested in each direction.
