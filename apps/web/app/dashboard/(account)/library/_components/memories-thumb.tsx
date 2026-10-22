'use client';

import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { followColumn } from '@/app/dashboard/[eventId]/guests/_components/dock-follows-column';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { LinkPickMenu, type LinkPickOption } from '@/app/_components/link-pick-menu';
import { ActionButton } from '@/components/action-button';
import ms from './memories-screen.module.css';

/**
 * memories-thumb.tsx — Memories' glass thumb row (owner 2026-10-05, "tools live in the lower third"; the prototype's
 * M1/M2/M4): [Event ▾] [Show ▾] and, once ONE event you host is picked, ⤓ Download all (the studio's own
 * `gallery-zip`). Both dropdowns are the shipped `LinkPickMenu` — each option is a plain address, so the page stays a
 * Server Component. Show is the same list it always was (five lenses · "Also kept"); it only changed seats.
 * The row is the Guest list's own `.lower` + `.sn-glass-row`, so every glass row in the app is one thing.
 */
export function MemoriesThumb({
  events,
  eventValue,
  show,
  showValue,
  download,
}: {
  events: readonly LinkPickOption[] | null;
  eventValue: string;
  show: readonly LinkPickOption[];
  showValue: string;
  download: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? followColumn(el) : undefined;
  }, []);
  return (
    <div ref={ref} className={ms.host} data-memories-thumb-host="">
      <div className={`${gs.lower} ${ms.lower} sn-glass-row`} data-on="true" data-memories-thumb="">
        <div className={gs.thumb}>
          {events ? (
            <span data-pick="" className={ms.pick}>
              <LinkPickMenu label="Event" value={eventValue} options={events} dataAttr="data-memories-event" />
            </span>
          ) : null}
          <span data-pick="" className={ms.pick}>
            <LinkPickMenu label="Show" value={showValue} options={show} dataAttr="data-memories-view" />
          </span>
          {download ? (
            <span className={gs.acts}>
              <ActionButton tone="neutral" iconOnly icon={Download} label="Download all" href={download} data-testid="memories-download" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
