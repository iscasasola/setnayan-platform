import { Sparkles } from 'lucide-react';
import { actionButtonClass } from '@/components/action-button-class';
import { loadRecapCoupleSummary, type RecapCoupleSummary } from '@/lib/auto-recap';
import { RecapPrivacyPill } from './recap-privacy-pill';

import { InfoTip } from '@/app/_components/info-tip';
/**
 * Auto-Recap card on the Papic add-ons page — the entry point into the couple's
 * "living recap" management surface (/studio/papic/recap). Renders once the
 * event has any photos to recap; shows the publish state at a glance.
 */
export async function RecapCard({ eventId, state, seat = 'page' }: { eventId: string; state?: RecapCoupleSummary; seat?: 'page' | 'sheet' }) {
  // `state` — the summary the page already read for the Memories keepsake row (2026-10-31), so it is read once.
  const summary = state ?? (await loadRecapCoupleSummary(eventId));
  if (summary.privatePhotos === 0 && summary.approvedKwentos === 0) return null;

  const isPublished = summary.status === 'published';
  // In its keepsake sheet (Memories, 2026-11-20) the sheet's head says the title and the PRIVATE mark beside it.
  const inSheet = seat === 'sheet';

  const body = (
    <>
      <InfoTip
        labelAs="p"
        label="Your day as a living recap"
        labelClassName={inSheet ? 'text-sn-lg text-ink/70' : 'text-sm text-ink/70'}
        className={inSheet ? undefined : 'mt-1'}
        align="start"
      >
        your love story, your photos, and{' '}
        {summary.approvedKwentos > 0
        ? `${summary.approvedKwentos} ${summary.approvedKwentos === 1 ? 'message' : 'messages'} from your guests`
        : 'the messages your guests leave'}
        . A page you can share, assembled automatically.
      </InfoTip>
      <a
        href={`/dashboard/${eventId}/studio/papic/recap`}
        className={actionButtonClass('brand', { main: true, extra: inSheet ? 'h-12 w-full text-sn-lg' : 'mt-4' })}
      >
        <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2} />
        {isPublished ? 'Manage your recap' : 'See your recap'}
      </a>
    </>
  );
  if (inSheet) {
    return (
      <div className="flex flex-col gap-3" data-keepsake-card="recap">
        {body}
      </div>
    );
  }
  return (
    <section className="border-t border-ink/10 bg-surface py-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Sparkles aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
          Your Recap
        </h2>
        <RecapPrivacyPill published={isPublished} />
      </div>
      {body}
    </section>
  );
}
