import { HandHeart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicGuestBuyEnabled } from '@/lib/papic-guest-buy-flag';

/**
 * "GUESTS CHIPPED IN" — the host is NOTIFIED, not asked (owner-locked
 * 2026-07-29).
 *
 * A guest at the party can buy shots for this event without an account. That is
 * the host's event and the host's gallery, so they get to SEE it — but they do
 * not get to approve it, and there is deliberately no control on this card. A
 * gift that needs permission is not a gift, and a host tapping "decline" on a
 * stranger's ₱1,000 an hour into the reception is a conversation nobody wants.
 *
 * Deliberately the smallest thing that tells the truth: one line per
 * contribution, its state, and nothing else. No payer contact, no reference
 * code, no screenshot — the guest's bank receipt is theirs, and
 * `payments_owner_read` has no event arm, so the host could not read it here
 * even if this card asked (pinned by tests/db/papic-guest-orders.db.test.ts).
 *
 * Self-gating like its siblings:
 *   1. the flag is off  → null;
 *   2. the viewer is not a member of this event (read under THEIR OWN RLS
 *      session, never the admin client) → null;
 *   3. no guest has bought anything → null, rather than an empty card that
 *      teaches the host to ignore this corner of the page.
 */
export async function GuestContributionsCard({ eventId }: { eventId: string }) {
  if (!papicGuestBuyEnabled()) return null;

  // Membership gate under the VIEWER's session — same posture as
  // HostPoolMeterCard. A non-member resolves nothing and the card vanishes.
  const supabase = await createClient();
  const { data: memberEvent } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!memberEvent) return null;

  const rows = await fetchGuestContributions(eventId);
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <HandHeart aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
          Guests chipped in
        </p>
        <p className="text-sm text-ink/70">
          People at your event bought extra shots. Nothing here needs anything from
          you — the shots land the moment we confirm their payment.
        </p>
      </div>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.orderId} className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-ink/80">
              {r.who} added {r.points.toLocaleString('en-PH')} shots{' '}
              {r.kind === 'one_reload' ? 'to their camera' : 'to the shared pool'}
            </span>
            <span
              className={
                r.settled
                  ? 'text-xs font-medium text-emerald-700'
                  : 'text-xs font-medium text-ink/50'
              }
            >
              {r.settled ? 'live' : 'waiting for payment'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Contribution = {
  orderId: string;
  who: string;
  points: number;
  kind: string;
  settled: boolean;
};

/**
 * The event's guest contributions. Admin client on purpose: `papic_guest_orders`
 * carries no read policy (service-role only, by design — the bearer token is
 * checked in the action, not in a predicate), exactly like the pool meter's own
 * read.
 *
 * WHO is a LABEL, never an identity. A guest who gave us no name stays "A guest"
 * — the product promise is that they can buy without telling us who they are,
 * and a card that quietly resolved them to a guest-list row would break it.
 *
 * Degrades to an empty list on any read problem rather than throwing: a missing
 * card is recoverable, a thrown error takes down the whole Papic studio.
 */
async function fetchGuestContributions(eventId: string): Promise<Contribution[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('papic_guest_orders')
      .select('order_id, points, purchase_kind, payer_name, order:orders(status)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];

    return data
      .map((r) => {
        const status =
          (r as { order?: { status?: string | null } | null }).order?.status ?? '';
        // A cancelled order is not a contribution — showing it would tell the
        // host somebody gave them something that never happened.
        if (status === 'cancelled' || status === 'refunded') return null;
        const name = (r as { payer_name?: string | null }).payer_name;
        return {
          orderId: String((r as { order_id: unknown }).order_id),
          who: name && name.trim().length > 0 ? name.trim() : 'A guest',
          points: Number((r as { points?: unknown }).points ?? 0),
          kind: String((r as { purchase_kind?: unknown }).purchase_kind ?? ''),
          settled: status === 'paid' || status === 'fulfilled',
        };
      })
      .filter((r): r is Contribution => r !== null && r.points > 0);
  } catch {
    return [];
  }
}
