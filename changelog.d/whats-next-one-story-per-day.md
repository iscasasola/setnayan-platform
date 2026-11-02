## 2026-08-22 · docs(register): "one story per day" joins the what's-next register

Owner: *"add this to what's next so we can plan it along with the other what's
next."*

- NEW `WHATS_NEXT_One_Story_Per_Day_2026-08-22.md` — the full contract: the
  defect walked as the owner's own journey, the two-things table, the six PRs
  already shipped, four `[OWNER]` decisions, four engineering items, and the
  seven traps this stream already paid for.
- `WHAT_IS_LEFT.md` — a new group 10 pointing at it, plus a line in "Where to
  start" saying group 10 is mostly the owner's, not engineering's.

⚠ **THE CORPUS INDEX ROW IS OWED AND I COULD NOT WRITE IT.** From this session
the spec corpus was readable for `CLAUDE.md` only: `ls`, `head`, `git` and the
Read tool all returned `Operation not permitted`, and **appending to an existing
file was refused** — while **creating a new file succeeded**. So the contract was
copied to the corpus root as a new file (verified 9,578 bytes) and
`WHATS_NEXT_INDEX.md` does **not** name it. A session hitting the *"what's next"*
trigger opens that index and will not find this stream until the row is added by
hand.

🪤 **I claimed that append had succeeded, in the file itself, before checking.**
The command failed and I read success from the absence of an error. Caught by
measuring the artefact: `109152 → 109152`, grew by 0 bytes. Both the claim and
the lesson are now written into the contract.

SPEC IMPACT: A new contract file was placed directly in the corpus per the
2026-06-04 direct-edit authorization. The index row remains unwritten — see above.


### Added in review, 2026-08-22

- **Group 7 gains two verified items.** A supplier keeps a deleted celebration's
  booking (deliberately — counts and reviews stay whole) **but their client list
  is built entirely from the event, so a preserved booking has no row and no page
  to open**: they keep the number and lose the client. And
  `vendor_client_notes.event_id` is NOT NULL ON DELETE CASCADE while
  `lib/erasure/coverage.ts` classifies that note as the shop's own data,
  surviving a full account erasure — **the same note survives one deletion and
  not the other.** ⚠ The notes fix depends on the list fix; detaching a note with
  nowhere to read it is a survival nobody can reach.
- **NEW group 9b — two claims in the auto-loaded `CLAUDE.md` are no longer true.**
  "🔴 THE VENDOR CANNOT ANSWER" is **false**: traced end to end to real
  `<form action={…}>` Agree/Decline controls on the vendor dashboard. Its prod
  numbers are stale (14 Papic photos, not 0). Both sit in the ACTIVE block every
  session reads first — the worst place for a stale claim.
- **OWNER ACTION recorded: grant Documents-folder access.** The corpus was
  unreadable from this session, and RULE 0 tells every future session to grep it
  before writing code. Until granted, sessions work from a smaller picture than
  they think they have.
