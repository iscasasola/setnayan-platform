## 2026-08-20 · change(explore): one bar goes anywhere, the other narrows what is on screen

Owner 2026-08-20, pointing at the marketplace's own search box on `/explore`:
*"why is there a search bar for this? shouldn't this be same on the top search
bar?"*

**Measured: both were on screen at once, ~140px apart, and both said
"…vendors"** — the shared top bar reads *"Search events, people, vendors"* and
this one read *"Search vendors, services, or places…"*. Two controls promising
the same noun read as one control drawn twice, which is exactly what he saw.

### They are not the same job, and merging would lose data

- The **top bar** goes ANYWHERE — your events, your shop, your groups, plus one
  row that searches Setnayan publicly.
- The **in-page box** NARROWS the results already on screen. It suggests real
  taxonomy folders with their counts (so a person lands somewhere that exists),
  and its `preserve` prop carries **seven** filter values through a suggestion
  pick — city, sort, verified-only, match-event, event type, folder scope and
  focused mode. Handing this job to the top bar would silently drop every one —
  and the *"1 filter applied"* chip beside it is counting exactly those.

**So the fix is the WORDS, not the control:** `Search vendors, services, or
places…` → **`Narrow these results…`**.

⚠ The **hero** variant is deliberately untouched: it is the marketplace's own
front door with no results behind it yet, so there is nothing to narrow, and
its examples name concrete things rather than competing for a category noun.

### ⏭ Flagged, NOT done — the noun itself is a real project

Search is described **four** different ways across the app, and two words are in
use for the same people:

| where | words |
|---|---|
| top bar, signed in | Search events, people, **vendors** |
| top bar, signed out | Search **suppliers**, stories and guides |
| marketplace in-page | *(this PR)* Narrow these results… |
| marketplace hero | Search photographers, caterers, livestream… |

Measured before deciding: ~20 files carry a visible `Vendors` label and 108
mention `supplier`, and `nav-registry-defaults.ts` ships **both** `Vendors` and
`Marketplace` labels. **Renaming the noun is a project, not a copy tweak, and
doing it in the search boxes alone would create fresh inconsistency** — so this
PR removes the COLLISION without opening the rename. The 2026-08-15 ruling
settled the name of the PLACE (*Marketplace*); the name of the PEOPLE has never
been settled.

🛡 `two-bars-two-jobs.test.ts` — three assertions, each independently
mutation-proved: restoring the old string fails 2, dropping "Search" without
naming the job fails 1, and making both boxes promise the same noun fails 1.
🪤 Its first cut matched the WRONG `isHero ?` ternary — the className branch —
and failed with a message about Tailwind classes. **Anchor to the prop, never
to the condition.**

SPEC IMPACT: None (copy + one guard; no SKU, price or schema change).
