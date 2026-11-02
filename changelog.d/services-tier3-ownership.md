## 2026-06-25 · fix(studio): in-app services consistency — Tier 3 (bundle-aware ownership + owner deep-link)

Third tier of the In-App Services Consistency Plan. Makes the Studio hub's
ownership truthful and routes owners straight to their tool.

- New batch reader `eventActiveSkus(client, eventId)` in `lib/entitlements.ts`:
  ONE orders query → `{ active, pending }` sets, bundle-aware (expands
  GUIDED_PACK / MEDIA_PACK children via the same BUNDLE_CHILD_SKUS map the
  per-SKU `eventSkuActive`/`eventOwnsSku` use). Degrades to empty on any error
  (render-path safe).
- Studio grid (`studio/page.tsx`) now reads ownership from that batch reader via
  the ADMIN client (orders RLS is purchaser-scoped — a co-host is still an
  owner), replacing the non-bundle-aware `orderStatusMap`. So a service owned via
  a bundle now shows **Active** on the grid instead of a buy "Get" — the grid can
  no longer disagree with the tool surface (which gates on `eventSkuActive`).
  A real SKU with no readable price shows a neutral **"View"**, never a
  free-implying "Get".
- Owner deep-link (paid-features-auto-show applied to routing): a new `cardHref`
  sends an OWNED service straight to the working tool (`addOnHref`) and a
  not-owned one to its detail page. Generalized the same to the About page
  (`studio/about/[addon]`) — every owned paid service redirects to its tool
  (Patiktok keeps its more-specific `/booth`), replacing the Patiktok-only
  special-case.

Adversarially verified: badges non-regressed, owners land on real tools (not
paywalls, no redirect loop), one query (no N+1). Tier 4 (opened-surface cleanup)
+ Tier 5 (Animated Monogram merge, Papic/Panood data) follow.

SPEC IMPACT: none; In_App_Services_Consistency_Plan_2026-06-25.md.
