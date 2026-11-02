## 2026-08-20 · feat(events): removing a celebration takes its photos, and the screen says so

Two owner instructions, same press.

**1 · THE FILES GO.** Asked directly what should happen to the photographs when a
couple deletes their own celebration, the owner ruled: **delete them too.**

🔑 **THIS EXTENDS THE PHOTO LOCK, IT DOES NOT REVERSE IT.** *"again. not delete.
just compress"* and *"we keep it for life"* both govern **retention** — what time
may do to photographs nobody asked us to remove. They are the promise that a
couple's memories never quietly expire. They were never a ruling about a couple
deliberately deleting their own event, which is the one case they did not cover.
`papic-fullres-drop.ts` is untouched.

Until now the photo ROWS cascaded and the FILES stayed — the worst of both, since
the job that compresses them finds its work by reading rows that no longer exist.

**2 · THE SCREEN SAYS SO BEFORE THE PRESS.** Owner: *"give them the information
that you will also lose your photos and information of the event permanently."*
The confirmation now ends: **"Your photos and everything about this celebration
are deleted for good — you can't bring any of it back, and neither can we."**
Deliberately separate from the counted line above it: a count reads as an
inventory, something you could imagine asking us to restore. *"Can't be undone"*
is a promise about the button; this one is about the photographs.

### The rules that make the sweep safe

- 🔒 **PINNED TO THE MEDIA BUCKET — a boundary, not a filter.** The other four
  hold things this action has no ruling to destroy: chat attachments (owner ruled
  **KEEP** the same day), signed supplier contracts, the couple's paperwork scans,
  suppliers' government IDs. A stored ref is just a string; if one ever pointed
  outside `media`, the sweep declines rather than obeys.
- **BY KEY, NEVER BY PREFIX.** Every object is named from a key on a row. An
  eventId-shaped prefix sweep would also reach dispute evidence, paperwork and
  payment proofs, which sit under the same event id in other buckets.
- **ALL SEVEN papic keys**, not just the original — the display, thumbnail,
  poster, tile, wall-safe and web-clip copies are each a fetchable address for
  the same photograph.
- 🪤 **COLLECTED BEFORE THE DELETE.** The keys live on rows that cascade; after
  the delete there is nothing left to say which objects were theirs.
- **A failed read is not an empty one.** The collector returns `null` on failure,
  and nothing is reported as swept.
- Best-effort by contract: the event is already gone, so a failed file delete
  leaves an orphan, never lost data, and must not turn a successful removal into
  an error.

⚠ **PATH-INCOMPLETE BY CONSTRUCTION, and named as such.** Postgres cannot call an
HTTP API, so this half lives in the server action — and prod still grants
`authenticated` DELETE on `events`, so a delete issued straight through PostgREST
skips it and orphans the objects. The in-database half is the trigger; this is
the half a trigger physically cannot do.

**Also:** the ₱499 order stranded by the owner's own delete (S89O-GCR6BDC4Z6) was
**cancelled directly in production** at his instruction, with an audit note. It
was `submitted`, 0 payments, 0 receipts — nobody had paid anything.

**Guards:** 7 assertions, all mutation-checked with counts printed before → after.

🪤 **ONE WAS DECORATION AND THE MUTATION CAUGHT IT.** The "collected before the
delete" ordering test matched the bare identifier `collectEventMediaRefs` — which
the **import** at the top of the file satisfies. Deleting the actual call left the
import behind, the index still resolved, still sorted before the delete, and the
guard stayed GREEN while every file would have been orphaned. Re-anchored to
`await collectEventMediaRefs(`. **An import is not a call.**

SPEC IMPACT: `DECISION_LOG.md` — row added 2026-08-20 (photos deleted on a
couple's own delete; chat files kept).
