'use client';

import { useMemo, useState } from 'react';
import {
  Filter,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { formatPhp } from '@/lib/orders';
import { useEscapeKey } from '@/lib/use-escape-key';
import {
  SUPPLY_CATEGORIES,
  SUPPLY_PRODUCTS,
  type SupplyCategoryKey,
  type SupplyProduct,
} from '../_data/products';

// Client-side scaffold for the Supplies Marketplace browse + cart UX.
//
// Scope (iteration 0018 scaffold-level):
//   - Filter products by category (chip strip).
//   - Add / increment / decrement / remove items in a local cart.
//   - Floating sticky cart pill that opens a slide-over drawer with the
//     line items, subtotal, and a disabled "Checkout opens soon" notice.
//     Checkout is intentionally NOT built here: iteration 0018 (Supplies)
//     is deferred / not in V1, and the old hand-off to /orders/new was
//     retired (it now bounces to /add-ons and drops the in-memory cart),
//     so the CTA is neutralized rather than wired.
//
// Pricing model (per CLAUDE.md 2026-05-19 row "Setnayan Supplies · pivot to
// curated reseller 50% markup on wholesale"): Setnayan is the merchant of
// record. The retail prices shown ARE Setnayan's already (wholesale × 1.5).
// There is no separate convenience fee on top — V2 cutover retired the V1
// Setnayan Pay 5% layer entirely (CLAUDE.md 2026-05-28 V1→V2 architectural
// pivot lock). Cart shows retail × quantity, nothing more.
//
// TODO(0018): vendor inventory persistence — today the catalog is mock data.
// TODO(0018): real checkout flow — handoff to orders/new is the scaffold-safe
// shortcut. Cart state is in-memory only; the user re-enters the description
// on the orders page.

type Props = {
  recommended: readonly SupplyProduct[];
};

type CartEntry = {
  slug: string;
  qty: number;
};

export function SuppliesMarketplaceBrowser({ recommended }: Props) {
  const [activeCategory, setActiveCategory] = useState<SupplyCategoryKey | 'all'>(
    'all',
  );
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return SUPPLY_PRODUCTS;
    return SUPPLY_PRODUCTS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const cartLines = useMemo(() => {
    return cart
      .map((entry) => {
        const product = SUPPLY_PRODUCTS.find((p) => p.slug === entry.slug);
        if (!product) return null;
        return { entry, product };
      })
      .filter((row): row is { entry: CartEntry; product: SupplyProduct } =>
        row !== null,
      );
  }, [cart]);

  const cartCount = cart.reduce((sum, e) => sum + e.qty, 0);
  const subtotal = cartLines.reduce(
    (sum, { entry, product }) => sum + entry.qty * product.pricePhp,
    0,
  );

  function addToCart(slug: string) {
    setCart((prev) => {
      const existing = prev.find((e) => e.slug === slug);
      if (existing) {
        return prev.map((e) =>
          e.slug === slug ? { ...e, qty: e.qty + 1 } : e,
        );
      }
      return [...prev, { slug, qty: 1 }];
    });
  }

  function bumpQty(slug: string, delta: number) {
    setCart((prev) => {
      const next = prev
        .map((e) =>
          e.slug === slug ? { ...e, qty: Math.max(0, e.qty + delta) } : e,
        )
        .filter((e) => e.qty > 0);
      return next;
    });
  }

  function removeLine(slug: string) {
    setCart((prev) => prev.filter((e) => e.slug !== slug));
  }

  return (
    <div className="space-y-6">
      {/* Category chip strip */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <CategoryChip
          active={activeCategory === 'all'}
          onSelect={() => setActiveCategory('all')}
        >
          <Filter aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          All categories
        </CategoryChip>
        {SUPPLY_CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat.key}
            active={activeCategory === cat.key}
            onSelect={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </CategoryChip>
        ))}
      </div>

      {/* Recommended-for rail — only when "all" is active, so it doesn't
          duplicate the category grid. */}
      {activeCategory === 'all' && recommended.length > 0 ? (
        <section
          aria-labelledby="recommended-heading"
          className="space-y-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4 sm:p-5"
        >
          <div className="flex items-center gap-2">
            <Sparkles
              aria-hidden
              className="h-4 w-4 text-terracotta"
              strokeWidth={1.75}
            />
            <h2
              id="recommended-heading"
              className="text-base font-semibold tracking-tight text-ink"
            >
              Recommended for your event
            </h2>
          </div>
          <p className="text-sm text-ink/70">
            Curated by the add-ons you already have on this event. Edit your
            cart any time — nothing is charged until the Setnayan team confirms
            availability.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recommended.map((product) => (
              <li key={`rec-${product.slug}`}>
                <ProductCard
                  product={product}
                  inCart={cartLines.find((l) => l.entry.slug === product.slug)?.entry.qty ?? 0}
                  onAdd={() => addToCart(product.slug)}
                  onBump={(delta) => bumpQty(product.slug, delta)}
                  compact
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Main product grid */}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <li key={product.slug}>
            <ProductCard
              product={product}
              inCart={cartLines.find((l) => l.entry.slug === product.slug)?.entry.qty ?? 0}
              onAdd={() => addToCart(product.slug)}
              onBump={(delta) => bumpQty(product.slug, delta)}
            />
          </li>
        ))}
      </ul>

      {/* Sticky cart pill — visible whenever the cart has any line. */}
      {cartCount > 0 ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-3 text-sm font-medium text-cream shadow-lg shadow-mulberry/30 transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry lg:bottom-6"
          aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
        >
          <ShoppingCart aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          <span>Cart</span>
          <span className="rounded-full bg-cream/25 px-2 py-0.5 font-mono text-[10px] tracking-wider">
            {cartCount}
          </span>
          <span aria-hidden className="font-mono text-[11px] opacity-90">
            {formatPhp(subtotal)}
          </span>
        </button>
      ) : null}

      {/* Slide-over drawer */}
      {drawerOpen ? (
        <CartDrawer
          cartLines={cartLines}
          subtotal={subtotal}
          onClose={() => setDrawerOpen(false)}
          onBump={bumpQty}
          onRemove={removeLine}
        />
      ) : null}
    </div>
  );
}

function CategoryChip({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-terracotta bg-terracotta text-cream'
          : 'border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta',
      ].join(' ')}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ProductCard({
  product,
  inCart,
  onAdd,
  onBump,
  compact = false,
}: {
  product: SupplyProduct;
  inCart: number;
  onAdd: () => void;
  onBump: (delta: number) => void;
  compact?: boolean;
}) {
  const categoryLabel = SUPPLY_CATEGORIES.find((c) => c.key === product.category)?.label ?? '';
  const priceLabel =
    product.priceMaxPhp && product.priceMaxPhp > product.pricePhp
      ? `${formatPhp(product.pricePhp)}–${formatPhp(product.priceMaxPhp)}`
      : formatPhp(product.pricePhp);

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {categoryLabel}
          </p>
          <h3 className="text-base font-semibold tracking-tight text-ink">
            {product.name}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
          {priceLabel}
        </span>
      </div>

      {!compact ? (
        <p className="text-sm text-ink/65">{product.blurb}</p>
      ) : (
        <p className="line-clamp-2 text-xs text-ink/60">{product.blurb}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {product.vendor}
          {product.unit ? ` · ${product.unit}` : null}
        </p>
        {inCart > 0 ? (
          <div className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream p-0.5">
            <button
              type="button"
              onClick={() => onBump(-1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5"
              aria-label={`Decrease ${product.name} quantity`}
            >
              <Minus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <span className="min-w-6 text-center font-mono text-xs font-medium text-ink">
              {inCart}
            </span>
            <button
              type="button"
              onClick={() => onBump(1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5"
              aria-label={`Increase ${product.name} quantity`}
            >
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Add to cart
          </button>
        )}
      </div>
    </article>
  );
}

function CartDrawer({
  cartLines,
  subtotal,
  onClose,
  onBump,
  onRemove,
}: {
  cartLines: ReadonlyArray<{ entry: CartEntry; product: SupplyProduct }>;
  subtotal: number;
  onClose: () => void;
  onBump: (slug: string, delta: number) => void;
  onRemove: (slug: string) => void;
}) {
  useEscapeKey(onClose); // Escape-to-dismiss
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-heading"
      className="fixed inset-0 z-40"
    >
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <aside className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-cream shadow-xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:rounded-l-2xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-ink/10 bg-cream/95 px-5 py-4 backdrop-blur">
          <h2 id="cart-drawer-heading" className="text-lg font-semibold tracking-tight text-ink">
            Your supplies cart
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
            aria-label="Close cart"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {cartLines.length === 0 ? (
            <p className="text-sm text-ink/55">
              Your cart is empty. Pick items from the catalog to get started.
            </p>
          ) : (
            <ul className="space-y-3">
              {cartLines.map(({ entry, product }) => (
                <li
                  key={entry.slug}
                  className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-cream/60 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-ink">{product.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                      {product.vendor}
                      {product.unit ? ` · ${product.unit}` : null}
                    </p>
                    <p className="font-mono text-xs text-ink/65">
                      {formatPhp(product.pricePhp)} × {entry.qty} ={' '}
                      <span className="font-medium text-ink">
                        {formatPhp(product.pricePhp * entry.qty)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream p-0.5">
                      <button
                        type="button"
                        onClick={() => onBump(entry.slug, -1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5"
                        aria-label={`Decrease ${product.name} quantity`}
                      >
                        <Minus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <span className="min-w-6 text-center font-mono text-xs font-medium text-ink">
                        {entry.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onBump(entry.slug, 1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5"
                        aria-label={`Increase ${product.name} quantity`}
                      >
                        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.slug)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-terracotta/10 hover:text-terracotta"
                      aria-label={`Remove ${product.name}`}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cartLines.length > 0 ? (
            <>
              <div className="space-y-1 rounded-xl border border-ink/10 bg-cream p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink/65">Subtotal (pre-VAT)</span>
                  <span className="font-mono text-base font-semibold text-ink">
                    {formatPhp(subtotal)}
                  </span>
                </div>
                <p className="text-xs text-ink/55">
                  Final price + 12% VAT are confirmed by the Setnayan team once
                  vendor availability is locked. Nothing is charged until you
                  approve the quote.
                </p>
              </div>

              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-ink/10 px-4 py-3 text-sm font-medium text-ink/50"
              >
                <ShoppingCart aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Checkout opens soon
              </button>
              <p className="text-center text-[11px] text-ink/45">
                The Setnayan Supplies marketplace is launching soon — you can
                build your cart now, but checkout isn&rsquo;t available yet.
              </p>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
