'use client';

/**
 * The lab's two frames of Shop › Services cards. PROPOSED mounts the SHIPPED `ServiceCardMenuRow` under the SHIPPED
 * `ServiceCardView`; its Go online saves through a stand-in that answers with the real gate (`unmetPublishRequirements`
 * → `publishRefusalFor`), so a refusal reads exactly as the server's. NOW is the row as it drew on origin/main before the
 * menu row (side copy icon · side Online/Offline switch · "Edit · every field"), frozen here for the side-by-side ONLY.
 */
import Link from 'next/link';
import { ChevronRight, Copy } from 'lucide-react';
import { ServiceCardView } from '@/app/_components/service-card-view';
import type { ServiceCard } from '@/lib/service-card-view-model';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { ServiceCardMenuRow } from '@/app/vendor-dashboard/services/_components/service-card-menu-row';
import { toggleVendorServiceActive } from '@/app/vendor-dashboard/services/actions';
import { publishRefusalFor, unmetPublishRequirements, type PublishFacts } from '@/lib/service-publish-gate';
import type { StaySave } from '@/app/_components/stay-form';

export type LabCard = {
  id: string;
  name: string;
  live: boolean;
  card: ServiceCard;
  facts: PublishFacts;
  sharePath: string | null;
  factsLine: string;
};

function standIn(facts: PublishFacts): StaySave {
  return async () => {
    const refusal = publishRefusalFor(unmetPublishRequirements(facts));
    return refusal ? { ok: false, error: refusal } : { ok: true };
  };
}

export function LabRows({ cards, now }: { cards: LabCard[]; now: boolean }) {
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
          ) : (
            <>
              <div className="space-y-2 p-4">
                <div className="relative" data-card-face={c.id}>
                  <ServiceCardView card={c.card} detailsEnabled={false} />
                  <Link href="#" aria-label={`Open ${c.name} in the Card Maker`} className="absolute inset-0 rounded-xl" data-card-face-opens="" />
                </div>
                <p className="truncate text-xs" style={{ color: 'var(--m-slate-2)' }}>
                  {c.factsLine}
                  {c.live ? '' : ' · hidden'}
                </p>
              </div>
              <div className="border-t px-4 py-3" style={{ borderColor: 'var(--m-line)' }}>
                <ServiceCardMenuRow
                  vendorServiceId={c.id}
                  cardName={c.name}
                  isActive={c.live}
                  held={false}
                  editHref="#"
                  sharePath={c.sharePath}
                  action={toggleVendorServiceActive}
                  save={standIn(c.facts)}
                />
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
