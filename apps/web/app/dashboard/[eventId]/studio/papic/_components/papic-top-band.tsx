import { Images } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ServiceGlanceBand } from '@/app/_components/service-glance';
import { formatCount } from '@/lib/format-number';
import { POOL_METER_LOW_PCT } from '@/lib/papic-pool-meter';
import { PAPIC_UNTIL_WORDS, type PapicGlance } from '@/lib/papic-glance';
import { PapicBuySheet } from './papic-buy-sheet';
import { PapicSeePhotos } from './papic-see-photos';
import type { PoolRung } from '@/lib/papic-pool-rungs';

/**
 * 🎨 THE PAPIC PAGE'S ONE BAND (owner "approve all", 2026-10-14 — prototype
 * `renderPapic()`, translated): the count of credits left · "of N bought" ·
 * Buy more (the page's one main button) · the meter · the mood said in words ·
 * See your N photos (opens the gallery directly) · when the cameras are on.
 *
 * 🔑 NOTHING HERE IS READ: the words come from `papicGlance` over the page's own
 * `readPapicStandings` and `resolveStoredWindow`. Buy more opens the shared
 * sheet, which reads the ladder only when tapped.
 */
export function PapicTopBand({
  eventId,
  glance,
  canBuy,
  buyOpen = false,
  error = null,
  sizes = null,
}: {
  eventId: string;
  glance: PapicGlance;
  /** The purchase is the couple's; a coordinator sees the band without the button. */
  canBuy: boolean;
  /** Open the sheet on arrival — a purchase error to read, or "?buy=1" from Home. */
  buyOpen?: boolean;
  error?: string | null;
  /** The ladder, only when a dev lab already holds it — the page reads it on the tap. */
  sizes?: PoolRung[] | null;
}) {
  const { mood, count, total, photos, onFrom, phase } = glance;
  const big = count === null ? glance.status : formatCount(count);
  const word =
    count === null
      ? null
      : `${mood === 'wait' ? 'credits ready' : 'credits left'}${total !== null ? ` · of ${formatCount(total)} bought` : ''}`;
  const say =
    mood === 'gone'
      ? 'Your guests’ cameras have stopped — add credits to restart them.'
      : mood === 'low'
        ? `Running low — under ${POOL_METER_LOW_PCT}% of what you bought.`
        : null;
  const when =
    phase === 'closed'
      ? 'Cameras closed'
      : onFrom
        ? mood === 'wait' || phase === 'waits'
          ? `Papic turns on ${onFrom} · cameras wait until then`
          : `On from ${onFrom} · ${PAPIC_UNTIL_WORDS}`
        : null;
  const see =
    typeof photos === 'number' && photos > 0 ? (
      <PapicSeePhotos wide label={`See your ${formatCount(photos)} ${photos === 1 ? 'photo' : 'photos'}`} />
    ) : (
      <ActionButton
        tone="neutral"
        waiting
        className="w-full justify-center"
        icon={<Images aria-hidden="true" strokeWidth={1.9} />}
        label="No photos yet"
      />
    );
  return (
    <ServiceGlanceBand
      big={big}
      word={word}
      mood={mood}
      pct={glance.pct}
      meterLabel="Credits left"
      say={say}
      when={when}
      see={see}
      buy={
        canBuy && glance.buy ? (
          <PapicBuySheet eventId={eventId} left={count} main defaultOpen={buyOpen} error={error} sizes={sizes} />
        ) : null
      }
    />
  );
}
