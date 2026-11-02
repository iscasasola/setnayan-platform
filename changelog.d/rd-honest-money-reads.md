## 2026-09-30 · fix(admin,guest): money reads are honest; no wedding words on other events

A refused Supabase read resolves with `{ error }`, so `?? []` turned it into an
empty list and the screen stated an absence it never measured. Five fixes:

- **`/admin/payments`** — the payment queue, the `?q=` order lookup and the
  orders-needing-a-quote read now bind their errors. A refusal renders
  "Couldn't load this — refresh to try again" instead of "Nothing to
  reconcile."; a refused order search says the search failed instead of
  silently falling back to a bank-reference search. A search with no match
  now says "No payment matches <q>".
- **`/admin/subscriptions`** — a refused pending/recent read no longer shows
  "0 pending"; each list says it couldn't load.
- **Settings forms** — new `fetchPlatformSettingsMeasured` in
  `lib/platform-settings.ts` returns `{ settings, readFailed }`
  (`fetchPlatformSettings` keeps its behaviour for every other caller).
  Payment methods and Settings › Settings show a warning and disable Save when
  the read failed, so FALLBACK blanks can never overwrite the real BDO / GCash /
  business identity values. Settings › Compliance hides its form on a refused
  facts read (server-side swap, no client weight).
- **Guest side label** — `site-body.tsx` now reads the already-defined
  `side_labels` from `resolveWeddingOnlyParts`; a non-wedding guest sees no
  "Bride's side / Groom's side / Both sides" anywhere (sentence, Details row,
  footnote).
- **Gift card** — "digital money dance" / "Pin your cash" are wedding-only on
  the gift door, the hub gift link and `/[slug]/pabuya`, decided in ONE place:
  `giftIsMoneyDance(words)` in `app/[slug]/_lib/event-words.ts` (so no guest file
  compares against a wedding word — `s13-is-finished.test.ts`). Other
  celebratory types read "Send E-Gifts straight to …" (one product name —
  `the-guest-text-is-honest.test.ts` §9); the wake keeps "A gift of sympathy".

Guarded by `apps/web/lib/admin-money-and-gift-words-are-honest.test.ts` (sabotage-checked).

SPEC IMPACT: None
