/**
 * /dev/find-lock-lab — DECISION_LOG 2026-11-07 "🔎 AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS FIRST INQUIRY", on
 * fixture data. No sign-in, no database. DEV-ONLY: production builds 404 this route first thing. It mounts the REAL
 * pieces, so what it shows is what ships:
 *
 *   ?f=admin   Admin › Verify › Visibility: the REAL `FindLine` (app/admin/verify/_components/find-line.tsx) on the
 *              four lock states `findLockState` returns — locked by an inquiry (with the green "Lift the lock" pill),
 *              locked by an import, findable until its first inquiry, verified. Its form posts to the real
 *              `liftFindLock`, which refuses here (no admin session): open the dialog, press Cancel.
 *   ?f=shop    The shop page band a couple sees on a shop Setnayan has not verified yet — the REAL
 *              `NotYetVerifiedNotice`.
 *
 * The supplier's own notice ("You’ve had your first inquiry — get verified to be found again" + Verify) is drawn on
 * the real Today screen at /dev/supplier-lab?easy=findlock. The database half (the stamp, the lock surviving a
 * deleted inquiry, the lift, a shop unable to unlock itself) is
 * `tests/db/an-unverified-shop-is-findable-until-its-first-inquiry.db.test.ts` — this page is the picture, that
 * test is the proof.
 */
import { notFound } from 'next/navigation';

import { FindLine } from '@/app/admin/verify/_components/find-line';
import { NotYetVerifiedNotice } from '@/app/v/[slug]/_components/not-yet-verified-notice';
import { findLockState } from '@/lib/findable-shop';

const NOT_FROZEN = { fraud_suspended_at: null, fraud_banned_at: null, fraud_tombstoned: false } as const;

/** Four shops, one per state — each state computed by the real `findLockState`, never typed. */
const SHOPS = [
  {
    id: '00000000-0000-4000-8000-00000000f001',
    name: 'Bulaklak Floral Studio',
    city: 'Quezon City',
    row: { public_visibility: 'hidden', verification_state: 'unverified', find_locked_at: '2026-11-05T02:00:00Z', find_lock_reason: 'inquiry', ...NOT_FROZEN },
    liftedAt: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000f002',
    name: 'Tala Lights & Sound',
    city: 'Pasig',
    row: { public_visibility: 'hidden', verification_state: 'pending_review', find_locked_at: '2026-11-03T09:00:00Z', find_lock_reason: 'import', ...NOT_FROZEN },
    liftedAt: null,
  },
  {
    id: '00000000-0000-4000-8000-00000000f003',
    name: 'Kusina ni Lola Catering',
    city: 'Cavite',
    row: { public_visibility: 'hidden', verification_state: 'unverified', find_locked_at: null, find_lock_reason: null, ...NOT_FROZEN },
    liftedAt: '2026-11-01T04:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-00000000f004',
    name: 'Liwanag Photo & Film',
    city: 'Makati',
    row: { public_visibility: 'verified', verification_state: 'verified', find_locked_at: null, find_lock_reason: null, ...NOT_FROZEN },
    liftedAt: null,
  },
] as const;

export default async function FindLockLabPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;

  if (sp.f === 'shop') {
    return (
      <main className="min-h-screen bg-cream">
        <header className="border-b border-ink/10 bg-paper px-4 py-4 sm:px-6 lg:px-8">
          <p className="font-serif text-2xl text-ink">Bulaklak Floral Studio</p>
          <p className="text-sm text-ink/60">Florist · Quezon City</p>
        </header>
        <NotYetVerifiedNotice />
        <section className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-ink/60 sm:px-6 lg:px-8">
          The shop’s page continues here, exactly as for every shop.
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl divide-y divide-ink/10">
        <p className="pb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">Admin › Verify › Out of Find</p>
        {SHOPS.map((s) => (
          <article key={s.id} className="space-y-3 py-4">
            <div>
              <p className="font-semibold text-ink">{s.name}</p>
              <p className="text-xs text-ink/55">{s.city}</p>
            </div>
            <FindLine vendorProfileId={s.id} state={findLockState(s.row)} liftedAt={s.liftedAt} />
          </article>
        ))}
      </div>
    </main>
  );
}
