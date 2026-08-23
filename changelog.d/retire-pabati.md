## 2026-08-23 · chore(papic): retire Pabati into Papic

Owner, 2026-08-21: *"we do not need pabati. retire it because it is part of
papic."* This **supersedes** the change made hours earlier the same afternoon,
which made Pabati FREE on his earlier instruction. Free was the right answer to
the question asked then; retire is the answer to the question asked after it.

**What a person sees.** The ₱1,299 five-second video guestbook is gone — its own
page, its recorder on a guest's invitation page, its card on the couple's day-of
screen and its section on the finished story page. A guest is still asked to
leave the couple a video greeting; it is now one of the Papic challenges, and it
records the way everything else in Papic records.

**Safe by measurement, not by assumption** (queried in production 2026-08-23):
0 greetings ever recorded · 0 times ever bought · 1 challenge-library row of that
kind out of 631, against 284 that already ask for a clip · 0 Drive-copy rows of
that artifact type.

**Both halves, because free and retired are the same catalog row and opposite
products.** The row stays deactivated AND the `FREE_FOR_ALL_SKUS` entry is
removed — a free entry for a SKU whose surface, API, table and RPCs are deleted
would keep asserting that a feature nothing implements is switched on for
everybody. `lib/llms-txt.ts` drops it from `REQUIRED_RETAIL`, from its prose line
and from the hand-typed fixture in the same change: a retired code the document
still advertises throws and drops the whole AI/GEO surface to its 603-byte stub,
which has happened in production once already.

- ~60 files. Deleted: `app/pabati/`, `app/api/pabati/`, `lib/pabati.ts`, the
  offline handler + its registration, the guest recorder and its mount, the
  day-of card, the recap section and its `videoGuestbook` order key.
- `CaptureKind` loses its third member and `pabatiActive` stops being threaded
  through seven files.
- Migration `20271159146115`: converts the greeting row to `capture_kind='clip'`,
  narrows the `capture_kind` CHECK so a later seed cannot reintroduce a gated
  row, drops `pabati_clips` + `pabati_record_clip` + `pabati_event_owns_pabati`,
  deactivates the catalog row, re-seeds `bundle_components` without it, and
  narrows the Drive artifact-type CHECK.
- 🔒 `pabati_record_clip` was granted EXECUTE to `anon` — an anonymous write path
  into a table that no longer exists. Dropping the function closes that grant;
  both lines come out of `tests/db/anon-rpc-surface.baseline.txt`.
- ⚠ `ensure_papic_board` loses a parameter, so its `.rpc()` call changes in the
  same PR. PostgREST resolves an RPC by its exact set of named arguments — a call
  naming the old argument matches nothing and is refused, not thrown, and the
  only symptom would be a board that silently never materializes.
- 🔒 `pabati` moves from the generated half of `lib/reserved-slugs.ts` to the
  hand-typed half (the `live` precedent). A shop address is immutable once
  minted, the word is still a Setnayan taxonomy leaf a shop advertises in
  production, and a retired word that stops being reserved is claimable forever.
- Not touched, deliberately: the Papic shot ladder (owner-locked — features are
  free, shots are the product), `PAPIC_ADDON_THANK_YOU`, and the `greeting`
  category with its 50 clip challenges, which are the replacement.

**Guards.** `lib/kwento-is-free.test.ts` gains the mirror-image test — a
retirement takes every half or it does the opposite — and the two challenge
tests now assert the un-gating rather than the gate. Eight mutations, each one
measured by occurrence count before → after, all red. The migration was
dry-run against the production database inside a rolled-back transaction first,
because the PGlite replay runs as superuser and cannot catch a permissions
problem.

🪤 One old assertion was **vacuous** and is rebuilt: "Pabati inactive → #5 is
skipped" ran on a ten-slot board where #5, being unranked, could never have
boarded whatever the flag said. And the effort-cap test lost the only authored
list long enough to reach its own limit, so the limit is now proved against a
pack built to exceed it rather than quietly re-expected downward.

SPEC IMPACT: Yes — `DECISION_LOG.md` (2026-08-23 row) and the Pabati references
in the corpus primer. Pabati is removed from the product; the greeting survives
as a Papic clip challenge.
