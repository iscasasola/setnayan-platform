import { Heart, Check, AlertCircle } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { recommendVendor, withdrawRecommendation } from '../actions';

/**
 * Recommend-this-vendor card (Event Lifecycle Menu §6.3). Shown on the After
 * review page only when the vendor is completion-confirmed (the same gate the
 * review unlocks behind), since a recommendation is SEPARATE from a review and
 * carries a higher anti-fake bar (the RLS insert enforces completion). The
 * couple opts in per vendor, with an optional one-line endorsement, and can
 * withdraw at any time (reversible).
 *
 * Server component — both forms post to server actions (recommendVendor /
 * withdrawRecommendation); no client state needed.
 */
export function RecommendVendorCard({
  eventId,
  vendorId,
  vendorProfileId,
  vendorName,
  recommended,
  endorsement,
  blocked = false,
}: {
  eventId: string;
  vendorId: string;
  vendorProfileId: string;
  vendorName: string;
  recommended: boolean;
  endorsement: string | null;
  blocked?: boolean;
}) {
  const hidden = (
    <>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_id" value={vendorId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
    </>
  );

  return (
    <section className="space-y-3 rounded-2xl border border-mulberry/20 bg-mulberry/[0.04] p-6">
      <header className="space-y-1">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-mulberry">
          <Heart aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Recommend
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {recommended
            ? `You recommend ${vendorName}`
            : `Would you recommend ${vendorName}?`}
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          A recommendation is your explicit thumbs-up — separate from the star review. It shows
          on your event page and as a “recommended by N couples” badge on their marketplace
          profile. You can change your mind anytime.
        </p>
      </header>

      {blocked ? (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          We couldn&rsquo;t save that yet — a recommendation needs the vendor&rsquo;s service marked
          complete for this event.
        </p>
      ) : null}

      {recommended ? (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
            Added to your recommended vendors
          </p>
          <form action={recommendVendor} className="space-y-2">
            {hidden}
            <label
              className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
              htmlFor="endorsement"
            >
              Your endorsement (optional)
            </label>
            <textarea
              id="endorsement"
              name="endorsement"
              rows={2}
              maxLength={280}
              defaultValue={endorsement ?? ''}
              placeholder="One line on why you'd recommend them…"
              className="input-field min-h-[64px] py-2"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink/50">Up to 280 characters.</p>
              <SubmitButton className="button-secondary" pendingLabel="Saving…">
                Update endorsement
              </SubmitButton>
            </div>
          </form>
          <form action={withdrawRecommendation}>
            {hidden}
            <SubmitButton
              className="text-xs font-medium text-ink/50 underline-offset-2 hover:text-ink hover:underline"
              pendingLabel="Removing…"
            >
              Remove recommendation
            </SubmitButton>
          </form>
        </div>
      ) : (
        <form action={recommendVendor} className="space-y-2">
          {hidden}
          <label
            className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
            htmlFor="endorsement"
          >
            Add a line (optional)
          </label>
          <textarea
            id="endorsement"
            name="endorsement"
            rows={2}
            maxLength={280}
            placeholder="One line on why you'd recommend them…"
            className="input-field min-h-[64px] py-2"
          />
          <div className="flex items-center justify-end pt-1">
            <SubmitButton className="button-primary" pendingLabel="Saving…">
              Recommend {vendorName}
            </SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
