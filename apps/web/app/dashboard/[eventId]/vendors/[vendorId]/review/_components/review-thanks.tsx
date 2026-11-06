import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { BackButton } from '@/app/_components/back-button';
import { SaveVendorButton } from '@/app/(shell)/explore/_components/save-vendor-button';
import { SmallStars } from '@/app/v/[slug]/_components/review-groups';
import { clipQuote, monthYear } from '@/lib/card-reviews';

/** What the thank-you needs of the review that was just written — read back from the row, never from the form. */
export type ThanksReview = {
  ratingOverall: number;
  body: string | null;
  createdAt: string;
  bookedThroughSetnayan: boolean;
};

/**
 * 💌 WHAT THEY SEE AFTER — prototype 6 Nov § 3 ("same route, ?sent=1"). Before, the submit landed on the Suppliers list
 * with a `?reviewed=` nothing read.
 *
 *   ← Back · "Thank you, <couple>" · "Your review is on <shop>’s card and their page."
 *   the review as it now reads (card name · stars · the opening words · ✓ Verified booking · <Shown as> · Mon YYYY)
 *   Keep <shop> — the SHIPPED Save (explore/_components/save-vendor-button.tsx), unchanged
 *   See it on <shop>’s page   (the way back to Suppliers is the shared BackButton at the top, as the prototype's ← row)
 *
 * ⛔ TWO BLOCKS OF THE PROTOTYPE ARE NOT DRAWN, ON PURPOSE (both "owner-approved · not built" there):
 *   · "A thank-you from Setnayan" (Papic credits) — no catalogue product and no grant ledger exists for it; a credit
 *     amount nobody can cite is a guess about money (CLAUDE.md rule 9). It lands when the owner names the product.
 *   · "Next event with us" — no supplier can set an offer yet (Promote › Your gifts says so, § 6). A block for an offer
 *     that cannot exist would be a promise with nothing behind it.
 * "Review the next card" is not drawn either: a host review is still one per shop per event.
 */
export function ReviewThanks({
  eventId,
  vendorId,
  coupleName,
  shownName,
  shopName,
  slug,
  vendorProfileId,
  cardTitle,
  review,
}: {
  eventId: string;
  vendorId: string;
  coupleName: string | null;
  shownName: string | null;
  shopName: string;
  slug: string | null;
  vendorProfileId: string;
  cardTitle: string | null;
  review: ThanksReview;
}) {
  const quote = clipQuote(review.body);
  const by = [shownName ?? 'Verified couple', monthYear(review.createdAt)].filter(Boolean).join(' · ');
  return (
    <section className="space-y-4" data-review-state="thanks">
      <BackButton route="/dashboard/[eventId]/vendors/[vendorId]/review" params={{ eventId, vendorId }} />
      <h1 className="text-2xl font-semibold tracking-tight">Thank you{coupleName ? `, ${coupleName}` : ''}</h1>
      <p className="max-w-prose text-base text-ink/65">
        Your review is on {shopName}&rsquo;s {cardTitle ? 'card and their ' : ''}page.
      </p>

      <div className="sn-glass-bare rounded-xl p-4" data-review-thanks-review="">
        {cardTitle ? <p className="font-medium text-ink">{cardTitle}</p> : null}
        <div className={cardTitle ? 'mt-1.5' : undefined}>
          <SmallStars value={review.ratingOverall} />
        </div>
        {quote ? <blockquote className="mt-1.5 text-sm text-ink/80">&ldquo;{quote}&rdquo;</blockquote> : null}
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink/65">
          {review.bookedThroughSetnayan ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
              <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
              Verified booking
            </span>
          ) : null}
          <span>{review.bookedThroughSetnayan ? `· ${by}` : by}</span>
        </p>
      </div>

      <div className="sn-glass-bare rounded-xl px-5 py-4" data-review-thanks-keep="">
        <p className="text-[15px] font-medium text-ink">Keep {shopName}</p>
        <p className="mt-0.5 text-sm text-ink/65">Saved suppliers wait under Find for your next event.</p>
        <div className="mt-2">
          <SaveVendorButton vendorProfileId={vendorProfileId} initiallySaved={false} variant="profile" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        {slug ? (
          <Link href={`/v/${slug}#reviews`} className="button-primary inline-flex">
            See it on {shopName}&rsquo;s page
          </Link>
        ) : null}
      </div>
    </section>
  );
}
