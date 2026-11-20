import { TEMPLATE_SUBLINE, TemplateEmpty, TemplateSection } from '@/app/_components/template-rows';
import { actionButtonClass } from '@/components/action-button-class';
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
    <div data-admin-guest-reviews>
      <TemplateSection
        label="Guest reviews"
        data="guest-reviews"
        tip={
          <>
            Public the moment a checked-in guest sends one. Hide one to take it off the shop&rsquo;s page, the shop&rsquo;s
            list and the guests&rsquo; line. Guest stars never move a shop&rsquo;s overall.
          </>
        }
      >
      {read.state === 'refused' ? (
        <ReadFailed what="the guest reviews" />
      ) : read.state === 'none' ? (
        <TemplateEmpty data="guest-reviews">No guest reviews yet.</TemplateEmpty>
      ) : (
        <ul className="divide-y divide-ink/10">
          {read.rows.map((r) => (
            <GuestReviewAdminRow key={r.review_id} row={r} />
          ))}
        </ul>
      )}
      </TemplateSection>
    </div>
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
        <p className={TEMPLATE_SUBLINE}>
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
        <SubmitButton className={actionButtonClass('neutral')} pendingLabel="Saving…">
          {hidden ? 'Show' : 'Hide'}
        </SubmitButton>
      </form>
    </li>
  );
}
