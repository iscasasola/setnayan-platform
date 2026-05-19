import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOrdersForEvent } from '@/lib/orders';
import { SuppliesMarketplaceBrowser } from './_components/cart-drawer';
import { SUPPLY_PRODUCTS, type SupplyProduct } from './_data/products';

export const metadata = { title: 'Setnayan Supplies · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

// Iteration 0018 — Setnayan Supplies (curated reseller, 2026-05-19 pivot).
//
// 2026-05-19 BUSINESS MODEL PIVOT: this iteration is no longer a marketplace
// with vendor-set retail prices + 10-15% Setnayan commission. The locked V1
// model is Setnayan-sourced resale:
//   - Setnayan negotiates wholesale prices per area with supplier vendors.
//   - Setnayan retail = wholesale × 1.5 (50% markup, ~33% of retail margin).
//   - Setnayan is the seller of record; couples buy from Setnayan.
//   - Supplier vendors fulfill; paid wholesale (not retail - commission).
// See spec corpus § "Pricing rule — lowest-available-wholesale wins" and
// CLAUDE.md decision-log rows "0018 business-model pivot" + "lowest-
// available-wholesale pricing rule".
//
// Current scaffold-level state (UI ships; data pipeline pending):
//   - Static SUPPLY_PRODUCTS catalog in _data/products.ts is the OLD-model
//     stand-in. It will be replaced by a Supabase query against
//     supplier_vendor_skus + supplier_vendor_sku_pricing (schema shipped
//     PR #143/#145) once supplier vendor agreements are signed and SKUs
//     are seeded via the 0023 admin onboarding surface (PR 5).
//   - resolveSuppliesPricing() at apps/web/lib/supplies/pricing.ts wraps
//     the public.resolve_supplies_pricing() Postgres function (PR #146).
//     PR 3b will swap the static catalog for dynamic queries.
//   - Apply-then-pay cart hand-off still routes through public.orders;
//     PR 4 ships supplies_orders table integration for the resale-model
//     fulfillment + payout flow.
//
// Spec source of truth: ~/Documents/Claude/Projects/Setnayan/0018_supplies_marketplace/
// Locked iteration scope: 5 categories (print fulfillment, equipment
// rentals, backdrop+decor, NFC+QR keepsakes, specialty merch).

// Which past orders should trigger which supply recommendations.
// Mirrors the spec's coordinator narrative ("You bought Patiktok →
// recommended supplies: HDMI dongle, monitor rental, background print").
const RECOMMENDATION_KEYS_BY_ORDER: Record<
  string,
  ReadonlyArray<'patiktok' | 'papic' | 'panood' | 'seating' | 'photo-delivery'>
> = {
  patiktok: ['patiktok'],
  'patiktok:': ['patiktok'],
  papic: ['papic'],
  'papic:': ['papic'],
  panood: ['panood'],
  'panood:': ['panood'],
  'photo-delivery': ['photo-delivery'],
  seating: ['seating'],
};

function pickRecommended(orderServiceKeys: ReadonlyArray<string>): SupplyProduct[] {
  const triggered = new Set<string>();
  for (const key of orderServiceKeys) {
    const lower = key.toLowerCase();
    for (const prefix of Object.keys(RECOMMENDATION_KEYS_BY_ORDER)) {
      if (lower.startsWith(prefix)) {
        for (const tag of RECOMMENDATION_KEYS_BY_ORDER[prefix] ?? []) {
          triggered.add(tag);
        }
      }
    }
  }

  if (triggered.size === 0) {
    // No past purchases → show a standard "starter kit" of high-signal
    // items that work for every wedding (QR cards, place cards,
    // signage). Matches the spec § "Coordinator workflow" line:
    // "Standard recommendations: QR cards, place cards print".
    return SUPPLY_PRODUCTS.filter((p) =>
      ['qr-cards-100', 'place-cards-print', 'signage-cards-pack', 'velvet-backdrop-rental'].includes(
        p.slug,
      ),
    );
  }

  return SUPPLY_PRODUCTS.filter((p) =>
    p.pairsWith?.some((tag) => triggered.has(tag)),
  ).slice(0, 4);
}

export default async function SuppliesMarketplacePage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Pull existing orders to drive the recommended-for rail. Today this
  // is best-effort scaffold work — most of the iterations the spec
  // mentions (Patiktok, Panood) are still coming_soon. When users
  // start buying those services, this rail will light up automatically.
  const orders = await fetchOrdersForEvent(supabase, eventId);
  const orderServiceKeys = orders
    .map((o) => o.service_key)
    .filter((k): k is string => typeof k === 'string' && k.length > 0);
  const recommended = pickRecommended(orderServiceKeys);

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Add-ons · Setnayan Supplies
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Setnayan-curated supplies, delivered.
            </h1>
            <p className="max-w-2xl text-base text-ink/65">
              Print, rentals, decor, NFC keepsakes, specialty merch — sourced by
              Setnayan from nearby vetted suppliers in your delivery area. You buy
              from Setnayan at one transparent retail price; we coordinate
              fulfillment with the supplier behind the scenes.
            </p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">
            <ShoppingBag aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Web V1 · launching
          </span>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 sm:p-5">
        <p className="text-sm font-medium text-amber-900">How it works</p>
        <ol className="ml-5 list-decimal space-y-1.5 text-sm text-amber-900/90">
          <li>Browse the catalog and add what you need to your cart.</li>
          <li>
            Tap <span className="font-medium">Checkout via Orders</span> to hand off
            — your cart becomes a draft order on the Orders tab with the line items
            pre-filled.
          </li>
          <li>
            Setnayan locks the final quote at one transparent retail price (sourced
            from the lowest-available wholesale in your area, with our markup
            included — no hidden commission lines).
          </li>
          <li>
            Pay via BDO, GCash, or Setnayan Pay. Your supplier delivers to your
            venue; tracking lives on the order. Any issue, you talk to Setnayan —
            not the supplier.
          </li>
        </ol>
      </section>

      <SuppliesMarketplaceBrowser eventId={eventId} recommended={recommended} />

      <footer className="space-y-1 rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-4 text-xs text-ink/55">
        <p>
          Don&rsquo;t see a vendor you trust? Email{' '}
          <a
            href="mailto:supplies@setnayan.com"
            className="font-medium text-terracotta hover:underline"
          >
            supplies@setnayan.com
          </a>{' '}
          — we&rsquo;ll vet them through the iteration 0006 verified-vendor pipeline.
        </p>
        <p>
          Coordinator running 5+ events?{' '}
          <Link
            href="/help#contact"
            className="font-medium text-terracotta hover:underline"
          >
            Talk to us about bulk ordering, saved supply templates, and
            coordinator margin markup
          </Link>{' '}
          — coordinator-specific features (single bill across events, saved
          kits, vendor preferences) ship alongside V1.2 multi-moderator
          access.
        </p>
      </footer>
    </section>
  );
}
