## 2026-09-22 · refactor(gift): delete `giftQuoteBasis` — a retired helper must be gone, not merely uncalled

Second time this week in `lib/setnayan-gift.server.ts`. `giftQuoteLine` shipped there with a
`'supplier'` branch imported by nothing but its own test while the live surface re-typed the same
strings, and was deleted for that reason. `giftQuoteBasis` was the same shape: **zero live callers**
since 2026-09-20 (the thread page moved to `resolvePapicQuoteStanding` + `giftBasisFrom`), while it
kept the OLD eligibility rule — `if (applies !== 'applies') return null;` — alive in the same file
as the new one.

**Measured before deleting:** every remaining reference was a comment or a guard, and two of those
guards existed only to assert it is *not* called.

**Why uncalled was not harmless.** It cost a false failure the same day: a new one-rule guard matched
the stale sibling instead of the function under test, and the fix was to scope the assertion to
`quoteSetnayanGift`'s body — so the file ended up with a *second* guard carrying a "mind the sibling"
comment. While a retired helper exists, every guard in the file has to know to avoid it, and each new
guard is another chance to forget.

**Three guards re-pointed, none deleted, each sabotaged red:**

- `the-gift-reaches-the-couple.test.ts` and `the-quote-promises-what-the-supplier-was-shown.test.ts`
  both bounded their slice by *requiring* a following `export async function` — which was only ever
  true because this sibling sat below. With it gone, `quoteSetnayanGift` is last in the file and that
  hard requirement failed on a correct file. The bound is now "the next top-level export, or the end
  of the file", plus an assertion that the slice really contains the function under test. **Sabotage:
  a decoy export appended after it while the real gate was removed → both go red**, so the boundary
  is still doing work.
- `the-exclusive-papic-on-a-quote.test.ts` forbade a second call to `giftQuoteBasis` by name. Once
  the function is deleted that ban is **vacuously true — a guard that can never fail**. Re-pointed at
  the property it was always protecting ("one eligibility read, or the two halves of one screen
  resolve against two different moments"): the thread page may not reach
  `setnayan_gift_quote_applies` directly under *any* name. **Sabotage: a second RPC read added to the
  page under a new name → red.** Strictly stronger than the name ban it replaces.

Comments naming the function are kept — they explain why the current shape exists — but made
historical so none claims a live function.

⚠ **Two stale comments are left in place and are NOT mine to fix:** `proposal-maker.tsx:218` ("Resolved
once on the server by `giftQuoteBasis`") and `messages/[threadId]/page.tsx:240` ("exactly
`giftQuoteBasis`'s contract"). Both are frame files this session is barred from. Note that the first
was **already wrong before this change** — that page has resolved through `giftBasisFrom` since
2026-09-20 — so the deletion exposes existing rot rather than creating it. Reported to the
controller; they belong to the B/C/D pass that rewrites both files.

SPEC IMPACT: None — removes dead code. No behaviour change, no migration, no frame file.
