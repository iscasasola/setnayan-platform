## 2026-07-02 · refactor(vendor-shop): de-icon + centre the My Shop manage tiles, surface team/branch headroom

Reworked the four "Manage your shop" tiles (`shop/_components/manage-tiles.tsx`
+ `shop/page.tsx`) per owner direction:

- **Removed the four chip icons** (ShieldCheck / Globe / Users / Building2) and
  the `ChipIcon` helper; every tile is now **centre-aligned** (value → label →
  sub → chevron), with the expand chevron moved to the bottom-centre as the sole
  affordance.
- **Team / Branch subs now report remaining capacity** instead of the static
  "Invite + manage" / "Locations". Team reads from the tier seat cap
  (`tierCaps().agentAccounts`, counting only non-founder members — mirrors the
  `team/actions.ts` seat-cap contract): `Add up to N` · `Unlimited seats` ·
  `Seats full` · `Upgrade to add` (Free/Verified = 0 invitable seats). Branch is
  Enterprise-only, so `Add locations` on Enterprise, `Upgrade to add` elsewhere.
- **Website tile dropped its "Live/Draft" pill** — it's the editor entry, not a
  status readout (`value="Website"` / `label="Editor"` / `sub="Customize your
  page"`). The live/draft state still shows inside the expanded Website editor
  panel, which already receives `websiteLive`.

Type-clean (`tsc --noEmit`) and lint-clean (`next lint`). No schema, no pricing,
no route changes.

SPEC IMPACT: None (UI-only refinement of the already-shipped My Shop tiles; no
SKU, price, or tier-cap value changed — capacity copy is derived from the
existing `vendor-tier-caps.ts` matrix).
