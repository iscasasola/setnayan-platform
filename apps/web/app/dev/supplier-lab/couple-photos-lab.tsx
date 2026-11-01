'use client';

/**
 * 🧪 /dev/supplier-lab?s=couple-photos — THE REAL "PHOTOS COUPLES SHARED" LIST on a lab shop (DEV-ONLY), and under it
 * (`&card=1`) the REAL service card with an approved couple photo and its credit line. Its writes are stand-ins that
 * answer in this tab and reach no database. A made-up couple and a made-up shop — no real event, no real supplier.
 */
import { useMemo } from 'react';
import { CouplePhotosList, type ShopCouplePhoto } from '@/app/vendor-dashboard/shop/_components/couple-photos-list';
import { ServiceCardView } from '@/app/_components/service-card-view';
import type { ServiceCard } from '@/lib/service-card-view-model';
import { shopAnswerDoneLine } from '@/lib/couple-photo-share';
import type { CouplePhotoShareReply, CouplePhotoShareRequest } from '@/lib/couple-photo-share';
import { LAB_SUGGEST_PHOTO } from './suggestion-lab-fixture';

export const LAB_COUPLE_PHOTOS: ShopCouplePhoto[] = [
  { shareId: 'lab-share-1', state: 'waiting', imageUrl: LAB_SUGGEST_PHOTO.bq1, creditLine: 'Ana & Ben · Feb 2027', serviceTitle: 'Garden bridal bouquet' },
  { shareId: 'lab-share-2', state: 'waiting', imageUrl: LAB_SUGGEST_PHOTO.cp1, creditLine: 'A couple', serviceTitle: 'Table centrepieces' },
  { shareId: 'lab-share-3', state: 'approved', imageUrl: LAB_SUGGEST_PHOTO.bq2, creditLine: 'Maria & Jose · Dec 2026', serviceTitle: 'Garden bridal bouquet' },
];

const LAB_CARD: ServiceCard = {
  id: 'lab-card-bouquet',
  label: 'Garden bridal bouquet',
  priceLabel: 'from ₱8,500',
  meta: null,
  discountLabel: null,
  inclusions: ['Boutonnière for the groom'],
  inclusionsMore: 0,
  notIncluded: [],
  priceDetail: null,
  serves: 'Wedding — All faiths',
  photos: [LAB_SUGGEST_PHOTO.bqS],
  videoUrl: null,
  record: null,
  recordRating: null,
  givesSetnayanGift: false,
  coupleLooks: [
    { id: 'lab-share-3', url: LAB_SUGGEST_PHOTO.bq2, credit: 'Maria & Jose · Dec 2026' },
    { id: 'lab-share-1', url: LAB_SUGGEST_PHOTO.bq1, credit: 'Ana & Ben · Feb 2027' },
    { id: 'lab-share-4', url: LAB_SUGGEST_PHOTO.cp2, credit: 'A couple' },
  ],
};

export function CouplePhotosLab({ card }: { card: boolean }) {
  const couplePhotoShare = useMemo(
    () => async (req: CouplePhotoShareRequest): Promise<CouplePhotoShareReply> => {
      if (req.op !== 'answer') return { op: 'answer', result: { status: 'refused', message: 'The lab answers only.' } };
      const was = LAB_COUPLE_PHOTOS.find((p) => p.shareId === req.shareId)?.state ?? 'waiting';
      return { op: 'answer', result: { status: 'ok', approved: req.approve, line: shopAnswerDoneLine(req.approve, was) } };
    },
    [],
  );
  return (
    <div className="min-h-screen bg-cream px-4 py-6 text-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <CouplePhotosList photos={LAB_COUPLE_PHOTOS} couplePhotoShare={couplePhotoShare} />
        {card ? (
          <div className="flex flex-col gap-2" data-lab-couple-card="">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Your service card · as couples see it</p>
            <ServiceCardView card={LAB_CARD} detailsEnabled={false} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
