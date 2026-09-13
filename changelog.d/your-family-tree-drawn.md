## 2026-08-31 · feat(people): draw the connection tree — kinship-derive finally reaches a screen

`apps/web/lib/kinship-derive.ts` shipped on 2026-07-31 carrying the hardest
reasoning in the product — the Philippine courtesy model, where a tito/tita
arises TWO ways, by blood (a parent's sibling) and by courtesy (a friend's
parent), the same word for two different facts. It then sat with **no consumer**:
`git grep -l kinship-derive origin/main -- 'apps/web/**'` returned the module and
its own test and nothing else. The derivation ran for nobody.

It now renders on the People surface, per the spec's own instruction (§6 of
`Kin_Graph_Adoption_and_Deltas_SPEC_2026-07-30.md`: *"Do not build a new page —
the People surface exists"*). Three files:

- `lib/kinship-tree.ts` — pure. Arranges `DerivedKin[]` into the three layers the
  owner named (family · ritual · courtesy). The volume rule lives here and is
  ONE-DIRECTIONAL: courtesy is the only layer that ever collapses, because it is
  the only one that grows without bound. Blood and ritual have
  `collapseAfter === null` by construction. This is the owner's 2026-07-31 ruling
  in code — *"That makes it a RENDERING problem (blood must not be crowded out),
  not a rule problem."* No hop cap and no closeness filter were added to
  `kinship-derive.ts`; it is untouched.
- `lib/kinship-read-core.ts` — the ego-scoped walk over CONFIRMED edges only.
- `app/dashboard/(account)/people/_components/connection-tree-section.tsx` — the
  screen. Blood, ritual and courtesy are distinguished three ways (layer, chip
  tint, and the `via` line in words) so the distinction survives monochrome and a
  screen reader, not by colour alone.

### Why the read needs service-role rights, and what bounds it

`person_connections_select` lets a user read only edges they are an ENDPOINT of.
Every extended relation is at least two hops out — a tita is (my parent ↔ their
sibling), an edge I am not party to — so an RLS-scoped read derives nothing but
the ritual layer and the screen would tell someone with a large family they have
none. Four bounds are documented in the module header: the walk is ego-scoped and
only expands along edges already collected; `status = 'confirmed'` is applied at
every query so an unconfirmed edge cannot even widen the frontier; the walk is
three hops because that is the derivation's REACH (pinsan and balae are distance
3), not a cap on it; and **names never come from the service-role client** — they
come from `visible_connection_names` on the user's own client, whose WHERE clause
is the owner-signed-off rule of 2026-07-05. Widening the walk therefore cannot
widen who gets named. A person the rule does not permit renders as their kin word
with no name, per spec §6 (*"placeholder, never a name"*).

Sex is deliberately NOT read, so every label renders paired ("Tito/Tita").
`kinship-derive.ts` documents that as a first-class case; reading a
consent-stamped column (OD6) about a third party to prettify a word is not a
trade this makes.

A refused read reports `measured: false` and renders "we couldn't work out your
tree just now", never "you have no relatives" — the `MeasuredGuests` precedent
(`guests-read-is-honest.test.ts`), whose rule is that the measurement must reach
the RENDER.

### Proof

`lib/kinship-tree-is-honest.test.ts` — 14 tests, driven through the real
functions against a stubbed Supabase client that filters BY INCIDENCE (returning
every edge on hop 0 would make "pinsan is distance 3" pass without the walk ever
expanding). A person with both a blood tita and a courtesy tita sees both, in
different layers, with different `via` text. A draft edge and a pending edge
appear nowhere — asserted through the read as well as the derivation.

The ring is CHUNKED at 100 ids per request. The `in.(…)` filter is a URL query
string, so an unchunked second ring — thousands of ids, because courtesy kin are
unbounded by design — is not a slow request but a 414, and therefore an UNMEASURED
tree. Unchunked, the read would have failed for exactly the people with the most
family to draw.

Nine mutations, each with the occurrence count printed before → after:
blood made collapsible 1→0 (2 fail) · layer order reversed 1→0 (1 fail) ·
name rule bypassed to the person id (1 fail) · confirmed-only guard removed 1→0
(1 fail) · `UNKNOWN_KIN` → `EMPTY_KIN` 3→0 (3 fail) · walk shortened to 2 hops
1→0 (1 fail) · courtesy derivation deleted 1→0 (4 fail) · chunk loop truncated
to its first request 1→0 (1 fail) · `ID_CHUNK` raised past the URL cap (1 fail).

⚠ **THIS IS LIVE ON MERGE.** `NEXT_PUBLIC_PEOPLE_CONNECTIONS=1` in production
(measured, P0-b 2026-08-30), so this is not ship-dark. Production held zero
`person_connections` rows on 2026-08-30 — nobody has used the flow yet, so the
tree renders its empty state until they do.

SPEC IMPACT: None. This implements decisions already locked — OD1 (it is a
CONNECTION tree, not a family tree), the 2026-07-31 unbounded-courtesy ruling and
its "blood must not be crowded out" consequence, and the §6 rendering sketch. No
decision is changed, so no corpus edit is due.
