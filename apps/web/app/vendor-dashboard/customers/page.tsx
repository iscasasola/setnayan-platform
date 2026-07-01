import { Users } from 'lucide-react';

/**
 * /vendor-dashboard/customers — "My Customers" destination placeholder.
 *
 * The 6-menu vendor shell (proto-shell build 2026-07-01) routes the sidebar +
 * mobile bottom-nav "My Customers" tab here. This is the intended HOME of the
 * booking-pipeline cluster (Messages · Clients · Bookings · Calendar ·
 * Contracts · Proposals · Earnings · Payday · How clients pay you) — a separate
 * build folds those surfaces in. Kept minimal so the route exists, renders, and
 * typechecks now that the nav points at it (orphan-prevention: every nav
 * destination must resolve to a real page).
 */
export const metadata = { title: 'My Customers · Vendor · Setnayan' };

export default function VendorCustomersPage() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
        >
          <Users className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My Customers</h1>
        <p className="max-w-prose text-base text-ink/65">
          The couples you work with — messages, bookings, contracts, and the money that flows from
          them.
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
        The full My Customers surface is coming. For now, each pipeline tool stays reachable from
        the menu and the More landing.
      </p>
    </section>
  );
}
