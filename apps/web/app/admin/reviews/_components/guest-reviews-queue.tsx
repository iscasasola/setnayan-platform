import { InfoTip } from '@/app/_components/info-tip';
import { ShieldCheck } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { ReadFailed } from '../../_components/read-failed';
import type { AdminGuestReviewRow, AdminGuestReviewsRead } from '@/lib/guest-reviews';
import { dismissReviewFlag } from '../actions';

/**
 * ⭐ GUEST REVIEWS — newest 50, every shop, hidden ones included (marked). Owner ruling A (6 Nov): public at once, no
 * approval queue; Setnayan hides one here. Hide/Show saves in place.
 */
export function GuestReviewsQueue({ read }: { read: AdminGuestReviewsRead }) {
  return (
    <section className="mb-10 space-y-4" aria-labelledby="guest-reviews-heading" data-admin-guest-reviews>
      <header className="space-y-0.5">
        <h2 id="guest-reviews-heading" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ShieldCheck aria-hidden className="h-4 w-4 text-link" strokeWidth={1.75} />
          Guest reviews
        </h2>
        <div>
          <InfoTip label="About guest reviews" align="start" labelClassName="text-[13px] font-semibold text-ink/70">
            Public the moment a checked-in guest sends one. Hide one to take it off the shop&rsquo;s page, the shop&rsquo;s
          list and the guests&rsquo; line. Guest stars never move a shop&rsquo;s overall.
          </InfoTip>
        </div>
      </header>
      {read.state === 'refused' ? (
        <ReadFailed what="the guest reviews" />
      ) : read.state === 'none' ? (
        <p className="py-2 text-sm text-ink/55">No guest reviews yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {read.rows.map((r) => (
            <GuestReviewAdminRow key={r.review_id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GuestReviewAdminRow({ row }: { row: AdminGuestReviewRow }) {
  const hidden = row.hidden_at !== null;
  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-3 py-3 text-xs ${hidden ? 'text-ink/50' : 'text-ink/70'}`}
      data-guest-review-admin={hidden ? 'hidden' : 'shown'}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">
          {row.rating_overall}★ · {row.vendor_name ?? 'A shop'} · {row.shown_name} · {row.created_at.slice(0, 10)}
          {hidden ? ' · hidden' : ''}
        </p>
        {row.service_title ? <p>For {row.service_title}</p> : null}
        {row.line ? <p className="text-sm text-ink">&ldquo;{row.line}&rdquo;</p> : <p className="italic">Stars only.</p>}
      </div>
      {/* `kind=guest_visibility`: the guest half of the moderator's one "does this review stay" action. */}
      <form action={dismissReviewFlag}>
        <input type="hidden" name="kind" value="guest_visibility" />
        <input type="hidden" name="review_id" value={row.review_id} />
        <input type="hidden" name="hide" value={hidden ? '0' : '1'} />
        <SubmitButton className="button-secondary inline-flex min-h-11 items-center px-3 text-xs" pendingLabel="Saving…">
          {hidden ? 'Show' : 'Hide'}
        </SubmitButton>
      </form>
    </li>
  );
}
