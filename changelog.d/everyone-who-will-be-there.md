## 2026-09-15 · feat(invitation): "Everyone who will be there" — the full list, behind a preview

Owner 2026-09-15, on where the whole list lives: *"Both — a preview that opens
the full list."* And on who may read the plain guest names: **"Guests and hosts
only."**

### The page — `/[slug]/everyone`

- **The cast is public.** A wedding prints its entourage; anyone who can open the
  invitation can read it.
- **The plain guest names are not.** They render only for someone the event
  RECOGNISES — a guest carrying their own invitation session for this event, or
  a signed-in host.
- 🔑 **The refusal is a read that never happens**, not a filter afterwards. A
  passer-by's request does not fetch those rows at all: nothing to forget to
  hide, nothing for a later refactor to leak. Same shape `page.tsx` already uses
  for `chaptersOnThisDay`.
- The not-recognised state says why as **a fact about the reader**, not an
  accusation — a relative opening a forwarded link is not doing anything wrong.
- `robots: noindex` either way. Even the cast is a list of real people's names.

### The door — on the invitation

The section now takes `previewHref`: the first two groups, then **"See everyone —
52 more →"**. It counts PEOPLE, not groups, because that is a promise the reader
can check on arrival. **No door when nothing is hidden** — a link to the list you
are already reading is a dead end with good manners.

### One component draws both

The full page passes no `previewHref` and gets the whole cast. Two renderers
would drift into two different-looking entourages on one invitation.

### `ENTOURAGE_COLUMNS` — named once

`_lib/loaders.ts` forbids cross-route imports of its cached loaders, so the new
route runs its OWN query. The column list is the one thing that must be identical
between them, so it now lives in `lib/entourage.ts` and both `.select()` it.

### 🔴 My own guards failed their sabotage — twice — and I only found out by running it

1. **The privacy gate had no test at all.** The page's docblock cited one *by
   name* that I had never written. Replacing `if (recognised)` with `if (true)`
   — opening the guest list to every passer-by — left the whole suite GREEN. A
   comment claiming a guard exists is worse than none: it stops the next person
   looking. `only-guests-see-the-guests.test.ts` now exists and goes red.
2. **The column check could not say WHICH read drifted.** The new page runs two
   queries; `src.includes(...)` is satisfied by either. Swapping one back to its
   own literal passed. It now COUNTS per file — 1 in the loader, 2 here.

🪤 And both first fixes went red against *correct* code, because the search
window included the import list, where the function names appear before the gate.
**A window that includes the imports cannot see control flow.** Two tests, two
windows, each facing what it actually asserts.

### ⚠ A guard caught a `'wedding'` I copied in

`?? 'wedding'` came from `/pabuya`, which is grandfathered onto the vocabulary
allow-list. Defaulting an unknown type to "wedding" is how a wake gets a
wedding's surfaces. Now resolved from the event id via `resolveProfileByEvent` —
no nullable column to fall back FROM, and `event_type` is not selected here at
all.

SPEC IMPACT: new public route + the owner's disclosure ruling, logged in
`DECISION_LOG.md`.
