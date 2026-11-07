# Lane C4 — Shop + Portfolio · build notes

Branch `claude/supplier-1build-c4` from `origin/claude/supplier-1build-base` (50ba2da1).

## Early push (spec §9 #17)
- ✅ `apps/web/lib/portfolio-count.ts` → `getPortfolioCount(vendorId, client?)` returns
  `{ ok: true, photos, free, label } | { ok: false }`. `label` = "12 of 50 free photos" / "62 photos · 50 free used".
  Pure words in `lib/portfolio-count-label.ts` (`portfolioCountLabel`) for client components. C1: import from
  `@/lib/portfolio-count`; print "Couldn't load" on `{ ok: false }`.

## Where I stopped
- (updated each push)
