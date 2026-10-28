'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { MAKER_REFRESH_EVENT } from '@/lib/maker-refresh';
import type { EventSettingsResult } from './open-event-settings';

/**
 * ⚙ HOME'S ⚙ — EVENT SETTINGS, ON THE COVER, AT REST TOO (owner 2026-10-29, verbatim: *"on event dashboard> home the
 * header does not show the settings icon like the other pages with settings icon. keep it there"*).
 *
 * Until today Home's ⚙ lived inside the pinned line and was `invisible` until the band stuck (27 Oct), so the Home at
 * rest drew no ⚙ while Guests, Suppliers and Memories each show theirs at the right end of their first row. Now it is ONE
 * mounted `MenuSettingsButton menu="home"` — the same component, the same 44 px every menu's ⚙ is — at the right end of
 * the cover band's bottom 52 px: the band IS Home's first row at rest (no selector), and the same spot is the pinned
 * line's right end once it has stuck, so the ⚙ never moves and is never drawn twice. In the cover's ink (`cover`).
 *
 * It opens EVENT SETTINGS (DECISION_LOG 2026-10-27 "APPROVED — SETTINGS PER MENU": *"Home's header ⚙ = Event Settings
 * only"*): the event's own facts — names · date · venues · parents — each its ONE shipped editor, read by one action
 * at the press (`openEventSettings`). Home's first load reads nothing for it.
 *
 *   · A SAVE NEVER RESETS THE SCREEN — the sheet stays open and its editors keep their place; a save that asks for the
 *     one refresh (`requestMakerRefresh`, e.g. a parent added) re-reads the rows once, in place, without blanking them.
 *   · Closing forgets the rows; the next press reads them fresh.
 */
/** The shipped reader — the one action, loaded at the first press (Home's first load carries no server door for it). */
const SHIPPED_EVENT_SETTINGS = async (eventId: string): Promise<EventSettingsResult> => (await import('./open-event-settings')).openEventSettings(eventId);

export function HomeSettingsGear({
  eventId,
  opener = SHIPPED_EVENT_SETTINGS,
}: {
  eventId: string;
  /** How the rows are read — the shipped action, or the Home lab's fixture (`/dev/home-lab`, a dev-only action). */
  opener?: (eventId: string) => Promise<EventSettingsResult>;
}) {
  const [open, setOpen] = useState(false);
  const [got, setGot] = useState<{ body: ReactNode } | { reason: string } | null>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (!open) {
      setGot(null);
      return;
    }
    let live = true;
    opener(eventId)
      .then((r) => live && setGot(r.ok ? { body: r.body } : { reason: r.reason }))
      .catch(() => live && setGot({ reason: 'Event settings couldn’t open just now. Nothing was changed — close it and try again.' }));
    return () => {
      live = false;
    };
  }, [open, eventId, reads, opener]);

  /* A field that saved and asked for its one render (a new parent, a venue the list must redraw): re-read the rows. */
  useEffect(() => {
    if (!open) return;
    const again = () => setReads((n) => n + 1);
    window.addEventListener(MAKER_REFRESH_EVENT, again);
    return () => window.removeEventListener(MAKER_REFRESH_EVENT, again);
  }, [open]);

  return (
    <span data-home-settings-gear="" className="absolute bottom-1 right-4 inline-flex sm:right-6 lg:right-8">
      <MenuSettingsButton menu="home" open={open} onOpenChange={setOpen} cover>
        {got === null ? (
          <p className="px-4 py-6 text-sm text-ink/60" role="status" data-event-settings-opening="">
            Opening your event’s details…
          </p>
        ) : 'reason' in got ? (
          <p role="alert" className="px-4 py-6 text-sm text-terracotta-700" data-event-settings-failed="">
            {got.reason}
          </p>
        ) : (
          got.body
        )}
      </MenuSettingsButton>
    </span>
  );
}
