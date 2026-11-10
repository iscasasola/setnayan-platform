'use client';

/**
 * The lab's two frames of Shop › Services cards. PROPOSED mounts the SHIPPED `ServiceCardItem` (no frame · the SHIPPED
 * `ServiceCardView` in the shipped `SwipeToDelete` · the SHIPPED `ServiceCardMenuRow`). Its switch saves through a
 * stand-in that answers with the real gates — going online: `publishRefusalFor`; going offline: the open bookings
 * (`openBookingsRefusal`, worded on the server page) — and its delete through a stand-in that never touches a database.
 * NOW is the row as it drew on origin/main (side copy icon · side Online/Offline switch · "Edit · every field"), frozen
 * here for the side-by-side ONLY.
 */
import Link from 'next/link';
import { ChevronRight, Copy } from 'lucide-react';
import { ServiceCardView } from '@/app/_components/service-card-view';
import type { ServiceCard } from '@/lib/service-card-view-model';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { ServiceCardItem } from '@/app/vendor-dashboard/services/_components/service-card-item';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { toggleVendorServiceActive } from '@/app/vendor-dashboard/services/actions';
import { publishRefusalFor, unmetPublishRequirements, type PublishFacts } from '@/lib/service-publish-gate';
import type { StaySave } from '@/app/_components/stay-form';
import type { ShareTarget } from '@/lib/service-share-targets';
import type { OfferServiceResult } from '@/lib/offer-service-core';

export type LabCard = {
  id: string;
  name: string;
  live: boolean;
  card: ServiceCard;
  facts: PublishFacts;
  factsLine: string;
  /** Worded on the server page with the real `openBookingsRefusal` / `deleteWarningLines`. */
  offlineRefusal: string | null;
  deleteRefusal: string | null;
  warningLines: string[];
};

function standIn(c: LabCard): StaySave {
  return async (_door, fd) => {
    const goingOnline = fd.get('is_active') === 'true';
    const refusal = goingOnline ? publishRefusalFor(unmetPublishRequirements(c.facts)) : c.offlineRefusal;
    return refusal ? { ok: false, error: refusal } : { ok: true };
  };
}

async function labRemove(): Promise<{ ok: true; retired: boolean }> {
  return { ok: true, retired: false };
}

/** The share's stand-in: posts nothing, answers as the server does — the Offline card is refused in the server's words. */
function labShare(c: LabCard) {
  return async (): Promise<OfferServiceResult> => {
    await new Promise((r) => setTimeout(r, 350));
    return c.live ? { status: 'ok', notified: 2 } : { status: 'invalid_service' };
  };
}

export function LabRows({ cards, now, targets }: { cards: LabCard[]; now: boolean; targets: ShareTarget[] | null }) {
  if (!now) {
    return (
      <>
        <ul className="space-y-5" data-shop-card-list="">
          {cards.map((c) => (
            <ServiceCardItem
              key={c.id}
              liId={`svc-${c.id}`}
              live={c.live}
              nameLower={c.name.toLowerCase()}
              face={
                <div className="relative" data-card-face={c.id}>
                  <ServiceCardView card={c.card} detailsEnabled={false} />
                  <Link href="#" aria-label={`Open ${c.name} in the Card Maker`} className="absolute inset-0 rounded-xl" data-card-face-opens="" />
                </div>
              }
              row={{
                vendorServiceId: c.id,
                cardName: c.name,
                isActive: c.live,
                held: false,
                editHref: '#',
                share: { targets, share: labShare(c) },
              }}
              action={toggleVendorServiceActive}
              save={standIn(c)}
              deleteRefusal={c.deleteRefusal}
              warningLines={c.warningLines}
              remove={labRemove}
              below={
                <p className="truncate text-xs" style={{ color: 'var(--m-slate-2)' }}>
                  {c.factsLine}
                  {c.live ? '' : ' · hidden'}
                </p>
              }
            />
          ))}
        </ul>
        <UndoToastHost />
      </>
    );
  }
  return (
    <ul className="space-y-2.5" data-shop-card-list="">
      {cards.map((c) => (
        <li
          key={c.id}
          className="overflow-hidden rounded-2xl border" /* no-card-ok: the lab's stand-in for the shipped services-manager <li>, drawn the same */
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
          data-shop-card=""
        >
          {now ? (
            <>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <ServiceCardView card={c.card} detailsEnabled={false} />
                  <p className="truncate text-xs" style={{ color: 'var(--m-slate-2)' }}>
                    {c.factsLine}
                    {c.live ? '' : ' · hidden'}
                  </p>
                </div>
                <Link href="#" aria-label="Start a new card from this one" className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--m-paper-2)', color: 'var(--m-slate-2)' }}>
                  <Copy className="h-4 w-4" strokeWidth={1.75} />
                </Link>
                <button type="button" role="switch" aria-checked={c.live} className={SWITCH_BUTTON}>
                  <SwitchTrack on={c.live} words={{ on: 'Online', off: 'Offline' }} />
                </button>
              </div>
              <Link href="#" className="sn-press flex min-h-11 items-center justify-between gap-2 border-t px-4 py-2.5 text-[14px] font-semibold text-sn-accent" style={{ borderColor: 'var(--m-line)' }}>
                <span>Edit · every field</span>
                <ChevronRight aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
              </Link>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
