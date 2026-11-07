'use client';

/**
 * The review lab's CLIENT pieces (a server page cannot read values out of a 'use client' module): the REAL service card
 * with this card's reviews attached (prototype 6 Nov § 4 / § 9), and the REAL Me section with "Who made the day?"
 * (§ 8, door 2). Fixtures only — a made-up shop, couple and guest; nothing is written.
 */
import { ServiceCardView } from '@/app/_components/service-card-view';
import { GuestMeSection } from '@/app/[slug]/_components/guest-hub-bar';
import { WhoMadeTheDay } from '@/app/[slug]/_components/who-made-the-day';
import { LAB_CARD } from '@/app/dev/supplier-lab/couple-photos-lab';
import { withCardReviews } from '@/lib/service-card-view-model';

export function LabCardWithReviews({ shotUrl }: { shotUrl: string }) {
  const card = withCardReviews(LAB_CARD, {
    hosts: {
      count: 1,
      average: 5,
      quote: '[Example — first 120 characters of the hosts’ review.]',
      by: 'A. & M. · Dec 2026',
      verifiedBooking: true,
    },
    guests: {
      count: 40,
      average: 4.9,
      newest: { shownName: 'Gabriel D.', stars: 5, line: '[Example — one line of up to 140 characters.]', photoUrl: shotUrl },
      readAllHref: '#guest-reviews',
    },
  });
  return (
    <div className="flex flex-col gap-2" data-lab-review-card="">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Your service card · as couples see it</p>
      <ServiceCardView card={card} detailsEnabled={false} />
    </div>
  );
}

export function LabHubAfterDay() {
  return (
    <GuestMeSection
      meSlot={null}
      photosHref="#photos"
      galleryCount={12}
      asTab
      onOpenQr={() => {}}
      afterDay={
        <WhoMadeTheDay
          eventId="00000000-0000-4000-8000-000000000000"
          suppliers={[
            { slug: 'bloom-and-co', name: 'Bloom & Co.', trade: 'florist', rated: false },
            { slug: 'lights-and-co', name: 'Lights & Co.', trade: 'lights', rated: false },
          ]}
        />
      }
    />
  );
}
