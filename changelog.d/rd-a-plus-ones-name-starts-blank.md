## 2026-10-21 · fix(guests): an unnamed +1 has no name yet — the card, the save, the Excel file, the greeting

Owner, verbatim, on the card of "dally BIR's +1 · TBA": *"Why is the +1 listed as the +1's last name? when there is no last
name yet until we type on it or it is filled up by the guest via RSVP"*; and on the downloaded sheet: *"looking at excel there
are so many +1 without names which shouldn't be listed as such"*.

An unnamed seat is still STORED with its stand-ins (first "TBA", last "+1", Shown as "+1 · TBA" — `first_name`/`last_name`
are NOT NULL and the seat engine, the welcome door, the pass and the prints key on them). Display-only fix (option a):

- `lib/seat-placeholder-words.ts` (new) — the stand-in words, one predicate; `lib/extra-seats.ts` `seatNameAsTyped` /
  `plusOneNameSave`.
- Guest card: an unnamed +1's First, Last and Shown as draw EMPTY with "Add" (no "Required"); its sentences say
  "dally BIR's +1", never "TBA". Title/list row keep "dally BIR's +1 · TBA" (the seat label ruled 2026-09-29).
- `updateGuest`: a +1 seat's name is decided by `plusOneNameSave` — an empty or stand-in box never writes a stand-in as a
  typed name; a typed name is written, the "+1 · TBA" Shown as cleared, the seat stamped named
  (`plus_one_name_confirmed_at`); emptying a named seat is refused as before.
- Excel ("Download as Excel"): an unnamed +1 is not a row (their guest's "Their guests (+)" counts it); a named +1 sits
  directly under their guest with a new read-only "Guest of" column; no cell holds "TBA"/"+1" as a name; people = rows with
  no "Guest of" + every "Their guests (+)" = the list's rows.
- Invitation greeting never says "TBA"/"+1" ("Hi!"); a +1 named "Ben" reads "Ben", never "Ben +1"
  (`guestDisplayName` / `guestFullName`).
- Guard `lib/an-unnamed-plus-one-has-no-name.test.ts` (9 tests, 7 sabotages RED).

SPEC IMPACT: corpus `DECISION_LOG.md` — one AS-BUILT row (2026-10-21, "AN UNNAMED +1 HAS NO NAME YET") recording the Excel
row rule and the "Guest of" column.
