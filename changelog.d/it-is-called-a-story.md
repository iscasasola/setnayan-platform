## 2026-08-22 · copy(story): a guest reads "The Story", not "The Editorial"

Owner: *"can we stop calling it editorial and start calling it a story?"* This is
the half that carries no collision — everything a GUEST, a search engine or a
price-list reader sees. The couple-dashboard half is deliberately held back.

- `editorial-content.tsx` — the live ribbon AND the fallback, together. Renaming
  either alone would give one surface two names.
- `data.ts` — the one sample byline that said "Setnayan Editorial"; the app's own
  default is "By the Setnayan Desk" (`compose.ts`, `print/page.tsx`,
  `editorial-content.tsx`). ⚠ `lib/blog.ts` keeps "Setnayan Editorial" — that is
  the JOURNAL's byline, a different product.
- `realstories/[slug]/page.tsx` · `pricing/page.tsx` · `help.ts` + `llms-txt.ts`
  (the same sentence on two public surfaces — they move together or the help
  centre and the machine-readable summary disagree).
- 🔒 `HELP_LASTMOD` deliberately NOT bumped: the file's own rule says bump on a
  MATERIAL change, and this is a synonym — still 30 days, still explicit consent.
  The sentence is quoted into FAQPage JSON-LD; no number moved.

⛔ **NOT renamed, and not oversights:** routes (`/website/editorial`,
`/studio/editorial-pro`, `?phase=editorial`) · tables and columns
(`event_editorial`, `editorial_vendor_media`) · the `EDITORIAL_PRO` sku_code ·
R2 prefixes · enum values · `.sn-editorial` and `--font-editorial-*`. Renaming any
of those is a migration or a broken link, not a copy change — the same
copy-only discipline the "Event Hub" rename used.

⏭ **HELD FOR THE OWNER — the couple's dashboard.** The bare word "Story" is
already taken six times in the product (a person's chronicle, the love story, its
edit page, supplier-written columns, a field inside this very editor, and the
public nav tab). Renaming the dashboard would put two different things under one
name — worse than today. The guest surfaces above are safe because the public
"Story" tab is gated `phase === 'before'` and this ribbon is post-event, so they
can never co-render.

⚠ **FLAGGED, NOT FIXED:** the editorial's gold eyebrows are `text-terracotta`
(#A9834B) on the white page — **3.48:1, below the 4.5:1 AA floor for 12px text**.
There are SEVEN such sites in that one component and its docblock names
champagne-gold as the deliberate editorial accent, so fixing one of seven would
make it the odd one out. It is a whole-component design call, not a rider here.

SPEC IMPACT: None — no price, SKU or locked decision moves.
