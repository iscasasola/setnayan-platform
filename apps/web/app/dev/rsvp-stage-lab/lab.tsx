'use client';

import { useEffect, type ComponentProps } from 'react';
import { MakerRsvpStage } from '@/app/dashboard/[eventId]/launch/_components/maker-rsvp-stage';
import { MAKER_DRAFT_BAR_EVENT } from '@/lib/maker-refresh';

type Props = ComponentProps<typeof MakerRsvpStage>;

/**
 * The lab's stage, with a stopwatch. `window.__rsvpLab.mark(label)` starts a
 * timing just before an edit; the first change in any frame's text (a
 * MutationObserver on the frames' documents) stops "visible", and the next
 * `MAKER_DRAFT_BAR_EVENT` — announced when a save answers with the bar — stops
 * "saved". Readings land in `window.__rsvpLab.readings`.
 */
export function RsvpStageLab({
  solemn,
  draftAction,
  replyByAction,
}: {
  solemn: boolean;
  draftAction: Props['draftAction'];
  replyByAction: Props['replyByAction'];
}) {
  useEffect(() => {
    type Reading = { label: string; visibleMs: number | null; savedMs: number | null };
    const lab = {
      readings: [] as Reading[],
      open: null as (Reading & { t0: number }) | null,
      mark(label: string) {
        lab.open = { label, visibleMs: null, savedMs: null, t0: performance.now() };
      },
      close() {
        if (lab.open) {
          const { t0: _t0, ...r } = lab.open;
          lab.readings.push(r);
        }
        lab.open = null;
      },
    };
    (window as unknown as { __rsvpLab: typeof lab }).__rsvpLab = lab;
    const observers: MutationObserver[] = [];
    const watch = () => {
      document.querySelectorAll<HTMLIFrameElement>('iframe[data-rsvp-stage-frame]').forEach((f) => {
        const doc = f.contentDocument;
        if (!doc?.body || (f as unknown as { __watched?: boolean }).__watched) return;
        (f as unknown as { __watched?: boolean }).__watched = true;
        const mo = new MutationObserver(() => {
          if (lab.open && lab.open.visibleMs === null) lab.open.visibleMs = Math.round(performance.now() - lab.open.t0);
        });
        mo.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
        observers.push(mo);
      });
    };
    const timer = window.setInterval(watch, 300);
    const onBar = () => {
      if (lab.open && lab.open.savedMs === null) lab.open.savedMs = Math.round(performance.now() - lab.open.t0);
    };
    window.addEventListener(MAKER_DRAFT_BAR_EVENT, onBar);
    return () => {
      window.clearInterval(timer);
      observers.forEach((o) => o.disconnect());
      window.removeEventListener(MAKER_DRAFT_BAR_EVENT, onBar);
    };
  }, []);
  return (
    <div className="fixed inset-0 flex flex-col bg-cream text-ink" data-rsvp-stage-lab="">
      <MakerRsvpStage
        eventId="00000000-0000-4000-8000-000000000000"
        publicLandingUrl="/dev/rsvp-stage-lab"
        solemn={solemn}
        current={{}}
        drafted={false}
        replyBy={{ date: '2026-11-18', isDefault: true }}
        replyByOwn={{ deadline: null, pricingMode: 'realtime' }}
        replyByFallback="2026-11-18"
        frameSrc={(scene) => `/dev/rsvp-stage-lab/frame?scene=${scene}${solemn ? '&solemn=1' : ''}`}
        draftAction={draftAction}
        replyByAction={replyByAction}
      />
    </div>
  );
}
