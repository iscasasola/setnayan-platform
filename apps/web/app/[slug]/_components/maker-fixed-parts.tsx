/**
 * THE DAY'S OWN PARTS, AS THE MAKER'S CANVAS DRAWS THEM — never for a guest.
 *
 * Find your seat, each guest's own photos, the announcements and the live hub
 * are drawn for ONE guest (their table, their photos) or only once something
 * happens (a message sent, a stream on). The couple still picks each one's
 * style (owner 2026-09-29, "every scene … three styles"), so the Maker's
 * canvas draws a stand-in in the part's place — its name and, in one line,
 * what fills it and the style it is drawn in — and the navigator lists it
 * (`MAKER_DAY_PARTS`, `lib/maker-scene-list.ts`). Never sample content (owner
 * 2026-09-27): no invented table, no stock photo.
 */
import type { FixedStyleScene } from '@/lib/fixed-scene-styles';

type DayPart = Exclude<FixedStyleScene, 'entourage'>;

const STAND_IN: Record<DayPart, { eyebrow: string; line: string }> = {
  announcements: { eyebrow: 'Announcements', line: 'Your messages to guests appear at the top of the page' },
  find_your_seat: { eyebrow: '✦ Your seat', line: 'Each guest sees their own table here' },
  live_hub: { eyebrow: 'Watch live · Live photo wall', line: 'Your stream and your live photo wall appear here' },
  photos_of_you: { eyebrow: '✦ Photos of you', line: 'Each guest sees the photos they are in here' },
};

export function MakerDayPartStandIn({ part, styleName }: { part: DayPart; styleName: string | null }) {
  const s = STAND_IN[part];
  return (
    <section className="pahina-plate space-y-2 text-center" data-maker-day-part={part}>
      <p className="pahina-eyebrow justify-center">
        <span>{s.eyebrow}</span>
      </p>
      <p className="text-sm leading-relaxed text-ink/70">
        {s.line}
        {styleName ? <>, drawn as &ldquo;{styleName}&rdquo;.</> : '.'}
      </p>
    </section>
  );
}
