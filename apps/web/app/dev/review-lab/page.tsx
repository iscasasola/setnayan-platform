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
 */
import { notFound } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { ReviewRequestCard } from '@/app/dashboard/[eventId]/vendors/[vendorId]/review/_components/review-request-card';
import { CoordinatorRefusedState } from '@/app/dashboard/[eventId]/vendors/[vendorId]/review/_components/coordinator-refused-state';
import { GuestReviewHeader } from '@/app/v/[slug]/guest-review/_components/guest-review-header';
import { GuestReviewForm, GuestReviewThanks } from '@/app/v/[slug]/guest-review/_components/guest-review-form';
import { NotOnDoorList, Said, Shell } from '@/app/v/[slug]/guest-review/_components/guest-review-states';
import {
  GuestReviewsGroup,
  GuestStarsLine,
  ReviewForLine,
  ReviewGroupHead,
} from '@/app/v/[slug]/_components/review-groups';
import { GuestReviewsQueue } from '@/app/admin/reviews/_components/guest-reviews-queue';
import { GUEST_REVIEW_REFUSAL_LINE, type GuestReviewRow, type GuestReviewsRead } from '@/lib/guest-reviews';
import { labSendGuestReview } from './actions';

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

type S = 'request' | 'request2' | 'coordinator' | 'guest' | 'thanks' | 'nodoor' | 'said' | 'shop' | 'shop-refused' | 'admin';
const STATES: ReadonlyArray<S> = ['request', 'request2', 'coordinator', 'guest', 'thanks', 'nodoor', 'said', 'shop', 'shop-refused', 'admin'];

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
              <GuestReviewForm
                action={labSendGuestReview}
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
