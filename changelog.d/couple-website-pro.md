## 2026-06-22 · feat(website): COUPLE_WEBSITE_PRO removes the Setnayan watermark when owned

Wires the paid `COUPLE_WEBSITE_PRO` SKU (₱3,999 · the single website-Pro unlock that collapsed the dead `PRO_WEBSITE` / `PRO_RSVP` / `EVENT_WEBSITE` keys) so it actually unlocks something. Until now it was a catalog row with no entitlement helper and no render gate — it "unlocked nothing." The V1 perk: when the SKU is **active** (admin-approved), the couple's wedding site sheds the freemium "Powered by Setnayan · setnayan.com" footer watermark.

**What shipped:**

- **New `apps/web/lib/couple-website-pro.ts`** — mirrors `lib/animated-monogram.ts`. `COUPLE_WEBSITE_PRO_SERVICE_KEY` + `eventOwnsCoupleWebsitePro()` (bundle-aware buy surface) + `eventCoupleWebsiteProActive()` (admin-approved feature gate). Thin wrappers over the shared `lib/entitlements.ts` readers — refund-aware, graceful-degrade on orders-table drift (→ keep the watermark, the safe default), no migration.
- **`apps/web/app/[slug]/page.tsx`** — resolves `proWatermarkHidden` once via the admin client near the other event-level gates (`eventAnimatedMonogramActive`, `eventSkuActive`) and threads it through all three render branches (`PublicLanding`, `PrivateLanding`, `InvitationSite`) into `InvitationShell`, which now drops its "Powered by Setnayan · setnayan.com" footer watermark when active.
- **`apps/web/app/[slug]/recap/page.tsx`** — same gate; `RecapFooter` drops the matching watermark line.
- **`apps/web/app/[slug]/_components/editorial/editorial-content.tsx`** — same gate; the `Colophon` masthead sign-off drops the "Powered by Setnayan · {city} · {names}" credit (keeps the couple's names + cross-phase links). Best-effort, wrapped to preserve the component's "never throws" contract.
- **`apps/web/lib/v2-catalog.ts`** — `COUPLE_WEBSITE_PRO` build-status flipped `partial` → `live` now that it has a real perk. (PABATI / PAKANTA lines untouched — open PR #2044 edits PABATI.)

**Deliberately NOT gated (content, not watermarks):** the editorial "Powered by Setnayan" SECTION (`SectionRule` + `SetnayanExperience` chip row — the service-credits strip listing the SKUs the couple availed), the `/find-seat` + `/find-my-table` utility pages, and the `/wall` projection. Left untouched: `lib/pro-website.ts` (dead but inert).

**Owner flag — bigger Pro perks remain a product decision, NOT built:** premium templates, custom domains, and theme systems each need an owner ruling before build; this PR ships only the universal watermark-removal perk.

SPEC IMPACT: 0015 (main website) / 0002 (couple website) — `COUPLE_WEBSITE_PRO` is now wired: it removes the "Powered by Setnayan" watermark from the wedding site + recap + editorial colophon when owned (gate `eventSkuActive('COUPLE_WEBSITE_PRO')`). Bigger Pro perks (premium templates, custom domain) flagged for owner, not built.
