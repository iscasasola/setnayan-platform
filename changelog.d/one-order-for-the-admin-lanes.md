## 2026-08-25 · fix(admin): the queues are ranked one way, and a superseded map says so

W6 item 2 — the cleanliness findings 4–14 of 2026-08-06, **re-verified before
touching anything**. Most had moved.

**FIXED · finding 5 — two admin screens ranked the same queues in OPPOSITE
orders.** Measured on `origin/main` a8f8601: two `LANE_ORDER` constants, neither
aware of the other. The triage feed led with `money`; the daily digest email led
with `trust`. Same queues, same person, two answers to "what do I do first" —
invisible because each file was internally consistent. One `ADMIN_LANE_ORDER`
now, living beside the lane TYPE so a fifth lane cannot be added without meeting
the order it will be shown in.

⚖ **Trust leads, and it is a clock argument not a taste one.** `trust` is the
only lane carrying a statutory deadline — RA 10173 erasure requests, disputes,
recourse. A compliance deadline missed is not recoverable; a payment confirmed an
hour later is. Moving it is an owner call, not a tidy-up, and a test says so.

🔑 **THE FINDING SAID "TWO ADMIN SCREENS". THERE WERE THREE.** The new guard —
which derives its subject list by walking the tree — found a private copy in
`app/admin/work/page.tsx`. It is a MEMBERSHIP set, not an order, so it never
disagreed about ranking; it would simply have refused `?lane=<a fifth lane>` on
the day a fifth lane was added, silently, on a stale bookmark.

⚖ The two lane LABELS still differ on purpose ("Trust" on a compact chip, "Trust
& recourse" in a line of prose). Two densities, one meaning — now PINNED, because
an unpinned deliberate pair is indistinguishable from drift to the next reader.

**FIXED · finding 7 — an old icon/route map still shipping beside its successor.**
`lib/route-meta.ts` (274 lines) has ZERO importers anywhere, and
`lib/nav-registry-defaults.ts` calls itself "the route-meta successor". Its
docblock said *"additive (nothing imports it yet)"* — which reads as a file
waiting to be adopted rather than one that was overtaken, and that sentence IS
the harm: it invites the next reader to change a glyph and wonder why nothing
moves. ⛔ **Deliberately NOT deleted** — the same findings doc records eighteen
files parked on purpose "each saying so in its own docblock", and notes that both
of that day's largest deletion recommendations were wrong (one would have deleted
a 4,100-line live wizard). Correcting the sentence removes the harm at zero risk.

**CLOSED AS ALREADY FIXED, not built:**
- **4** — saving an event type no longer strands its website. The save REFUSES
  with a named message (`surfacesStrandedWithoutWebsite`), citing this very item.
- **6** — the "controls nothing" marketplace switch has **7** non-test readers
  now and gates four separate computations.
- **14** — not reproducible: the only DB override table (`nav_slot_override`)
  holds **zero rows** in production, and no photo-count setting exists on
  `platform_settings`.

**NOT TAKEN, and named rather than silently skipped:** findings 8–13 are all P3
("correct today, wrong on the next edit") duplicate-definition items. Each is a
separate merge with its own correctness argument; none is reachable by a person
today.

Guard `lib/admin/one-order-for-the-lanes.test.ts` — subject list derived by
walking `app/` + `lib/` and floored. 4 assertions, 4 mutations, all measured, all
red. 🪤 M1's first probe counted a LINE rather than a POSITION and printed 1 → 1
on a sabotage that had landed; re-measured with a probe that parses the array.

SPEC IMPACT: None.
