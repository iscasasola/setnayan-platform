'use client';

/**
 * 📸 /dev/shop-preview-lab?view=photos — PHOTOS BY SERVICE on fixtures (owner 2026-11-14; prototype
 * `prototypes/supplier_photos_by_category_2026-11-14_fable.html`). DEV-ONLY (the page 404s in production). It draws the
 * REAL gallery (way in Ⓐ — the service name on each card) and the REAL Portfolio row (Ⓑ) over the prototype's sample
 * shop "Liwanag Lights & Bar". Nobody real.
 *
 *   &owner=1    the shop's own view: its private album photos join, marked "Only you" (a fixture read, no session)
 *   &state=fail the event-photo read refused — the view says so in amber
 */
import { ServicesGallery } from '@/app/v/[slug]/_components/services-gallery';
import { PhotosByServiceRow } from '@/app/v/[slug]/_components/photos-by-service';
import { servicesFromCards } from '@/lib/photos-by-service';
import type { ServiceCard } from '@/lib/service-card-view-model';
import type { ServicePrivatePhotos } from '@/lib/couple-photo-share';
import type { PutOnPageResult } from '@/app/vendor-dashboard/collections/actions';

const IMG = (k: string) => `/event-types/${k}.webp`;

function labCard(id: string, label: string, serviceKey: string, serviceLabel: string, over: Partial<ServiceCard>): ServiceCard {
  return {
    id,
    label,
    serviceKey,
    serviceLabel,
    priceLabel: 'Price on request',
    meta: null,
    discountLabel: null,
    inclusions: [],
    inclusionsMore: 0,
    notIncluded: [],
    priceDetail: null,
    serves: null,
    photos: [],
    videoUrl: null,
    record: null,
    recordRating: null,
    givesSetnayanGift: false,
    anchorId: `lab-${id}`,
    ...over,
  } as unknown as ServiceCard;
}

function cards(fail: boolean): ServiceCard[] {
  const ev = (url: string, caption: string, event: string) => ({ url: IMG(url), caption, event });
  return [
    labCard('lights', 'Ceremony & reception lights', 'lights_and_sound', 'Lights & Sound', {
      photos: [IMG('gala_night')],
      coupleLooks: [{ id: 'c1', url: IMG('anniversary'), credit: 'A couple · Dec 2025', verifiedBooking: true }],
      eventPhotos: fail
        ? null
        : [
            ev('celebration', 'Wedding · Dec 2025', 'e0'),
            ev('corporate', 'Wedding · Dec 2025', 'e0'),
            ev('debut', 'Debut · Feb 2026', 'e1'),
            ev('birthday', 'Debut · Feb 2026', 'e1'),
            ev('christening', 'Christening · Apr 2026', 'e2'),
          ],
    }),
    labCard('sound', 'Sound for the program', 'lights_and_sound', 'Lights & Sound', {
      eventPhotos: fail ? null : [ev('concert', 'Corporate · Mar 2026', 'e3'), ev('graduation', 'Corporate · Mar 2026', 'e3'), ev('date', 'Wedding · Jan 2026', 'e4')],
    }),
    labCard('bar', 'Mocktail bar cart', 'mobile_bar', 'Mobile Bar', { eventPhotos: fail ? null : [] }),
  ];
}

async function labPrivate(_shop: string, serviceKey: string): Promise<ServicePrivatePhotos> {
  if (serviceKey !== 'lights_and_sound') return { status: 'ok', byCard: {} };
  return {
    status: 'ok',
    byCard: {
      lights: [
        { photoId: 'p1', url: IMG('grand_opening'), caption: 'Wedding · Dec 2025', notice: null },
        { photoId: 'p2', url: IMG('gender_reveal'), caption: 'Debut · Feb 2026', notice: null },
      ],
    },
  };
}

async function labPut(): Promise<PutOnPageResult> {
  return { ok: false, error: 'This is a lab — nothing is put on a page.' } as PutOnPageResult;
}

export function PhotosByServiceLab({ owner, fail }: { owner: boolean; fail: boolean }) {
  const list = cards(fail);
  const views = servicesFromCards(list);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Services &amp; pricing</h2>
        <ServicesGallery
          groups={[
            { key: 'reception', label: 'Reception', cards: [list[0]!, list[2]!] },
            { key: 'media_and_entertainment', label: 'Media & entertainment', cards: [list[1]!] },
          ]}
          shopName="Liwanag Lights & Bar"
        />
      </section>
      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Portfolio</h2>
        <PhotosByServiceRow
          views={views}
          ownerShopId={owner ? 'lab-shop' : null}
          readPrivate={labPrivate}
          putAction={labPut}
        />
      </section>
    </div>
  );
}
