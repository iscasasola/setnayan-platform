'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { MakerContext, type MakerLookPages, type MakerState } from '@/app/dashboard/[eventId]/launch/_components/maker-context';
import type { DetailsItemKey } from '@/lib/maker-details-items';

/**
 * `/dev/details-lab?look=1` — the Look items (Details part 3) on fixtures. The
 * Logo, Hero and Reveal pages are built by the Maker's work area, which needs a
 * signed-in couple and the database; here each is a labelled stand-in of the
 * same size, so the three-column LAYOUT (a page that fills the body, a page
 * that carries its own tools) can be checked at 375 / 390 and on a desk.
 */
function Stand({ name, tall = false }: { name: string; tall?: boolean }) {
  return (
    <div
      data-lab-stand={name}
      className={`flex flex-1 items-center justify-center bg-white/70 text-sm text-ink/60 ${tall ? 'min-h-[900px]' : 'min-h-0'}`}
    >
      {name}
    </div>
  );
}

export function LookLab({ children }: { children: ReactNode }) {
  const [detailsItem, setDetailsItem] = useState<DetailsItemKey | null>(null);
  const noop = () => {};
  const lookPages = useMemo<MakerLookPages>(
    () => ({
      logo: (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <Stand name="Logo studio — its canvas" />
          <div className="shrink-0 border-t border-ink/10 lg:w-[340px] lg:border-l lg:border-t-0">
            <Stand name="Logo studio — its own panel" />
          </div>
        </div>
      ),
      hero: <Stand name="Hero — Designs 1–4, parts, photo, Main background" tall />,
      reveal: <Stand name="Reveal — the opening, where it plays, fine-tune" />,
      revealStages: ['save_the_date', 'rsvp'],
      publicLandingUrl: '/dev/hero-lab',
    }),
    [],
  );
  const value = useMemo<MakerState>(
    () => ({
      eventId: 'lab',
      stage: 'rsvp',
      setStage: noop,
      device: 'phone',
      navOpen: true,
      selection: { kind: 'tool', key: 'details' },
      select: noop,
      moreOpen: false,
      renderStamp: 'lab',
      storeShell: false,
      viewAsHref: null,
      addScene: null,
      setAddScene: noop,
      detailsItem,
      setDetailsItem,
      lookPages,
      setLookPages: noop,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `noop` is a fresh arrow each render; it does nothing
    [detailsItem, lookPages],
  );
  return <MakerContext.Provider value={value}>{children}</MakerContext.Provider>;
}
