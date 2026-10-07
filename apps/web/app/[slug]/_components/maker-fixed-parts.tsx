/**
 * THE DAY'S OWN PARTS, AS THE MAKER'S CANVAS DRAWS THEM — never for a guest.
 *
 * Find your seat, each guest's own photos, the announcements and the live hub
 * are drawn for ONE guest (their table, their photos) or only once something
 * happens (a message sent, a stream on). The couple still picks each one's
 * style (owner 2026-09-29, "every scene … three styles"), so the Maker's
 * canvas draws a stand-in in the part's place and the navigator lists it
 * (`MAKER_DAY_PARTS`, `lib/maker-scene-list.ts`).
 *
 * 🔲 THE STAND-IN DRAWS ITS LOOK'S ARRANGEMENT WITH SAMPLE SHAPES (owner 08 Oct: *"still cannot see the gallery
 * style? maybe show what it could look like with boxes?"*): grey boxes where photos go, short grey lines where words
 * go — the banner, the player and its wall, the seat map — so each look card and the canvas show the real shape
 * guests will get. Still never sample CONTENT (owner 2026-09-27): no invented table, name or stock photo — shapes
 * only. Mounted only in the Maker's canvas (`site-body.tsx` `isMakerCanvas`), so a guest never receives it.
 */
import type { ReactNode } from 'react';
import type { FixedStyleScene } from '@/lib/fixed-scene-styles';

type DayPart = Exclude<FixedStyleScene, 'entourage'>;

const EYEBROW: Record<DayPart, string> = {
  announcements: 'Announcements',
  find_your_seat: '✦ Your seat',
  live_hub: 'Watch live · Live photo wall',
  photos_of_you: '✦ Photos of you',
};

/** A photo's place. */
const Box = ({ className = '' }: { className?: string }) => <span aria-hidden data-sample-box="" className={`block rounded-md bg-ink/10 ${className}`} />;
/** A line of words' place. */
const Line = ({ w = 'w-2/3', className = '' }: { w?: string; className?: string }) => (
  <span aria-hidden data-sample-line="" className={`block h-2 rounded-full bg-ink/15 ${w} ${className}`} />
);

/** Each look's arrangement, keyed `<part>:<style id>` (`lib/scene-styles-stages.ts`). */
export const DAY_SAMPLE: Record<string, () => ReactNode> = {
  /* ── Announcements ── */
  'announcements:banner': () => (
    <span className="flex items-center gap-3 rounded-lg bg-ink/10 px-4 py-3">
      <Box className="h-6 w-6 shrink-0 rounded-full" />
      <span className="flex-1 space-y-1.5">
        <Line w="w-1/2" />
        <Line w="w-5/6" />
      </span>
    </span>
  ),
  'announcements:notice': () => (
    <span className="block space-y-2 bg-ink/5 px-4 py-4">
      <Line w="w-1/3" className="mx-auto" />
      <Line w="w-11/12" className="mx-auto" />
      <Line w="w-3/4" className="mx-auto" />
    </span>
  ),
  'announcements:line': () => (
    <span className="block border-y border-ink/15 py-2.5">
      <Line w="w-3/4" className="mx-auto" />
    </span>
  ),
  /* ── Live hub ── */
  'live_hub:player-and-wall': () => (
    <span className="block space-y-2">
      <Box className="aspect-video w-full" />
      <span className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} className="aspect-square" />
        ))}
      </span>
    </span>
  ),
  'live_hub:theatre': () => (
    <span className="block space-y-2">
      <Box className="aspect-[16/10] w-full rounded-lg" />
      <Line w="w-1/2" className="mx-auto" />
    </span>
  ),
  'live_hub:wall-first': () => (
    <span className="block space-y-2">
      <span className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Box key={i} className="aspect-square" />
        ))}
      </span>
      <Box className="ml-auto aspect-video w-1/3" />
    </span>
  ),
  /* ── Find your seat ── */
  'find_your_seat:map': () => (
    <span className="relative block aspect-[4/3] w-full bg-ink/5">
      {['left-[12%] top-[18%]', 'left-[42%] top-[18%]', 'left-[72%] top-[18%]', 'left-[12%] top-[58%]', 'left-[42%] top-[58%]', 'left-[72%] top-[58%]'].map((at, i) => (
        <span key={at} aria-hidden data-sample-box="" className={`absolute h-[22%] w-[16%] rounded-full ${at} ${i === 4 ? 'bg-ink/30' : 'bg-ink/10'}`} />
      ))}
    </span>
  ),
  'find_your_seat:table-number': () => (
    <span className="block space-y-2 py-2">
      <span aria-hidden data-sample-box="" className="mx-auto block h-16 w-16 rounded-full bg-ink/10" />
      <Line w="w-1/3" className="mx-auto" />
    </span>
  ),
  'find_your_seat:place-card': () => (
    <span className="mx-auto block w-3/4 -rotate-2 space-y-2 rounded-md border border-ink/20 px-4 py-4 shadow-sm">
      <Line w="w-2/3" className="mx-auto" />
      <Line w="w-1/3" className="mx-auto" />
    </span>
  ),
  /* ── Photos of you ── */
  'photos_of_you:grid': () => (
    <span className="grid grid-cols-3 gap-1.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={i} className="aspect-square" />
      ))}
    </span>
  ),
  'photos_of_you:lead': () => (
    <span className="block space-y-1.5">
      <Box className="aspect-[4/3] w-full" />
      <span className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <Box key={i} className="aspect-square" />
        ))}
      </span>
    </span>
  ),
  'photos_of_you:polaroids': () => (
    <span className="flex justify-center gap-2 py-2">
      {['-rotate-6', 'rotate-3', '-rotate-2'].map((r) => (
        <span key={r} className={`block w-1/4 border border-ink/15 p-1.5 pb-4 shadow ${r}`}>
          <Box className="aspect-square rounded-none" />
        </span>
      ))}
    </span>
  ),
};

/** The arrangement a part's look draws (its first look when the style is unknown). */
export function daySampleKey(part: DayPart, styleId: string | null): string {
  const want = `${part}:${styleId ?? ''}`;
  return DAY_SAMPLE[want] ? want : Object.keys(DAY_SAMPLE).find((k) => k.startsWith(`${part}:`))!;
}

export function MakerDayPartStandIn({ part, styleName, styleId = null }: { part: DayPart; styleName: string | null; styleId?: string | null }) {
  const key = daySampleKey(part, styleId);
  return (
    <section className="space-y-3 text-center" data-maker-day-part={part} data-maker-day-sample={key}>
      <p className="pahina-eyebrow justify-center">
        <span>{EYEBROW[part]}</span>
      </p>
      {DAY_SAMPLE[key]!()}
      {styleName ? <p className="text-xs text-ink/70">Sample of “{styleName}” — each guest sees their own.</p> : null}
    </section>
  );
}

/**
 * 🧭 A PAGE OF THE STAGES CANVAS THAT NOTHING WAS FILED ON — still a page (owner 08 Oct: *"i do not see the
 * individual pages"*; every tab the Maker's bar shows has its own page, `lib/maker-stage-filing.ts`). The Camera
 * is one by nature: guests open it as its own screen, and the live camera is never opened in the Maker
 * (`the-maker-canvas-draws-no-camera.test.ts`), so its page is the camera's SHAPE — the viewfinder and the
 * shutter, in grey — and its looks are picked from its tile below. Any other page with nothing on it yet says so.
 * Shapes and one line; never sample content. Mounted only by the Stages canvas (`site-body.tsx` `rest`).
 */
export function MakerPageStandIn({ page, label }: { page: string; label: string }) {
  return (
    <section className="space-y-3 px-4 py-10 text-center" data-maker-page-stand-in={page} data-maker-sample="">
      <p className="pahina-eyebrow justify-center">
        <span>{label}</span>
      </p>
      {page === 'camera' ? (
        <span aria-hidden className="relative mx-auto block aspect-[3/4] w-2/3 rounded-lg bg-ink/10">
          <span data-sample-box="" className="absolute inset-x-[12%] top-[10%] bottom-[30%] rounded-md border-2 border-dashed border-ink/20" />
          <span data-sample-box="" className="absolute bottom-[8%] left-1/2 block h-12 w-12 -translate-x-1/2 rounded-full bg-ink/20" />
        </span>
      ) : (
        <span aria-hidden className="mx-auto block w-2/3 space-y-2">
          <Line w="w-1/2" className="mx-auto" />
          <Line w="w-5/6" className="mx-auto" />
        </span>
      )}
      <p className="text-xs uppercase tracking-[0.2em] text-ink/40">
        {page === 'camera'
          ? 'Only you see this · guests open the camera as its own screen'
          : page === 'me'
            ? 'Only you see this · each guest sees their own'
            : 'Only you see this · guests see it once it has content'}
      </p>
    </section>
  );
}
