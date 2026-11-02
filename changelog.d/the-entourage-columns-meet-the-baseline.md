## 2026-09-15 · chore(guards): baseline the reads that predate ENTOURAGE_COLUMNS

`ENTOURAGE_COLUMNS` naming ten columns made the duplicated-rule guard flag **230
facts across 39 read sites** — not 230 new selects, but 230 existing ones newly
measured against a canonical list that grew. Regenerated so the owner's live work
can land.

⚠ **A baseline is a promise to look later, so this one was read before it was
written.** Triaged first:

- **36 of the 39 sites select a guest's NAME without selecting all five of its
  parts.** None of them can print *"Atty. Arnaldo M. Espinas"* — they print
  *"Arnaldo Espinas"*. That is the exact defect #5492 fixed on the invitation,
  standing on 36 more surfaces: the seat pass, the check-in desk, the QR route,
  save-the-date emails, the guest columns queue, the story desk, the Papic
  magazine, the public API.
- **3 are narrow reads** that select no name at all and correctly want none of it.

🔑 **The guard did not just block a merge — it produced a map of every surface
that cannot print a whole name.** That list is the row; baselining without
reading it is what turns a guard into a formality.

✅ **The 9 REMOVED lines were checked too**, not waved through: seven were
`HERO_MONOGRAM_COLUMNS` omissions on `/api/og/realstory-slug` that another
session has since FIXED, plus two header counts. A baselined omission that gets
fixed should leave the baseline — that is the file working.

✅ Every one of the 232 added lines is `ENTOURAGE_COLUMNS`; nothing else was
swept in.

SPEC IMPACT: None.
