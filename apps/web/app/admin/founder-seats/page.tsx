import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { FOUNDER_SEAT_CAP } from '@/lib/founder-seats';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { grantFounderSeat, revokeFounderSeat } from './actions';

export const metadata = { title: 'Founder seats · Admin' };
export const dynamic = 'force-dynamic';

/**
 * Admin · Founder seats (owner-locked 2026-07-16 · migration 20270818135217).
 *
 * Up to 10 owner-granted platform-founder accounts — Ice + Cale first, the
 * rest "filled later" from this surface. A seat confers, everywhere at once:
 *   • token-free vendor inquiries (the vendor's accept is comped — unlock row
 *     at 0 tokens + comp_reason 'founder'; no debit, no hold);
 *   • every in-app SKU already paid for on the founder's events
 *     (eventSkuActive ORs in event_host_holds_founder_seat);
 *   • the server-asserted "Setnayan Founder" badge on the vendor's thread +
 *     inquiry notification.
 * Vendor money is untouched — founders pay vendors directly like any client.
 *
 * Grants are the ONLY write path (founder_seats has no write policies; the
 * actions use the service-role client + admin_audit_log). The 1..10 cap is
 * enforced by the DB CHECK, re-checked in the action, and visible here as the
 * fixed 10-row seat board.
 */

type SeatRow = {
  seat_no: number;
  user_id: string;
  label: string | null;
  granted_at: string;
  users: { email: string | null } | null;
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminFounderSeatsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const errorMsg = first(search.error);
  const savedMsg = first(search.saved);

  const admin = createAdminClient();
  const { data } = await admin
    .from('founder_seats')
    .select('seat_no, user_id, label, granted_at, users ( email )')
    .order('seat_no');
  const seats = (data ?? []) as unknown as SeatRow[];
  const bySeat = new Map(seats.map((s) => [s.seat_no, s]));
  const openSeats = FOUNDER_SEAT_CAP - seats.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          Accounts
        </p>
        <h1 className="text-2xl font-semibold text-ink">Founder seats</h1>
        <p className="mt-1 text-sm text-ink/70">
          Up to {FOUNDER_SEAT_CAP} owner-granted founder accounts. A seat means every
          in-app feature is already paid for, vendor inquiries are token-free for the
          vendor, and vendors see the server-asserted “Setnayan Founder” badge.
          Vendors are still paid directly, like by any client.
        </p>
      </header>

      {errorMsg ? <FormFlash tone="error">{errorMsg}</FormFlash> : null}
      {savedMsg ? <FormFlash tone="success">{savedMsg}</FormFlash> : null}

      <section className="sn-row mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          Grant a seat{' '}
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
            {openSeats} of {FOUNDER_SEAT_CAP} open
          </span>
        </h2>
        <form action={grantFounderSeat} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-ink/70">
            Account email
            <input
              type="email"
              name="email"
              required
              placeholder="name@example.com"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-ink/70">
            Label (optional)
            <input
              type="text"
              name="label"
              placeholder="e.g. Cale"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
            />
          </label>
          <SubmitButton pendingLabel="Granting…">Grant seat</SubmitButton>
        </form>
      </section>

      <section className="space-y-2">
        {Array.from({ length: FOUNDER_SEAT_CAP }, (_, i) => i + 1).map((n) => {
          const seat = bySeat.get(n);
          return (
            <div
              key={n}
              className="sn-row flex items-center justify-between gap-3 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                  Seat {n}
                </span>
                {seat ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {seat.label || seat.users?.email || seat.user_id}
                      <span className="ml-2 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta">
                        Setnayan Founder
                      </span>
                    </p>
                    <p className="truncate font-mono text-[11px] text-ink/55">
                      {seat.users?.email ?? seat.user_id} · granted{' '}
                      {new Date(seat.granted_at).toLocaleDateString('en-PH')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink/45">Empty — fill later.</p>
                )}
              </div>
              {seat ? (
                <form action={revokeFounderSeat}>
                  <input type="hidden" name="seat_no" value={n} />
                  <SubmitButton pendingLabel="Revoking…">Revoke</SubmitButton>
                </form>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
