## 2026-09-23 · docs(register): the `count ?? 0` sweep — what was built, and what was measured and deliberately left

**SPEC IMPACT: None.** A register entry, not a change.

### Why this exists

A peer reported **231 sites** of `count ?? 0` and asked whether the platform
needed a rollout. It did not. This records the measurement so the next sweep
does not re-find the same items and call them bugs.

**Re-measure, never cite these numbers** — the total was already 236 the day
after it was reported as 231:

```bash
git grep -cE "count \?\? 0" -- apps/web
```

### The funnel — every narrowing is a distinction, not a softening

| | |
|---|---|
| `count ?? 0` total | **236** |
| ─ a ROW COLUMN (`r.review_count ?? 0`) — a genuine tally, null *is* zero | 70 |
| ─ a QUERY RESULT's `.count` | 166 |
| ──── tests and comments | 17 |
| ──── on surfaces a customer or supplier sees | 44 |
| ──────── **gates** (`if ((count ?? 0) > 0)`) — a different bug, out of scope | 12 |
| ──────── value-carrying | 32 |
| ──────────── already handled (`error ? null`, `if (!error)`, a `…Measured` flag) | 25 |
| ──────────── **candidates** | **7** |
| ─────────────── **built** | **2** |

🔑 **Four distinct constructs share one spelling** — a row column, a gate, a
plain object field, and a genuine failed-count. Classifying from a regex rather
than from a type is what produced the 231.

### Built

- **`(shell)/explore`** — a failed trusted-review read returned an empty Map, so
  every established supplier was labelled **"New to Setnayan"** to couples.
  Invisible to both parties. Now `null` + "Reviews unavailable".
- **`vendor-dashboard/moodboard-library`** — not a display defect at all: the
  **used** side of a gallery quota. A failed read meant "none used" and **lifted
  the cap**. Now fails closed.

### ⚠ Measured and deliberately NOT built — do not re-open these as bugs

| site | why it stays |
|---|---|
| `dashboard/[eventId]/checklist-actions.ts` `guestCount` | The write is `.update({status:'done'}).eq('status','pending')` — **pending→done only, it never un-ticks**. A failed read skips one auto-tick and **self-heals on the next render**. Nothing the couple did is lost or contradicted. |
| `_components/event-dashboard.tsx` `seatedGuests` → `progress-stages.ts` | `if (seatedGuests > 0)` — the seating milestone is **omitted**, never printed as "0 placed". An omission, not a claim. |
| `invite/date-status-actions.ts` `bookedCount` → `card-record-section.tsx` | `{bookedCount > 0 ? … : null}` — **the render already refuses to print a zero**, with a comment stating the principle: *"a card can have picks to show and a zero here … the product contradicting itself. Show less, never something untrue."* Somebody reasoned this out first. |
| `performance/_components/funnel-preview-card.tsx` | **Not this defect.** `FunnelStep` is `{ label: string; count: number }` — a plain typed object. `steps[0]?.count ?? 0` guards an empty array, not a failed query. |
| `vendor-dashboard/layout.tsx:174` | `error ? 0 : count ?? 0` **looks like the worst case and is reasoned**: it logs, and the zero makes the badge *omit* rather than fabricate. A badge that disappears is not a claim of zero. |

### The rule the sweep produced

**Never fail-soft to a value that is also a valid success value.** `[]`, `{}`, an
empty `Map` and `0` are all legitimate results, so a consumer cannot tell failure
from a true empty — not because it forgot to check, but because the information
was destroyed at the boundary. Return `null`.

⚠ **Its limit, so it is not oversold:** it catches a fallback that is
*indistinguishable*, not one that is *wrong*. A loader returning `null` whose
caller writes `?? 0` still fails. The rule moves the decision to the consumer; it
does not make the consumer right.

🔑 **And a severity judgement made at the read site is not a conservative guess —
it is a different question.** Walking each value to its render moved findings in
BOTH directions: `funnel-preview-card` left the list entirely, `explore` became
the worst finding of the day, and `moodboard-library` turned out not to be a
display defect at all. The read site carries no severity information.
