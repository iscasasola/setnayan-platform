import type { ReactNode } from 'react';
import { HUB_TAB_ATTR, activeHubTab } from '@/app/[slug]/_lib/hub-tabs';
import { MakerDayPartStandIn, MakerPageStandIn } from '@/app/[slug]/_components/maker-fixed-parts';
import { MakerEmptyScene } from '@/app/[slug]/_components/maker-empty-scene';
import { MakerGuestScenes } from '@/app/[slug]/_components/maker-guest-scenes';
import type { FixedStyleScene } from '@/lib/fixed-scene-styles';
import { makerStagesPageOf, makerStagesPages } from '@/lib/maker-stage-filing';
import { sceneStylesOn } from '@/lib/scene-styles';

/**
 * 🧪 THE MAKER LAB'S "THE DAY", AS PAGES (DEV-ONLY — `/dev/maker-lab/guest?phase=event&tabs=1`; production 404s the lab).
 *
 * The lab drew the Invitation's one long page for The Day, so none of the day's own parts could be picked there —
 * the announcements, the live hub, Happening now, the gallery, each guest's photos, the seat, the pass — and the
 * Camera had no page at all (2026-10-09: the toolbar for The Day could not be seen or pressed without a database).
 * This draws The Day the way the REAL Stages canvas files it (`app/[slug]/_components/site-body.tsx`):
 *
 *   · ONE group per page of the Maker's own list (`makerStagesPages('event')`), marked `data-hub-tab`, one shown at
 *     a time — the bridge's `hubTab` switches them exactly as on the real canvas (`hub-tab-dom.ts`);
 *   · each part on the page the ONE filing puts it on (`makerStagesPageOf` — never a list kept here);
 *   · the day's own parts are the canvas's own stand-ins (`MakerDayPartStandIn`, `MakerEmptyScene`,
 *     `MakerGuestScenes`), in the look picked (`styleOf`); a page nothing is filed on is its stand-in
 *     (`MakerPageStandIn` — the Camera), marked `data-stages-page` as the real canvas marks it.
 *
 * The cover, the programme, the venue and the dress code are the lab's own nodes, handed in (`given`).
 */
export function LabDayPages({
  tab,
  paged = true,
  mark,
  given,
  styleOf,
  galleryStyle,
}: {
  /** The address's `?tab=` — the first page when absent. */
  tab: string | undefined;
  /** False for a miniature (`?only=`): one part alone is asked for, so no page is hidden — as the real canvas, whose
   *  tabs are off whenever one scene is asked for (`site-body.tsx` `stagesCanvas`). */
  paged?: boolean;
  mark: (key: string) => ReactNode;
  /** The lab's own nodes, by canvas key (`f:hero`, `w:schedule`, `w:venue_map`, `w:dress_code`). */
  given: Readonly<Record<string, ReactNode>>;
  /** The look a fixed part is drawn in (the lab's drafted `scene_styles`, a miniature's laid over). */
  styleOf: (part: FixedStyleScene) => string | null;
  galleryStyle: string | null;
}) {
  const pages = makerStagesPages('event');
  const keys = pages.map((p) => p.key);
  const active = activeHubTab(tab, keys);
  const dayPart = (part: Exclude<FixedStyleScene, 'entourage'>): ReactNode => {
    const id = styleOf(part);
    return (
      <div className="border-t border-ink/10 px-4 py-8">
        <MakerDayPartStandIn part={part} styleId={id} styleName={sceneStylesOn(part, 'event', 'wedding').find((s) => s.id === id)?.name ?? null} />
      </div>
    );
  };
  /* The day's parts in the page's own order (`MAKER_STAGE_PAGES.event`, top to bottom). */
  const drawn: ReadonlyArray<readonly [string, ReactNode]> = [
    [
      'f:spotlight',
      <section key="spot" className="px-4 pt-6" data-lab-day="spotlight">
        <span className="flex items-center justify-between gap-4 rounded-2xl bg-cream/70 px-5 py-4 text-left shadow-sm">
          <span className="space-y-1">
            <span className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-terracotta">Happening now</span>
            <span className="block font-serif text-lg text-ink">Watch the event live →</span>
          </span>
        </span>
      </section>,
    ],
    ['f:announcements', dayPart('announcements')],
    ['f:live_hub', dayPart('live_hub')],
    ['f:hero', given['f:hero']],
    ['w:schedule', given['w:schedule']],
    ['w:venue_map', given['w:venue_map']],
    ['w:dress_code', given['w:dress_code']],
    [
      'w:our_photos',
      <div key="gallery" className="border-t border-ink/10 px-4 py-8" data-lab-scene="our_photos">
        <MakerEmptyScene type="our_photos" styleId={galleryStyle} />
      </div>,
    ],
    ['f:photos_of_you', dayPart('photos_of_you')],
    ['f:find_your_seat', dayPart('find_your_seat')],
    /* The guest's pass — the canvas's own stand-in, which draws its own marker. */
    ['f:pass', <div key="pass" className="border-t border-ink/10 px-4 py-8"><MakerGuestScenes show={{ greeting: false, pass: true, rsvp: false }} eventDate="2026-12-12" solemn={false} mark={mark} /></div>],
  ];
  const filled = new Set<string>();
  const byPage = new Map<string, ReactNode[]>();
  for (const [key, node] of drawn) {
    if (!node) continue;
    const page = makerStagesPageOf('event', key, keys);
    filled.add(page);
    byPage.set(page, [
      ...(byPage.get(page) ?? []),
      <div key={key} className="contents">
        {key === 'f:pass' ? null : mark(key)}
        {node}
      </div>,
    ]);
  }
  return (
    <div className="sn-editorial" data-lab-day-pages="">
      {keys.map((p) =>
        filled.has(p) ? (
          <div key={p} {...(paged ? { [HUB_TAB_ATTR]: p } : {})} hidden={paged && p !== active ? true : undefined}>
            {byPage.get(p)}
          </div>
        ) : paged ? (
          <div key={p} {...{ [HUB_TAB_ATTR]: p }} data-stages-page={p} hidden={p !== active ? true : undefined}>
            <MakerPageStandIn page={p} label={pages.find((x) => x.key === p)?.label ?? p} />
          </div>
        ) : null,
      )}
    </div>
  );
}
