'use client';

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';

/**
 * 📷 HOME'S PAPIC WIDGET (owner 2026-10-23: *"a smaller widget on home. Then we can expand it"* · *"does not open to
 * a new page. just expands on home"* · *"expanding opens the rest of the settings under it"*).
 *
 * COLLAPSED — the shipped Papic row (`PapicServiceRow`, its words a toggle now) + the one coverage line + the latest
 * five photos with "See all" (→ the event's Memories tab). Add more / See photos stay the row's own doors.
 *
 * TAP the row (or its chevron) → the card grows IN PLACE: height and a fade together, 420 ms on the house ease, the
 * rest of Home moving down under it; reduced motion opens it at once. The URL never changes. Tap it again to fold.
 * EXPANDED — `settings`, the event-wide camera settings (`PapicCameraSettings`), streamed in behind the first paint.
 *
 * 🔑 The toggle is the row's own `<button data-glance-toggle>` (server-drawn), answered here by delegation — so the
 * row stays one component and Home's other rows keep their links.
 */
export function PapicHomeWidget({
  row,
  coverage,
  strip,
  settings,
}: {
  row: ReactNode;
  /** "Sat 12 Dec → Sun 13 Dec, 12 noon" · "Open now →" · "Closed" — or null when the dates cannot be read. */
  coverage: string | null;
  /** The latest five + See all, or null when there is nothing to show. */
  strip: ReactNode;
  /** The expanded camera settings — null for a viewer who may not change them (the row then stays a plain row). */
  settings: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Drawn once asked for, then kept — folding never throws away a sheet's or a field's state.
  const [drawn, setDrawn] = useState(false);
  const bodyId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setDrawn(true);
    setOpen((o) => !o);
  }, []);

  // The row's button carries the state for a screen reader.
  useEffect(() => {
    const btn = rootRef.current?.querySelector<HTMLButtonElement>('[data-glance-toggle]');
    if (!btn) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-controls', bodyId);
  }, [open, bodyId]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!settings) return;
    const hit = (e.target as HTMLElement).closest('[data-glance-toggle]');
    if (hit && rootRef.current?.contains(hit)) toggle();
  };

  return (
    <div
      ref={rootRef}
      onClick={onClick}
      data-papic-widget=""
      data-open={open ? 'true' : 'false'}
      /* Open, the row's own doors stand down — the settings carry Add more and the strip See all (never twice). */
      className="[&_.sg-arrow]:transition-transform [&_.sg-arrow]:duration-[420ms] [&_.sg-arrow]:ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:[&_.sg-arrow]:transition-none [&[data-open=true]_.sg-arrow]:rotate-90 [&[data-open=true]_.sg-acts]:hidden"
    >
      {row}
      {coverage || strip ? (
        <div className="-mt-1 flex flex-col gap-2 px-1 pb-1" data-papic-widget-quick="">
          {coverage ? (
            <p className="text-[13px] text-ink/65" data-papic-coverage="">
              {coverage}
            </p>
          ) : null}
          {strip}
        </div>
      ) : null}
      {settings ? (
        <div
          id={bodyId}
          role="region"
          aria-label="Camera settings"
          aria-hidden={!open}
          inert={!open}
          data-papic-widget-body=""
          className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-1 pb-2 pt-3">{drawn ? settings : null}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
