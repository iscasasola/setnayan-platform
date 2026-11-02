## 2026-07-01 · feat(vendor-dashboard): rebuild the vendor dashboard shell to the finalized 6-menu prototype

Rebuilt the vendor dashboard chrome (desktop sidebar + mobile bottom nav) to
match the finalized prototype, using the editorial `--m-*` palette. Reuses the
existing `SidebarShell` (collapsible 64px rail + `sidebarFooter` slot) — the
shell frame was not rebuilt.

- **Desktop sidebar (`VendorSidebar`)** now renders SIX FLAT destinations
  instead of the collapsible group tree: Overview · My Shop · My Customers ·
  My Performance · My Services · On the Day. Active item = solid obsidian
  (`--m-ink`) rounded fill + white icon/label (a purpose-built row, NOT the
  shared `<SidebarItem>` champagne-gold-tint treatment); inactive = obsidian
  text on transparent with a subtle paper hover. "On the Day" carries a small
  amber (`--m-orange`) attention dot. Added an identity card above the menu — a
  dark rounded-square initials avatar + business display name + green
  (`--m-sage-deep`) "✓ Verified" / muted "Unverified" line.
- **Sidebar footer** (new `VendorSidebarFooter`, passed to
  `SidebarShell sidebarFooter`, hides on collapse): a gold "⚡ {tier}"
  subscription chip (`TIER_LABEL[asVendorTier(tier)]`) with a "Manage ›" link to
  `/subscription`, and a "Your tokens ◎ N" row linking to `/tokens`. Tier +
  token balance are resolved in `layout.tsx` — token balance reuses the exact
  `/tokens` read (lazy-eval `evaluate_earned_token_expiry` RPC, then
  `purchased_tokens + earned_tokens` from `vendor_wallets`, fail-soft to 0).
- **Mobile bottom nav (`VendorBottomNav`)** went from 5 tabs to 6: Overview ·
  Shop · Customers · Performance · Services · On the Day. Still delegates to the
  owner-locked `<BottomNav>` primitive (which already supports up to 6 tabs), so
  `lint:botnav` needed NO change (it enforces delegation + template-integrity
  markers, not a tab count). The old "More" tab was removed; `/more` stays
  reachable via a new mobile-only overflow link in the topbar, and every deeper
  route is bucketed into the six tabs' `activeMatch` arrays so no route goes
  unlit. `VENDOR_SCOPED_BOTTOM_NAV_KEYS` rerostered to the new keys.
- **`VENDOR_NAV_GROUPS` kept exported** (unchanged 6-group structure, with `shop`
  + `customers` added as the lead item of their groups) so `/more` +
  `vendor-mobile-landing` still surface the full route list — nothing orphans.
- **Stubbed the 2 missing destination routes** `app/vendor-dashboard/shop` +
  `app/vendor-dashboard/customers` (heading + subtitle + coming-soon note) so
  the nav doesn't 404. Wired both into `lib/nav-registry-defaults.ts` (new
  `vendor.sidebar.shop`/`.customers` + `vendor.bottom-nav.shop`/`.customers`
  slots, plus `.performance`/`.services`/`.onday` bottom-nav slots replacing the
  retired `bookings`/`calendar`/`messages`/`more` slots) and the `/more`
  `DESCRIPTIONS` map. Added `BarChart2` to `lib/nav-icons.ts` so the "My
  Performance" registry slot resolves instead of falling back to `Circle`.

Verified: `pnpm run typecheck`, ESLint on every changed file, `lint:navicon` +
`lint:botnav` + `lint:retired`, the `nav-registry-defaults` unit test (8/8), and
a full production build (both new routes compile).

SPEC IMPACT: None. (Prototype shell fidelity + route wiring only — no pricing,
SKU, schema, or product-decision change. Vendor tier labels + token wallet reads
reuse existing helpers/queries.)
