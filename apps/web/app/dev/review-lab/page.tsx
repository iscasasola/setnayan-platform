/**
 * /dev/review-lab — host and guest reviews (owner, 6 Nov 2026) on fixture data, for the side-by-side proof against
 * the approved prototype (claude.ai/artifact/GWJhmWLcRijfyofpTLLs8o). No sign-in, no database. DEV-ONLY: production
 * builds 404 this route first thing.
 *
 * It mounts the REAL new pieces — ReviewRequestCard, CoordinatorRefusedState, GuestReviewHeader, GuestReviewForm,
 * GuestReviewThanks, the guest-review states, the shop page's review groups, and Admin › Reviews' guest queue. The
 * shells around the host form and the shop's Reviews section are copies of page-private markup in their pages
 * (`review/page.tsx`, `v/[slug]/page.tsx` — a Next page cannot export it); they hold no new logic.
 *
 *   ?s=request | request2 | coordinator | guest | thanks | nodoor | said | shop | shop-refused | admin
 *      | shownas (§ 2) | hostthanks (§ 3) | card (§ 4 / § 9) | hub (§ 8 door 2)
 *   § 6 (Promote › Your gifts › Next event with us) is drawn by the shipped lab: /dev/supplier-plan-lab?s=gifts
 */
import { notFound } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { ReviewRequestCard } from '@/app/dashboard/[eventId]/vendors/[vendorId]/review/_components/review-request-card';
import { CoordinatorRefusedState } from '@/app/dashboard/[eventId]/vendors/[vendorId]/review/_components/coordinator-refused-state';
import { GuestReviewHeader } from '@/app/v/[slug]/guest-review/_components/guest-review-header';
import { GuestReviewThanks } from '@/app/v/[slug]/guest-review/_components/guest-review-form';
import { NotOnDoorList, Said, Shell } from '@/app/v/[slug]/guest-review/_components/guest-review-states';
import {
  GuestReviewsGroup,
  GuestStarsLine,
  ReviewForLine,
  ReviewGroupHead,
} from '@/app/v/[slug]/_components/review-groups';
import { GuestReviewsQueue } from '@/app/admin/reviews/_components/guest-reviews-queue';
import { GUEST_REVIEW_REFUSAL_LINE, type GuestReviewRow, type GuestReviewsRead } from '@/lib/guest-reviews';
import { LabGuestReviewForm } from './lab-guest-review-form';
import { LabCardWithReviews, LabHubAfterDay } from './lab-client-pieces';
import { ShownAsRow } from '@/app/dashboard/[eventId]/vendors/[vendorId]/review/_components/shown-as-row';
import { ReviewThanks } from '@/app/dashboard/[eventId]/vendors/[vendorId]/review/_components/review-thanks';
import { StarRatingInput } from '@/app/_components/star-rating-input';
import { OnTimeBinaryInput } from '@/app/_components/on-time-binary-input';
import { REVIEW_AXIS_LABEL, REVIEW_ON_TIME_LABEL } from '@/lib/reviews';
import { ShieldCheck } from 'lucide-react';

const SHOP = 'Bloom & Co.';
const EVENT_LINE = 'Dec 12, 2026 · Ana & Miguel’s wedding';
const svg = (a: string, b: string, c: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'><rect width='36' height='36' fill='${a}'/><circle cx='13' cy='14' r='6' fill='${b}'/><circle cx='22' cy='12' r='5.5' fill='rgb(239,217,226)'/><circle cx='18' cy='20' r='6' fill='${c}'/><path d='M18 26v10' stroke='rgb(95,122,74)' stroke-width='2'/></svg>`,
  )}`;
const BOUQUET = svg('rgb(233,226,234)', 'rgb(107,90,126)', 'rgb(255,255,255)');
const SHOT_A = svg('rgb(243,238,230)', 'rgb(217,196,207)', 'rgb(122,139,111)');
const SHOT_B = svg('rgb(239,231,220)', 'rgb(122,139,111)', 'rgb(217,196,207)');

const GABRIEL: GuestReviewRow = {
  review_id: 'g1',
  vendor_profile_id: 'lab',
  event_id: 'lab',
  service_id: 's1',
  rating_overall: 5,
  line: '[Example — one line of up to 140 characters.]',
  capture_id: 'c1',
  shown_as: 'name',
  vendor_reply: null,
  vendor_reply_at: null,
  hidden_at: null,
  created_at: '2026-12-12T08:00:00Z',
  shown_name: 'Gabriel D.',
  service_title: 'Garden bridal bouquet',
};
const GUESTS: GuestReviewsRead = { state: 'rows', stats: { count: 40, average: 4.9 }, rows: [GABRIEL] };

type S =
  | 'request' | 'request2' | 'coordinator' | 'guest' | 'thanks' | 'nodoor' | 'said' | 'shop' | 'shop-refused' | 'admin'
  | 'shownas' | 'hostthanks' | 'card' | 'hub';
const STATES: ReadonlyArray<S> = [
  'request', 'request2', 'coordinator', 'guest', 'thanks', 'nodoor', 'said', 'shop', 'shop-refused', 'admin',
  'shownas', 'hostthanks', 'card', 'hub',
];

export default async function ReviewLabPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const s: S = (STATES as ReadonlyArray<string>).includes(sp.s ?? '') ? (sp.s as S) : 'request';

  if (s === 'request' || s === 'request2') {
    const cards =
      s === 'request'
        ? [{ serviceId: 's1', title: 'Garden bridal bouquet', photoUrl: BOUQUET }]
        : [
            { serviceId: 's1', title: 'Garden bridal bouquet', photoUrl: BOUQUET },
            { serviceId: 's2', title: 'Table centrepieces', photoUrl: SHOT_B },
          ];
    return (
      <main className="mx-auto w-full max-w-3xl bg-cream px-4 py-6">
        {/* Shell: a copy of review/page.tsx's header + form frame. The card is the real component. */}
        <section className="space-y-6">
          <header className="space-y-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink/60">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Back to suppliers
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How was {SHOP}?</h1>
            <p className="max-w-prose text-base text-ink/65">
              Reviews are public on the Setnayan marketplace and on the supplier&rsquo;s landing page. They&rsquo;re
              permanent per the Vendor Agreement &sect;&nbsp;3.10 — the supplier can reply once, but the review itself
              stays as you wrote it.
            </p>
          </header>
          <div className="space-y-6">
            <ReviewRequestCard cards={cards} eventLine={EVENT_LINE} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Ratings</h2>
          </div>
        </section>
      </main>
    );
  }

  if (s === 'shownas') {
    // Shell: a copy of review/page.tsx's form (Ratings · the message · Shown as · the foot). Inputs and the Shown-as
    // row are the real components.
    return (
      <main className="mx-auto w-full max-w-3xl bg-cream px-4 py-6">
        <form className="space-y-6 rounded-2xl border border-ink/10 bg-cream p-6" /* no-card-ok: a copy of the shipped form frame */>
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Ratings</h2>
            <ul className="divide-y divide-ink/10">
              {(['overall', 'communication', 'quality', 'value'] as const).map((axis) => (
                <li key={axis} className="py-2">
                  <StarRatingInput name={`rating_${axis}`} label={REVIEW_AXIS_LABEL[axis]} required />
                </li>
              ))}
              <li className="py-2">
                <OnTimeBinaryInput name="rating_on_time" label={REVIEW_ON_TIME_LABEL} required />
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <label className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55" htmlFor="body">
              Tell other couples about your experience (optional)
            </label>
            <textarea /* field-ok: a copy of the shipped review form's message box */ id="body" name="body" rows={5} maxLength={500} placeholder="What stood out? Anything future couples should know?" className="input-field min-h-[120px] py-2" />
            <p className="text-xs text-ink/50">Up to 500 characters.</p>
          </section>
          <ShownAsRow names="Ana & Miguel" initials="A. & M." />
          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
            <p className="inline-flex items-center gap-2 text-xs text-ink/60">
              <ShieldCheck className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
              Verified couple — review tied to a delivered service.
            </p>
            <span className="button-primary">Submit review</span>
          </div>
        </form>
      </main>
    );
  }

  if (s === 'hostthanks') {
    return (
      <main className="mx-auto w-full max-w-3xl bg-cream px-4 py-6">
        <ReviewThanks
          eventId="lab"
          vendorId="lab"
          coupleName="Ana & Miguel"
          shownName="A. & M."
          shopName={SHOP}
          slug="bloom-and-co"
          vendorProfileId="00000000-0000-4000-8000-000000000001"
          cardTitle="Garden bridal bouquet"
          review={{
            ratingOverall: 5,
            body: '[Example — the first words of what you wrote.]',
            createdAt: '2026-12-14T08:00:00Z',
            bookedThroughSetnayan: true,
          }}
        />
      </main>
    );
  }

  if (s === 'card') {
    return (
      <main className="mx-auto w-full max-w-3xl bg-cream px-4 py-6">
        <LabCardWithReviews shotUrl={SHOT_A} />
      </main>
    );
  }

  if (s === 'hub') {
    return (
      <main className="mx-auto w-full max-w-3xl bg-cream px-4 py-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Guest Hub · after the day · Me</p>
        <LabHubAfterDay />
      </main>
    );
  }

  if (s === 'coordinator') {
    return (
      <main className="mx-auto w-full max-w-3xl bg-cream px-4 py-6">
        <CoordinatorRefusedState eventId="lab" vendorId="lab" vendorName={SHOP} unread={false} />
      </main>
    );
  }

  if (s === 'guest' || s === 'thanks' || s === 'said') {
    return (
      <div className="min-h-dvh bg-cream">
        <Shell>
          <GuestReviewHeader shopName={SHOP} eventTitle="Ana & Miguel’s wedding" />
          {s === 'guest' ? (
            <>
              <LabGuestReviewForm
                slug="bloom-and-co"
                eventId="00000000-0000-4000-8000-000000000000"
                shopName={SHOP}
                cards={[{ serviceId: 's1', title: 'Garden bridal bouquet' }]}
                shots={[
                  { id: 'c1', url: SHOT_A },
                  { id: 'c2', url: SHOT_B },
                ]}
                names={{ name: 'Gabriel D.', initials: 'G. D.' }}
                checkedInLabel="Checked in at the door · Dec 12"
                backHref="#"
              />
              <p className="mt-2.5 text-xs text-ink/70">No communication, price or schedule questions — a guest never dealt with those.</p>
            </>
          ) : s === 'thanks' ? (
            <GuestReviewThanks firstName="Gabriel" giftLine={null} shopName={SHOP} backHref="#" />
          ) : (
            <Said line={GUEST_REVIEW_REFUSAL_LINE.already_reviewed} href="#" cta="Back to the event" />
          )}
        </Shell>
      </div>
    );
  }

  if (s === 'nodoor') {
    return (
      <div className="min-h-dvh bg-cream">
        <Shell>
          <NotOnDoorList shopName={SHOP} shopHref="#" />
        </Shell>
      </div>
    );
  }

  if (s === 'admin') {
    return (
      <main className="mx-auto w-full max-w-3xl bg-cream px-4 py-6">
        <GuestReviewsQueue
          read={{
            state: 'rows',
            rows: [
              { ...GABRIEL, vendor_name: SHOP },
              {
                ...GABRIEL,
                review_id: 'g2',
                rating_overall: 2,
                line: '[Example — a line Setnayan hid.]',
                shown_name: 'M. S.',
                hidden_at: '2026-12-13T00:00:00Z',
                vendor_name: SHOP,
              },
            ],
          }}
        />
      </main>
    );
  }

  // shop · shop-refused — a copy of v/[slug]/page.tsx's Reviews section shell around the real new groups.
  const guests: GuestReviewsRead = s === 'shop-refused' ? { state: 'refused' } : GUESTS;
  return (
    <main className="mx-auto w-full max-w-5xl bg-cream px-4">
      <section id="reviews" className="space-y-6 border-b border-ink/10 py-8">
        <header>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Reviews</h2>
          <p className="mt-1 text-sm text-ink/65">From verified couples who&rsquo;ve booked {SHOP} via Setnayan.</p>
        </header>
        <div className="grid gap-6 rounded-2xl border border-ink/10 bg-cream p-5 sm:grid-cols-[180px_1fr]"> {/* no-card-ok: a dev-only copy of v/[slug]/page.tsx ReviewHeroMetrics, already counted in that file */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1">
              <Star className="h-6 w-6 fill-warn-400 text-warn-500" strokeWidth={1.5} />
              <span className="text-3xl font-semibold text-ink">4.8</span>
              <span className="text-sm font-semibold text-ink">overall</span>
            </div>
            <p className="text-xs text-ink/60">12 reviews across all their services</p>
            <GuestStarsLine read={guests} />
          </div>
        </div>
        <ReviewGroupHead>From the hosts</ReviewGroupHead>
        <ul className="space-y-4">
          <li>
            <article className="rounded-xl border border-ink/10 bg-cream p-4"> {/* no-card-ok: a dev-only copy of v/[slug]/page.tsx ReviewRow, already counted in that file */}
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-0.5" aria-label="5 out of 5 stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} aria-hidden className="h-4 w-4 fill-warn-400 text-warn-500" strokeWidth={1.5} />
                    ))}
                  </span>
                  <span className="text-sm font-medium text-ink">Ana &amp; Miguel</span>
                </div>
                <time className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">Dec 20, 2026</time>
              </header>
              <ReviewForLine card={{ title: 'Garden bridal bouquet', anchorId: 'card-lab', photoUrl: BOUQUET }} />
              <p className="mt-2 whitespace-pre-line text-sm text-ink/80">[Example review text — not a real review.]</p>
            </article>
          </li>
        </ul>
        <GuestReviewsGroup read={guests} photoUrlByCapture={new Map([['c1', SHOT_A]])} vendorName={SHOP} />
      </section>
    </main>
  );
}
