## 2026-09-15 · fix(gifts): the public gifts page switch accepts what a person types

Owner: *"PABUYA_PUBLIC_ROUTE_ENABLED = true and redployed"* — and
`/[slug]/pabuya` still answered **404**.

### Diagnosed by elimination, not by guessing

The route has four gates. Three were measured and passed: the event exists;
`wedding` carries the `website` surface (checked in `event_type_profiles`); and
the visibility gate **redirects** rather than 404s. That left the switch.

```ts
return v === '1' || v === 'true';   // the gifts flag
```

Two exact spellings, **case-sensitive and untrimmed**. `TRUE`, `True`, and
`true ` with a trailing space — trivially easy to produce in a web form — each
failed **silently**. 🔑 **A flag that is off renders as a feature that was never
built.** There is no error to find, which is why a redeploy did not help.

### The repo already had the answer

`envFlagEnabled` accepts **true · 1 · yes · on**, trimmed and case-insensitive.
The gifts flag was a **private re-implementation of a shared rule**, and being
private is exactly why it drifted stricter than the rule it copied.

### ⚠ It is not alone — a family, each accepting something different

`FEATURE_ACCOUNT_AUTOSURFACE` (`=== '1'` only) ·
`NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED` (`=== 'true'` only) ·
`bazi-birthdata` (`true|1|on`) · `booking-fee-gate` and `budget-truth-flag`
(`true|1|TRUE`). **The same value turns one feature on and another off.**
Deliberately NOT changed here: widening a flag can silently ENABLE something
currently off, which is nobody's to do unasked. Recorded so it is a known family
rather than a surprise.

### Guarded

- The spellings that cost a redeploy now work; the ones that mean OFF still do —
  *a public surface must not ship on a typo*.
- The gifts flag must read the shared helper, not compare raw strings.

**Sabotage-checked**: restoring `v === '1' || v === 'true'` turns it red.

🪤 The guard's first cut failed against its own fix — `stripComments` pads
comments with spaces, so a character window lands on blanks. **Third time today.**
Whitespace is collapsed before matching, and the docblock says why.

SPEC IMPACT: None — the switch is the owner's, and it now honours what he set.
