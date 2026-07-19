## 2026-07-01 · fix(honesty): correct two stale comments left after the Patiktok un-retire + date-open reword

Follow-up to the gap-audit fix PRs (#2466/#2467/#2468) — two code comments that
the adversarial reviews flagged as out-of-scope but now factually wrong:

- `apps/web/lib/reel-render.ts` header said "Patiktok was retired 2026-06-29 …
  No remaining Patiktok caller." Patiktok was UN-RETIRED 2026-07-01 (#2464) and
  again renders through this engine. Corrected to: shared client renderer for
  BOTH Guest Stories and the restored Patiktok.
- `apps/web/app/explore/page.tsx:1652` dev comment still quoted the OLD tile
  string "a current calendar ranks you up" (reworded in #2466 to match the
  demote-only behavior). Updated the comment to match.

SPEC IMPACT: None (comment-only; no behavior change).

Known-deferred (NOT changed here): `apps/web/lib/help.ts:68` "Verified is free
during launch" reads as vendor-TIER pricing context (free verified tier vs paid
Pro/Enterprise) and is entangled with the stale public vendor prices (₱6,000/
₱10,000) already deferred to the go-live public-price reconciliation.
