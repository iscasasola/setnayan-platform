import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { FOUNDER_SEAT_CAP } from '@/lib/founder-seats';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { grantFounderSeat, revokeFounderSeat } from './actions';
import { formatCount } from '@/lib/format-number';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ReadFailed } from '../_components/read-failed';
import { PostedFieldRow } from '../_components/posted-field-row';
import { ADMIN_FRAME } from '../_components/admin-frame';
import { FormRows } from '@/app/_components/form-row';
import { TEMPLATE_SUBLINE, TemplateRow, TemplateRows, TemplateSection } from '@/app/_components/template-rows';
import { actionButtonClass } from '@/components/action-button-class';

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
  const { data, error: seatsError } = await admin
    .from('founder_seats')
    // 🪪 AW-7 (admin walk 14 Nov 2026): founder_seats has TWO keys to users (user_id and granted_by), so a bare
    // `users ( email )` embed is ambiguous and PostgREST refused the WHOLE read — the page said "Couldn't read the
    // founder seats" over a real seat. Name the key: the email shown is the seat-holder's.
    .select('seat_no, user_id, label, granted_at, users!founder_seats_user_id_fkey ( email )')
    .order('seat_no');
  if (seatsError) logQueryError('AdminFounderSeatsPage (founder_seats)', seatsError);
  const seatsUnread = Boolean(seatsError);
  const seats = (data ?? []) as unknown as SeatRow[];
  const bySeat = new Map(seats.map((s) => [s.seat_no, s]));
  const openSeats = FOUNDER_SEAT_CAP - seats.length;

  // 📐 ADMIN CLEAN PORT (owner "ok", 19 Nov 2026 — reposition only): the pinned row names the page; the sentence
  // about what a seat gives moved behind the ⓘ; the grant form is Form rows in one frame; each seat is ONE row with
  // ONE action (Revoke). Same reads, same two server actions, same posted names (`email`, `label`, `seat_no`).
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      <PageMasthead title="Founder seats" />

      {errorMsg ? <FormFlash tone="error">{errorMsg}</FormFlash> : null}
      {savedMsg ? <FormFlash tone="success">{savedMsg}</FormFlash> : null}

      <TemplateSection
        label="Grant a seat"
        first
        data="grant"
        /* ⚖ The sentence survives, behind the ⓘ: granting one of these gives an account every paid feature for good,
           and the last line — suppliers are still paid directly, like by any client — is the part that stops somebody
           thinking a seat is Setnayan covering a supplier's fee. (The "token-free vendor inquiries" clause was removed
           2026-09-08: answering became free for EVERY vendor when the inbox was ungated and token packs retired.) */
        tip={
          <>
            Up to {FOUNDER_SEAT_CAP} owner-granted founder accounts. A seat means every
            in-app feature is already paid for, and suppliers see the server-asserted
            “Setnayan Founder” badge. Suppliers are still paid directly, like by any
            client.
          </>
        }
        right={
          /* A refused read never prints a blank or a guessed count (AW-7). */
          seatsUnread
            ? `Couldn’t count the open seats — ${formatCount(FOUNDER_SEAT_CAP)} in all`
            : `${formatCount(openSeats)} of ${formatCount(FOUNDER_SEAT_CAP)} open`
        }
      >
        <form action={grantFounderSeat} className={`${ADMIN_FRAME} px-4 py-2`}>
          <FormRows width="wide">
            <PostedFieldRow name="Account email" fieldName="email" empty="name@example.com" />
            <PostedFieldRow name="Label (optional)" fieldName="label" empty="e.g. Cale" />
          </FormRows>
          <div className="flex justify-end pb-2 pt-1">
            <SubmitButton pendingLabel="Granting…" className={actionButtonClass('brand', { main: true })}>
              Grant seat
            </SubmitButton>
          </div>
        </form>
      </TemplateSection>

      <TemplateSection label="Seats" data="seats">
        {seatsUnread ? (
          <ReadFailed what="the founder seats — every seat would look empty, and that is not known" />
        ) : null}

        {/* The frame is drawn only over a read that worked; the board inside keeps its own refused-read gate (AW-7). */}
        {!seatsUnread && (
          <TemplateRows label="Founder seats">
            {seatsUnread ? null : Array.from({ length: FOUNDER_SEAT_CAP }, (_, i) => i + 1).map((n) => {
              const seat = bySeat.get(n);
              return (
                <TemplateRow
                  key={n}
                  data={`seat-${n}`}
                  lead={<span className={TEMPLATE_SUBLINE}>Seat {n}</span>}
                  title={seat ? seat.label || seat.users?.email || seat.user_id : <span className="font-normal text-ink/45">Empty — fill later.</span>}
                  line={
                    seat ? (
                      <>
                        Setnayan Founder · {seat.users?.email ?? seat.user_id} · granted{' '}
                        {new Date(seat.granted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
                      </>
                    ) : undefined
                  }
                  right={
                    seat ? (
                      <form action={revokeFounderSeat}>
                        <input type="hidden" name="seat_no" value={n} />
                        <SubmitButton pendingLabel="Revoking…" className={actionButtonClass('danger')}>
                          Revoke
                        </SubmitButton>
                      </form>
                    ) : undefined
                  }
                />
              );
            })}
          </TemplateRows>
        )}
      </TemplateSection>
    </div>
  );
}
