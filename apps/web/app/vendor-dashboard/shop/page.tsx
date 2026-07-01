import { ShoppingBag } from 'lucide-react';

/**
 * /vendor-dashboard/shop — "My Shop" destination placeholder.
 *
 * The 6-menu vendor shell (proto-shell build 2026-07-01) routes the sidebar +
 * mobile bottom-nav "My Shop" tab here. This is the intended HOME of the
 * storefront cluster (Profile · Verify · Website · Reviews · Real Stories ·
 * Recaps · Recommend · Partnerships · Team · Branches · Subscription · Tokens)
 * — a separate build folds those surfaces in. Kept minimal so the route exists,
 * renders, and typechecks now that the nav points at it (orphan-prevention:
 * every nav destination must resolve to a real page).
 */
export const metadata = { title: 'My Shop · Vendor · Setnayan' };

export default function VendorShopPage() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
        >
          <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My Shop</h1>
        <p className="max-w-prose text-base text-ink/65">
          Your storefront — profile, website, reviews, and everything couples see about your
          business.
        </p>
      </header>
      <p
        className="max-w-prose rounded-xl border px-4 py-3 text-sm"
        style={{
          borderColor: 'var(--m-line)',
          background: 'var(--m-paper)',
          color: 'var(--m-slate)',
        }}
      >
        The full My Shop surface is coming. For now, each storefront tool stays reachable from the
        menu and the More landing.
      </p>
    </section>
  );
}
