'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
 *
 * 🔗 A LINK OPENS IT WITH THE PAGE (owner 2026-10-30, *"that shoud be inside home settings"*): `?settings=1` (the ☰'s
 * event mark, every "Change ›" to People with access, a Remove landing back) opens the sheet as Home arrives, landed on
 * `&row=` when one is named. Closing drops those words from the address without a navigation, so Back and a reload do
 * not reopen it. And since People with access saves through actions that redraw the PAGE (not this sheet's rows), each
 * fresh server render of Home while the sheet is up (`renderKey`) re-reads the rows once, in place — a person added
 * or a seat approved appears in the sheet, never only behind it.
 */
/** The shipped reader — the one action, loaded at the first press (Home's first load carries no server door for it). */
const readEventSettings = async (eventId: string, landed: HomeSettingsLanded | null): Promise<EventSettingsResult> =>
  (await import('./open-event-settings')).openEventSettings(eventId, landed);

/** The address words a Remove lands back with (`seatReturnPath`, `return_to=home`) — the action reads only its own. */
export type HomeSettingsLanded = { host_removed?: string; invite_error?: string };

/** The words a link opens the sheet with — dropped from the address once it is closed. */
const LINK_WORDS = ['settings', 'row', 'host_removed', 'invite_error'] as const;

export function HomeSettingsGear({
  eventId,
  rows,
  openAtFirst = false,
  landRow = null,
  landed = null,
  renderKey,
}: {
  eventId: string;
  /** The Home lab's rows, already drawn on its fixture (`/dev/home-lab`) — then nothing is read. Absent = read at the press. */
  rows?: ReactNode;
  /** `?settings=1` — the sheet opens with the page. */
  openAtFirst?: boolean;
  /** `&row=` — the section the sheet lands on (`data-event-settings-row`). */
  landRow?: string | null;
  /** A Remove's own words on the address it landed on. */
  landed?: HomeSettingsLanded | null;
  /** Changes with every server render of Home — while the sheet is up, a fresh render re-reads its rows. */
  renderKey?: string;
}) {
  const [open, setOpenState] = useState(openAtFirst);
  const [land, setLand] = useState<string | null>(openAtFirst ? landRow : null);
  const [flashFrom, setFlashFrom] = useState<HomeSettingsLanded | null>(openAtFirst ? landed : null);

  /* A link to Home with `?settings=1` while Home is already up (the ☰'s mark tapped on Home) is a fresh render with the
     words again — open then too. */
  const openNow = useRef(open);
  openNow.current = open;
  useEffect(() => {
    // Already up: a save's fresh render must not yank the sheet back to the link's section.
    if (!openAtFirst || openNow.current) return;
    setOpenState(true);
    setLand(landRow);
    setFlashFrom(landed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per render that carries the link's words
  }, [openAtFirst, renderKey]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (next) return;
    setLand(null);
    setFlashFrom(null);
    try {
      const url = new URL(window.location.href);
      if (!LINK_WORDS.some((k) => url.searchParams.has(k))) return;
      for (const k of LINK_WORDS) url.searchParams.delete(k);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* the address keeps its words; the sheet is closed either way */
    }
  }, []);
  const [got, setGot] = useState<{ body: ReactNode } | { reason: string } | null>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (!open) {
      setGot(null);
      return;
    }
    if (rows !== undefined) {
      setGot({ body: rows });
      return;
    }
    let live = true;
    readEventSettings(eventId, flashFrom)
      .then((r) => live && setGot(r.ok ? { body: r.body } : { reason: r.reason }))
      .catch(() => live && setGot({ reason: 'Event settings couldn’t open just now. Nothing was changed — close it and try again.' }));
    return () => {
      live = false;
    };
  }, [open, eventId, reads, rows, renderKey, flashFrom]);

  /* Land on the named section once its rows are drawn. The sheet stands on <body> a beat after it opens and then moves
     focus into itself (`useModalA11y`), which can scroll its body back to the top — so look for the row a few times,
     land, and land again twice more while the sheet settles, unless the person has already touched it. */
  useEffect(() => {
    if (!open || !land || got === null || 'reason' in got) return;
    const timers: number[] = [];
    let touched = false;
    const stop = () => {
      touched = true;
    };
    const events = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    for (const ev of events) window.addEventListener(ev, stop, { passive: true, capture: true });
    const row = () => document.querySelector(`[data-menu-settings-sheet="home"] [data-event-settings-row="${CSS.escape(land)}"]`);
    let tries = 0;
    const look = () => {
      const at = row();
      if (!at) {
        if (++tries < 20) timers.push(window.setTimeout(look, 100));
        return;
      }
      at.scrollIntoView({ block: 'start' });
      for (const ms of [300, 700]) timers.push(window.setTimeout(() => !touched && row()?.scrollIntoView({ block: 'start' }), ms));
      timers.push(window.setTimeout(() => setLand(null), 750));
    };
    look();
    return () => {
      for (const t of timers) window.clearTimeout(t);
      for (const ev of events) window.removeEventListener(ev, stop, { capture: true });
    };
  }, [open, land, got]);

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
