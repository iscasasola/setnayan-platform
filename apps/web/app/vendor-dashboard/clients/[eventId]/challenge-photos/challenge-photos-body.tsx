import { Info, PlayCircle } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { ShopPill } from '@/app/vendor-dashboard/_components/kit';
import { PartNote, PartSec, PartText } from '@/app/vendor-dashboard/_components/set-two/parts';
import { TheirEventPart } from '@/app/vendor-dashboard/_components/set-two/their-event-line';

export type ChallengeTile = { captureId: string; isClip: boolean; tileUrl: string; openUrl: string };

const ROUTE = '/vendor-dashboard/clients/[eventId]/challenge-photos';
/** The shipped tip, word for word — the drawing keeps it as the top block's first line (supplier pages set two, page 6). */
const TIP =
  'Guest photos and videos from the challenges you sponsored — only the ones a guest chose to share with you. Yours to use.';

/**
 * Challenge photos, drawn from the page's reads (the lab draws it from fixtures). Supplier pages set two, page 6: the
 * count is a pill beside the title, the tip stays as the first line, each challenge is a section head with its own
 * count, 3 across on a phone and 4 on a computer. `sections: null` = the photos could not be read — no pill and no
 * grid, never "0 shared". Behind the Papic games switch, unchanged (decided 3).
 */
export function ChallengePhotosBody({
  eventId,
  eventName,
  sections,
}: {
  eventId: string;
  eventName: string | null;
  sections: { prompt: string; tiles: ChallengeTile[] }[] | null;
}) {
  const total = sections ? sections.reduce((n, s) => n + s.tiles.length, 0) : 0;
  return (
    <TheirEventPart
      column="mx-auto w-full tab:max-w-3xl"
      mark="challenge-photos"
      route={ROUTE}
      eventId={eventId}
      eventName={eventName}
      title="Challenge photos"
      end={sections && total > 0 ? <ShopPill tone="success">{formatCount(total)} shared</ShopPill> : null}
      intro={TIP}
    >
      {sections === null ? (
        <PartNote tone="warn" icon={Info} role="status" mark="challenge-photos-unread">
          Couldn&rsquo;t load the shared photos. Refresh in a moment to try again.
        </PartNote>
      ) : total === 0 ? (
        <PartText>No shared photos yet — they arrive as guests finish your challenges and tap “share”.</PartText>
      ) : (
        sections.map((sec, i) => (
          <section key={i}>
            <PartSec end={`${sec.tiles.length} shared ${sec.tiles.length === 1 ? 'shot' : 'shots'}`}>{sec.prompt}</PartSec>
            <div className="grid grid-cols-3 gap-1.5 px-3 pt-2 tab:grid-cols-4 tab:px-0">
              {sec.tiles.map((t) => (
                <a
                  key={t.captureId}
                  href={t.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-[var(--m-r-sm)] bg-[color:var(--m-paper-2)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.tileUrl} alt="Shared guest photo" className="h-full w-full object-cover group-hover:opacity-90" loading="lazy" />
                  {t.isClip ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <PlayCircle aria-hidden className="h-7 w-7 text-white" strokeWidth={1.75} />
                    </span>
                  ) : null}
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </TheirEventPart>
  );
}
