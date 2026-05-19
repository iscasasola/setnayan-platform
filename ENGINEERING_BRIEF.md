# 0018 Setnayan Supplies — Engineering Brief

> **Mission:** Build Setnayan Supplies — a curated-reseller surface where Setnayan negotiates wholesale prices with supplier vendors per area, marks up 50%, and sells to couples + coordinators as Setnayan-branded products. Setnayan is the seller of record; supplier vendors fulfill behind the scenes.

**Worktree:** `~/Setnayan/.claude/worktrees/0018-supplies-marketplace/`
**Branch:** `claude/0018-supplies-marketplace` (off `origin/main` at `efe5521`)
**Iteration spec:** `/Users/icecasasola/Documents/Claude/Projects/Setnayan/0018_supplies_marketplace/0018_supplies_marketplace.md` (rewritten 2026-05-19 for the model pivot)
**Estimated effort:** ~4-6 weeks of engineering for one developer
**Hard pre-launch gate:** Setnayan needs signed wholesale agreements with at least 1-3 supplier vendors per SKU category per area BEFORE this surface can go live to couples. Owner-side ops work; engineering can ship first, surface stays behind a "Coming to your area soon" empty state until supplier agreements land.

---

## How to start this work

```
cd ~/Setnayan/.claude/worktrees/0018-supplies-marketplace
claude
```

Prompt the fresh session with: **"Read ENGINEERING_BRIEF.md and continue."**

Context: 0018 was promoted from V1.5+ → V1 on 2026-05-18. The original spec framed this as a marketplace with vendors setting their own retail prices + Setnayan taking a 10-15% commission. **That framing is RETIRED 2026-05-19.** The new model is curated reseller with per-area wholesale + 50% markup. Read the rewritten spec at `0018_supplies_marketplace/0018_supplies_marketplace.md` BEFORE writing any code — the data model + payout flow is fundamentally different from the original draft.

---

## 1. What changed 2026-05-19 (do not re-implement the old model)

The original 2026-05-11 spec was a marketplace with vendor-set retail prices + Setnayan commission. The new model is:

| Aspect | Old (retired) | New (locked) |
|---|---|---|
| Business model | Marketplace operator | Curated reseller |
| Who sets retail price | Vendor | Setnayan (wholesale × 1.5) |
| Who is seller of record | Vendor | Setnayan |
| Setnayan revenue | 10-15% commission off the top | 50% markup on wholesale (~33% of retail) |
| Customer relationship | Vendor responds to couple | Setnayan handles all couple-side |
| Vendor payout | Retail - commission | Wholesale (fixed) |
| BIR OR issuance | Vendor → Setnayan (commission Form 2307) | Setnayan → Couple (full retail OR); Vendor → Setnayan (wholesale invoice) |
| Spec section that captures it | Old marketplace categories table | New "Setnayan Supplies" framing at top of spec |

---

## 2. What's already shipped (do not re-implement)

- ✅ "Coming soon" placeholder visible in `apps/web/app/dashboard/[eventId]/add-ons/` grid (PR #22)
- ✅ R2 storage (from 0013)
- ✅ 0034 Payments & Cart spine (extends for wholesale-payout flow)
- ✅ 0006 Vendors table (extends with `is_supplier_vendor` flag)
- ✅ 0026 BIR tax compliance scaffolding

## 3. What's still missing (PR plan)

### PR 1 — Schema migrations (~1 day)

Per spec § Schema additions:

```sql
-- Extend 0006 vendors table
ALTER TABLE vendors ADD COLUMN is_supplier_vendor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN supplier_categories TEXT[] DEFAULT '{}';

-- New tables (read spec for full definitions)
CREATE TABLE supplier_vendor_skus (...);
CREATE TABLE supplier_vendor_sku_pricing (...);
CREATE TABLE supplies_orders (...);
CREATE TABLE supplies_order_line_items (...);

-- Extend 0034's vendor_payouts
ALTER TABLE vendor_payouts ADD COLUMN payout_type TEXT NOT NULL DEFAULT 'commission' 
  CHECK (payout_type IN ('commission','wholesale'));
ALTER TABLE vendor_payouts ADD COLUMN supplies_order_id UUID REFERENCES supplies_orders (order_id);
```

Read spec § Schema additions in full for the canonical column list.

### PR 2 — Service area resolver + lowest-available-wholesale pricing engine (~3-5 days)

`apps/web/lib/supplies/`

- Couple's delivery address → resolve to `service_area_code` (V1: just `METRO_MANILA`)
- Per (SKU, area), fetch ALL active wholesale prices from `supplier_vendor_sku_pricing` (respecting `effective_from` / `effective_to`)
- Filter to available vendors: `vendors.is_supplier_vendor = TRUE` + `vendors.status = 'active'` + `supplier_vendor_skus.is_active = TRUE` + (V1.5+: capacity check)
- **Order by `wholesale_centavos ASC` and pick the FIRST available (lowest price wins; rule locked 2026-05-19)**
- Compute retail = wholesale × 1.5 (rounded to nearest peso)
- Volume discount tiers from `volume_tiers` JSONB apply to the chosen vendor's pricing
- If no vendor available → return null; surface "Coming to your area soon — join waitlist" UI state
- Cache-friendly with TTL ~5 minutes (pricing changes infrequently, but availability flips faster)

**Critical: snapshot the chosen vendor + wholesale + retail at order time.** Schema is in `supplies_order_line_items.wholesale_centavos_at_order` + `retail_centavos_at_order` + `supplier_vendor_id`. This locks the price even if the underlying wholesale changes mid-order.

**Stale-price-resolution at checkout.** If the chosen vendor becomes unavailable BETWEEN add-to-cart and checkout (status flip, stock out, suspension), the cart MUST re-resolve to the next-cheapest. Couple sees a notification before payment confirms: "Your supplier was updated — your total changed from ₱X to ₱Y." Order then snapshots at the new wholesale + retail. If NO next-cheapest is available, the line item drops from the cart with an explanation.

Test surfaces:
- `resolve_supplies_pricing(sku_id, area_code, quantity, delivery_window?)` → returns `{ vendor_id, wholesale_centavos, retail_centavos, volume_tier_applied? }` OR `null` if unavailable
- `recheck_cart_pricing(cart_id)` at checkout → re-resolves every line item, returns array of `{ line_item_id, old_total, new_total, status: 'unchanged' | 'reresolved' | 'unavailable' }`
- Vitest fixtures for: 1 vendor / multiple vendors same area / vendor goes inactive between add-to-cart and checkout / no vendors in area / volume tier kicks in

**Vendor opacity in V1.** Vendors quote wholesale independently; they don't see competitor pricing. V1.5+ candidate: surface "you're X% above the area median" signal in 0022 supplier-vendor dashboard to encourage competitive wholesale.

**Quality floor mitigation in V1.** Pure lowest-price-wins risks race-to-bottom on quality. V1 mitigation:
- SLA enforcement via wholesale agreement (fulfillment time + defect rate ceiling); SLA misses suspend vendor → falls out of available pool automatically
- Setnayan ops can manually suspend a vendor whose quality drops (admin surface in PR 5)
- Couple ratings + dispute counts feed an internal vendor reliability score (NOT surfaced to couples)
- V1.5+ candidate: composite ranking that weights wholesale by reliability so 10%-of-the-time-rotates to a higher-quality vendor — keeps the supplier pool healthy without pure lowest-price race

### PR 3 — Supplies browse + cart surface (~5-7 days)

Route: `apps/web/app/dashboard/[eventId]/add-ons/supplies/`

- Per-event personalized recommendations:
  - "You bought Patiktok — recommended supplies: [list]"
  - "You bought Papic — recommended supplies: [list]"
  - "Standard recommendations: place cards, QR cards, photo books, etc."
- Category browse: Print fulfillment · Equipment rentals · Backdrop + decor · NFC + QR keepsakes · Specialty merch
- SKU detail page: show retail price (markup-inclusive), unit of measure, description
- Add-to-cart wires into 0034 cart flow with `supplies_order` line items
- Service area input (couple confirms delivery address before browse so retail prices show area-specific)

### PR 4 — Checkout + order routing (~3-5 days)

- Checkout via 0034 apply-then-pay flow → creates `supplies_orders` row
- On payment confirmed: dispatch order to supplier vendor(s) via:
  - Email/SMS notification to supplier vendor (V1 manual)
  - OR 0022 vendor dashboard supplier-vendor variant (V1.5+ if 0022 surface ships in time)
- Status transitions: `pending_payment → paid → accepted → in_production → shipped → delivered → completed`
- Couple dashboard shows order status; Setnayan ops can intervene if vendor missing SLA

### PR 5 — Supplier vendor onboarding + admin surface (~5-7 days)

`apps/web/app/dashboard/admin/supplies-vendors/`

- Setnayan ops surface to onboard supplier vendors:
  - Add new supplier vendor (mark `is_supplier_vendor = TRUE` + categories)
  - Enter SKUs per vendor (display_name, description, unit_of_measure)
  - Enter wholesale pricing per SKU + per service area + with volume tiers
  - Set effective_from / effective_to dates
- Wholesale price update flow with snapshot-protection (existing orders unaffected)

### PR 6 — BIR + payout flow (~3-5 days)

- Setnayan issues OR to couple for full retail (extends 0026 OR-generation)
- Supplier vendor invoices Setnayan at wholesale separately (Setnayan ops manual reconciliation V1; vendor-invoice upload UI V1.5+)
- 0034 `vendor_payouts` row created with `payout_type = 'wholesale'`, amount = sum of wholesale per delivered line item
- Payout dispatch: T+7 after order completes (default; supplier vendor can have negotiated different terms)

### PR 7 — Coordinator-specific features (~3-5 days)

- Bulk ordering across events (coordinator role from 0048 V1.2 OR earlier coordinator subscription)
- Saved supply templates per coordinator
- Coordinator-side markup on top of Setnayan retail
- Single billing cycle invoice (monthly consolidated)
- Note: this PR depends on 0048 V1.2 multi-moderator + coordinator role landing. If 0048 V1.2 isn't ready, ship coordinator features as V1.2 instead.

### PR 8 — Tests + email templates + admin observability (~2-3 days)

- 0028 email templates: `supplies_order_placed`, `supplies_order_accepted`, `supplies_order_shipped`, `supplies_order_delivered`, `supplies_order_refunded`, `supplier_vendor_payout_dispatched`
- Vitest tests for service area resolver, wholesale pricing, markup calc, snapshot protection, payout calc
- 0023 admin: Supplies operations panel (active orders, delivery SLA, supplier vendor stats, area coverage map)

---

## 4. Environment variables needed

```
SUPPLIES_DEFAULT_MARKUP_PCT=50        # markup percentage (50% on wholesale = 33% of retail)
SUPPLIES_VOLUME_DISCOUNT_PASSTHROUGH_PCT=50   # how much of bulk discount we pass to couple vs retain as margin
SUPPLIES_SERVICE_AREAS=METRO_MANILA           # comma-separated active service areas for V1
```

No new external API integrations.

---

## 5. Owner-side actions (gate before launch — engineering can proceed in parallel)

| Action | Lead time | Why it gates |
|---|---|---|
| Draft `01_Contracts/Setnayan_Supplier_Vendor_Agreement.md` | ~1-2 weeks (owner + legal) | Cannot sign vendors without an agreement template |
| Negotiate + sign at least 1-3 supplier vendors per SKU category | ~2-4 weeks per vendor | Cannot serve orders without inventory; surface stays in "Coming soon" empty state until first vendor signs |
| Define service area mapping (which barangays / cities map to which supplier vendor) | ~1 week | Needed for area resolver to know which vendor to source from |
| Backup vendor for each category | ~+2-4 weeks | Coverage redundancy if primary supplier misses delivery |
| Vendor wholesale prices entered into admin surface | After PR 5 ships + vendors signed | Required for any actual transactions |

Engineering does NOT block on these — engineering PRs 1-8 can ship + the surface goes live in "Coming to your area soon — join waitlist" mode. Real transactions enable as vendors sign + prices are entered.

---

## 6. Cross-iteration impacts (other iterations affected by 0018)

| Iteration | Impact |
|---|---|
| **0006 Vendors Management** | Adds `is_supplier_vendor` flag + `supplier_categories` array on `vendors` table. Supplier vendors do NOT appear in the discoverable couples-facing marketplace; they're sourcing-channel only. A vendor CAN be both marketplace + supplier. |
| **0022 Vendor Dashboard** | V1.5+ candidate: supplier-vendor variant of the dashboard (different from couple-facing-marketplace vendor dashboard) showing supplies orders + wholesale payout history. V1: supplier vendors get email/SMS notifications via 0028. |
| **0026 BIR Tax Compliance** | Setnayan OR-issues to couple for full retail (not just commission). Supplier vendor invoices Setnayan at wholesale. Form 2307 obligations shift: Setnayan issues 2307 to supplier vendor (treating as supplier, not marketplace seller). |
| **0028 Email Notifications** | New templates per PR 8. Total V1 template count creeps up. |
| **0034 Payments & Cart** | `vendor_payouts.payout_type` enum added with `'wholesale'` value. Existing 0006 commission payouts get `payout_type='commission'`. |
| **0048 V1.2 Multi-Moderator** | PR 7 coordinator features depend on this. If V1.2 slips, PR 7 ships in V1.2 alongside other moderator-aware features. |

Engineering on 0018 should propose schema migrations that DON'T break the existing 0006 / 0034 tables (additive ALTER, no DROP).

---

## 7. Open questions resolved 2026-05-19

The original spec had 5 open questions. All resolved per owner directive:

1. ~~Coordinator marketplace access~~ → Open to everyone; coordinator-specific features layer on top
2. ~~Commission rate~~ → **Moot. 50% markup on wholesale replaces commission entirely.**
3. ~~Print fulfillment model~~ → Setnayan-sourced reseller for ALL SKUs; no marketplace listings.
4. ~~Patiktok background design~~ → Same Setnayan-sourced model as everything else.
5. ~~Couple direct access~~ → Open to all couples; no subscription gate.

---

## 8. Definition of done

PR 1-8 land + the following work:

- Couple enters event delivery address → service area resolved
- Couple browses supplies by category → sees Setnayan retail prices (wholesale × 1.5)
- Adds items to cart → 0034 cart flow consumes
- Pays via 0034 apply-then-pay → `supplies_orders` row created with snapshotted wholesale + retail
- Setnayan ops dispatches to supplier vendor → vendor accepts → fulfills
- Status updates flow couple-side via dashboard
- On delivery confirmed: 0034 `vendor_payouts` row created with `payout_type='wholesale'`, paid out T+7
- BIR OR issued to couple for full retail; supplier vendor invoices Setnayan at wholesale
- Admin observability live: active orders, delivery SLA, supplier vendor stats, area coverage map
- Coordinator features ship (PR 7) — depends on 0048 V1.2 or coordinator V1.2 timing
- All Vitest tests green

---

## 9. Pointers

- Spec (rewritten 2026-05-19): `/Users/icecasasola/Documents/Claude/Projects/Setnayan/0018_supplies_marketplace/0018_supplies_marketplace.md`
- Supplier Vendor Agreement template: `01_Contracts/Setnayan_Supplier_Vendor_Agreement.md` (TO BE DRAFTED — owner gate)
- 0006 vendors_management spec — supplier-vendor classification context
- 0026 BIR tax compliance — OR-issuance + Form 2307 chain
- 0034 payments_and_cart — vendor_payouts + cart spine
- Decision log row 2026-05-19 "0018 model pivot — marketplace-commission → Setnayan-sourced resale"

## 10. Don'ts

- ❌ Do NOT implement the old marketplace-commission model from the original 2026-05-11 spec — it's been pivoted
- ❌ Do NOT surface supplier vendor names/profiles to couples — couples see Setnayan-branded products only
- ❌ Do NOT let vendors set their own retail prices — wholesale-only; retail computed from wholesale × 1.5
- ❌ Do NOT skip the `wholesale_centavos_at_order` + `retail_centavos_at_order` snapshot — required for price-change protection
- ❌ Do NOT launch to couples until at least 1 supplier vendor is signed per SKU category per service area — keep surface behind "Coming to your area soon" empty state
- ❌ Do NOT mix supplies orders into the existing `service_orders` table (used for 0006 vendor bookings + 0034 SKUs) — supplies need their own `supplies_orders` table
- ❌ Do NOT treat supplier-vendor wholesale invoices as commission Form 2307 — different BIR treatment; supplier wholesale is COGS

---

**End of engineering brief.**
