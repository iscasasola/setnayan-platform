## 2026-10-20 · feat(guests): a note for one guest — written by the hosts, seen only by that guest

Owner, on the guest card: *"we can also add a special note for each guests that will be customized aside from their
role notes."* (DECISION_LOG 2026-10-20 "A NOTE FOR ONE GUEST — WRITTEN BY THE HOSTS, SEEN ONLY BY THAT GUEST").

- **Migration** `20271281265688_a_note_for_one_guest`: `guests.host_note_for_guest` (text, nullable, CHECK ≤ 500).
  Measured on prod (read-only) first: `guests` holds the table-level grant, anon has no policy on it, and an
  authenticated reader sees a row only as its hosts / guest-list helpers or as that guest themself — exactly the
  audience the ruling names, so no column grant is re-cut; one accepted line in the exposure baseline.
- **Guest card**: a new fold "Note for them · they see it" beside the private note (relabelled "Private note · only
  you"), one box typed in place, autosaved through the card's posted form. Written only when the form carries the box
  and only when it changed (`guest-card-merge.ts`), so no other page or open card can null it. Same box on
  `/guests/new`.
- **Guest's Me**: "A note from <the event's names>" + the text, under Your role and above What to wear — only for a
  listed guest reading their OWN invitation (the same gate as Me's four parts), only when set; never on the Maker's
  canvas. Read from the reader's own row (`loadGuestOwnRow`) and nowhere else on the guest page.
- **Reach**: the list's columns (`GUEST_FIELDS` — roster, prints, Excel export) do not carry it; only the card's one
  read (`GUEST_CARD_FIELDS`) does. No `/api/og/*` route, print or export names it.
- **Guard** `app/[slug]/a-note-reaches-only-its-guest.test.ts` (who names the column · the card round-trips it · Me
  draws it only for its own guest, in its place), sabotage-checked.

SPEC IMPACT: None — the ruling is already the DECISION_LOG row named above (corpus commit 842e3b51); no corpus edit.
