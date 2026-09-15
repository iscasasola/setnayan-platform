## 2026-09-15 · fix(social): a wake's recap is never posted to Setnayan's own Facebook and Instagram

`/[slug]/recap` already refuses a solemn event in **both** arms — the metadata arm so it is not
indexed, the render arm so it is not served (`notFound()`).

`isRecapSocialShareAllowed` did not ask at all. It checked the couple's opt-out and the landing
page's visibility, and nothing else. **So the same recap the PAGE refuses to show could be composed
for Setnayan's own Facebook Page and Instagram Business account** — a bereaved family's farewell,
marketing the platform.

Nothing upstream would have stopped it:

- `recap_autopost_enabled` defaults ON (`val !== false`) and **is TRUE in production**, measured;
- the couple's per-event opt-out defaults to **allowed** (NULL);
- `publishRecap` does not consult the register either.

⚠ **Nothing was ever posted.** Production holds **0 solemn events** and **0** `event_recap` social
posts. This is a gate closed before the first wake, not a leak cleaned up after one — which is the
only reason it is a quiet fix rather than an incident.

The gate now asks `eventWordsFor(...).solemn` — **the same resolver the recap route uses**, not a
second list of solemn types. Two lists is how one of them goes stale without anybody noticing, and
`lib/a-sample-says-what-it-is.ts` already keeps a deliberately separate hand-list for the static
sample fixtures with its own guard explaining why that one is allowed to be different.

### The second property is the one a reviewer would miss

`a-wake-is-not-content.test.ts` pins two things:

1. the gate **consults** the register;
2. the read **selects `event_type`**.

🔑 Without (2), (1) is theatre. The column would arrive `undefined`, the register would resolve the
default profile, `solemn` would be false, and every wake would pass a gate that appears to ask.
**A check on a field the query never fetched fails open and reads as a check.**

⚠ **A source-text guard is the weak kind, used knowingly** — the same choice, for the same reason,
that `a-sample-says-what-it-is.test.ts` makes on the recap route: the gate takes a live admin client
and `eventWordsFor` resolves a profile from the database, so there is no pure seam to call. It would
pass a gate that reads `.solemn` and ignores it. **It exists to stop the gate being deleted — which
is how the page's own refusal came to be doubted — not to prove it works.**

🛡 Mutation-checked, counts printed so each sabotage is proven to have landed, and the two isolate:

| mutation | landed | result |
|---|---|---|
| remove the `.solemn` line | 1 → 0 | test 1 **RED**, test 2 green |
| drop `event_type` from the select | 1 → 0 | test 2 **RED**, test 1 **still green** |
| untouched tree (control, before and after) | — | 2 pass, 0 fail |

The second row is the whole point: the failure that would otherwise ship is a gate that asks a
question about a column it never fetched, and only property (2) can see it.

SPEC IMPACT: None — this extends an existing owner decision (a solemn event's recap is not shown)
to the surface that had not been told about it.
