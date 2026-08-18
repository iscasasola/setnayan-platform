## 2026-08-18 · fix(guards): bound the switch-writer span by the update call's own parentheses

Follow-up to #4549, correcting a span **I shipped in that PR and then measured to
be worse than the one it replaced.**

### The three spans, diffed by NAME across 264 schema columns

| span | flags |
|---|---|
| `[\s\S]{0,600}` — the original inline form | 31 |
| `[^}]{0,400}` — **my "fix", as merged in #4549** | **41** |
| `( … )` — bounded by the update call's parentheses | **28** |

`[^}]` stops at the **first** `}`, which any nested object or closure inside a
payload supplies early. It was a strict **superset** of the form it replaced:
ten real writers lost purely to a `{ … }` in the payload, and it removes 13 of
those false alarms.

⚠ **It was latent, not live.** The strict question is asked only of the six
registered switches, whose payloads happen to be flat, so nothing cried wolf.
It would have bitten whoever registered a seventh switch with a nested payload.

🔑 **A TOTAL THAT MATCHES IS NOT THE SET MATCHING.** I stopped on 14-vs-16
looking close and read it as rediscovering a known finding. Diffed by name, the
overlap ran one way entirely and the ten extras were mine alone. Comparing
counts is what let a strictly-worse pattern look like a fix — and it is the same
fault as the `.exec` that found the first of two same-named payload variables.

### Why parentheses

The bound comes from the syntax rather than a guess: a closing paren cannot be
reached before the argument list ends, so the next chained call is outside **by
construction**. No budget to shrink when somebody documents the payload, and
nesting is handled for free. It also fixes a case brace-matching the first
literal still missed — a ternary payload
(`.update(role === 'a' ? { joined_a: true } : { joined_b: true })`), where only
the first branch was checked and `joined_b` read as unwritten.

### The one column only this span flags

`vendor_bot_config.enabled`, and it is **correct to flag it**. The payload is
`...parsed.patch` — object spread; the column name appears nowhere in it. The
original span "found" it only by running past the payload into the
`.select('enabled,daily_reply_cap,…')` on the next line — **the right answer via
the exact bug it has.**

⛔ Dataflow payloads stay out of reach and are **stated, not baselined**: a
registered switch written that way belongs in `NO_SINGLE_CHAIN` with its reason.
A stated limit gets checked; a baseline gets trusted.

**Verified:** all five directly-written switches sabotaged one at a time, each
measured by occurrence count. No new baseline lines; the wide net is untouched.

SPEC IMPACT: None.
