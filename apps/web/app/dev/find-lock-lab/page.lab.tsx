/**
 * /dev/find-lock-lab — fixture data, no sign-in, no database. DEV-ONLY: production builds 404 this route first thing.
 *
 * ⚠ 15 Nov SUPERSEDES the 2026-11-07 "findable until its first inquiry" rule this lab was built for: an unverified
 * shop is in no list at all ("Verified only"), and it is messaged AND booked on its own page ("We allow booking").
 * The first-inquiry lock still stamps but decides nothing, so the admin line no longer has a lift. This lab now
 * draws the REAL `FindLine` per state and the unverified shop page's identity block; it is kept until the lock
 * machinery itself is retired. The proof is
 * `tests/db/an-unverified-shop-is-booked-on-its-page-and-found-only-once-verified.db.test.ts`.
 */
import { notFound } from 'next/navigation';
import { MapPin, MessageCircle, Send } from 'lucide-react';

import { FindLine } from '@/app/admin/verify/_components/find-line';
import { NotYetVerifiedNotice } from '@/app/v/[slug]/_components/not-yet-verified-notice';
import { ShareButton } from '@/app/v/[slug]/_components/share-button';
import { CheckADateLink } from '@/app/v/[slug]/_components/check-a-date-link';
import { findLockState, shopTakesMessages } from '@/lib/findable-shop';
import { isBookable, parseVisibility } from '@/lib/vendor-visibility';

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

export default async function FindLockLabPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; locked?: string; verified?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;

  if (sp.f === 'shop') {
    // 💬 Round 2 (rulings (1)+(4)): the doors are decided by the REAL `isBookable` + `shopTakesMessages`, exactly as
    // /v/[slug] decides them — never typed. `&locked=1` = after its first inquiry (opened by its own link/QR);
    // `&verified=1` = the verified shop, for comparison (Check a date back).
    const shopRow = sp.verified === '1' ? SHOPS[3] : sp.locked === '1' ? SHOPS[0] : SHOPS[2];
    const bookable = isBookable(parseVisibility(shopRow.row.public_visibility));
    const canMessage = shopTakesMessages(shopRow.row, bookable);
    return (
      <main className="min-h-screen bg-cream">
        {shopRow.row.verification_state !== 'verified' ? <NotYetVerifiedNotice /> : null}
        <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <section className="space-y-2 border-b border-ink/10 pb-8">
            <h1 className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink sm:text-5xl">{shopRow.name}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {shopRow.city}
              </span>
              {canMessage ? (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Replies in your Setnayan inbox
                </span>
              ) : null}
            </div>
            {canMessage ? (
              <div className="flex flex-wrap items-center gap-2 pt-4">
                <a href="#get-in-touch" className="button-primary inline-flex items-center gap-2">
                  <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Inquire
                </a>
                <ShareButton title={shopRow.name} className="button-secondary inline-flex items-center gap-2" />
                {bookable ? (
                  <CheckADateLink href="/v/lab/dates" className="button-secondary inline-flex items-center gap-2" />
                ) : null}
              </div>
            ) : null}
          </section>
          <section id="get-in-touch" className="space-y-4 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              {canMessage ? 'Inquire' : 'Not yet bookable'}
            </h2>
            <p className="max-w-2xl text-sm text-ink/65">
              {bookable ? (
                <>
                  Send <span className="font-medium text-ink">{shopRow.name}</span> an inquiry below — they&rsquo;ll
                  reply in your Setnayan inbox, and the conversation stays with your event.
                </>
              ) : (
                <>
                  Send <span className="font-medium text-ink">{shopRow.name}</span> a message below — they&rsquo;ll
                  reply in your Setnayan inbox. Booking opens once Setnayan verifies them.
                </>
              )}
            </p>
            <p className="text-xs text-ink/45">(lab) the shipped inquiry composer opens here.</p>
          </section>
        </article>
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
