## 2026-07-15 · fix(vendor): docs loader empty-state + profile-completeness coherence

Two owner-reported My Shop bugs on a fresh Free/unverified vendor (0 docs, no
public page):

- **Get-verified "Your documents" showed "Couldn't load your documents" for a
  vendor with zero uploads.** Root cause was a state conflation in
  `verify-section.tsx` `DocsStep`, not a data error: the lazy loader only fired
  from `handleToggle` (click-to-open), but the step also auto-opens from the
  parent (initial mount when profile-complete + no docs, and the live in-session
  unlock). On those paths `loadInlineDocs()` was never called, so the
  "no payload yet" render fell straight through to the error/retry copy. Fix:
  the step now lazy-loads whenever it is `open` without a payload (still lazy —
  presigns run only on open), and a real fetch rejection is tracked separately
  (`failed`) from "not loaded yet" so the retry copy is reserved for genuine
  failures; empty resolves to the upload state.

- **Header contradicted itself: ring "100% COMPLETE" + CTA "Finish profile" +
  "No public address yet — set one in Profile".** The completeness formula
  (`businessProfileChecklist`) counts only the 8 business-profile fields — the
  public address (`business_slug`) is a separate Pro/Website step and is NOT in
  the formula, so 100% profile can coexist with no public page. Fixes in
  `shop/page.tsx`: the CTA no longer says "Finish profile" at 100% (→ "Get
  verified" for a complete-unverified shop, "Manage shop" once verified); the
  ring label is scoped "Profile" (not a bare "Complete") so it stops implying
  the whole shop is done; the header address line points at the real place/gate
  ("a custom address is a Pro feature you set in Website"), matching the Website
  editor's own copy. Added `vendor-profile-completeness.test.ts` locking that the
  slug is not part of the formula.

SPEC IMPACT: None
