## 2026-08-06 · fix(admin,vendor): two lists that lost a member — the Samahan tab and the segments doorway

Both are P1 from the 2026-08-06 cleanliness register. Both are the same disease:
**a fact kept in more than one place, where one copy fell behind.**

### 1 · The admin Samahan tab threw on every click

The Ugat console renders nine entity tabs. The server action that fetches their
rows kept its own allow-list — **with eight**. `communities` was missing, so
pressing **Samahan** threw `Unknown table`, or left the previous table's rows
sitting under the Samahan heading, which is worse: it looks like data.

**There were THREE hand-typed copies of those nine keys** — the `UgatTableKey`
union, `TABLE_META` (the tabs), and `VALID_TABLES` (the allow-list).

Now one: `UGAT_TABLE_KEYS`, a runtime tuple. The type derives from it, the
allow-list *is* it, and the tabs are built by mapping it over a
`Record<UgatTableKey, …>` of labels — so **TypeScript refuses to compile** if a
table has no label, and a table can only be added in one place.

**Sabotage-verified:** removing `communities` from the tuple produces 4 typecheck
errors immediately. The guard is the compiler; it cannot rot.

### 2 · The host's segments page had no way in

`/vendor-dashboard/activities` ("Your segments" — the host/MC catalogue) shipped
2026-07-28 with **no doorway anywhere in the repo**: no `<Link>`, no
`router.push`, no `redirect`, no nav-config entry, no route-builder, no registry
key. Its only two mentions outside its own folder were docblock comments in
`/vendor-dashboard/lines`.

A host wrote the parts of the night he runs — his ceremony intro, his game, his
toast — into a page he could open only by typing the URL.

🔑 **The tell was the ASYMMETRY, not the absence.** Its deliberately-identical
sibling `/vendor-dashboard/repertoire` (both files say so) had **five** doorways.
One of a matched pair having none is the signal; a lone unlinked route usually is
not — this repo has seven that are deliberate redirect stubs.

Added to the shop link list beside its twin, and to the nav's `activeMatch` so
the tab lights while a host is standing on the page.

### The guards

- **Ugat**: the compiler, as above.
- **Segments**: `has-a-doorway.test.ts` — deliberately narrow. A blanket "every
  route must be linked" check would fire on the seven redirect stubs, on
  deep-link-only QR routes, and on dynamic segments — all correct, all unlinked.
  Three first-draft guards over-fired earlier today (16 flagged / 1 real,
  13 routes / 0 real, 10 statuses / 0 real), so this one asserts a single pair
  that must stay symmetric, and fails if either half loses its doorway.
  **Sabotage-verified:** removing the entry fails it.

### Verification

`tsc` exit 0 · all 15 lint scripts pass · **6,729 lib tests pass**.

SPEC IMPACT: None — no schema, pricing or product decision changed.
