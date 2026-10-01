'use client';

import { useEffect, useState } from 'react';
import { useMaker } from '../../../launch/_components/maker-context';
import { sanitizeHubFontKey, type HubFontKey } from '@/lib/hub-fonts';
import {
  HUB_FONT_LEAD,
  HUB_FONT_RECENT_KEY,
  hubFontPickOptions,
  pushRecentHubFont,
  sanitizeRecentHubFonts,
} from '@/lib/hub-font-shelves';
import { PickMenu } from './pick-menu';

/** The picks every font dropdown on this device shares, and the event it announces them on. */
const RECENT_EVENT = 'sn-maker-fonts';

function readRecent(eventId: string): HubFontKey[] {
  try {
    return sanitizeRecentHubFonts(JSON.parse(window.localStorage.getItem(HUB_FONT_RECENT_KEY(eventId)) ?? '[]'));
  } catch {
    return [];
  }
}

/**
 * 🔤 THE ONE FONT DROPDOWN — every font picker in the Event Hub editor is this.
 *
 * Owner, 2026-09-29: *"the font across all event hub editor. can be one style.
 * A dropdown with the following: 5 recently used · 5 most used fonts on the
 * website · all the rest of the fonts. * all fonts that are being used in the
 * website must have and (actively used) label?"*
 *
 * The shelves, their order and the options are `hubFontPickOptions`
 * (`lib/hub-font-shelves.ts`);
 * this draws them on the shipped `PickMenu` (any set of choices is one
 * dropdown), each name set in its own face, shelf headings sticky while the
 * list scrolls, and a face the page uses now marked "In use" — the list the work
 * area registers from the draft-over-live data the canvas draws
 * (`MakerLookPages.fontsInUse`). Outside the Maker nothing is registered and no
 * face is marked, rather than a guess.
 *
 * ⚡ Each preview face downloads only when its row scrolls into the open list
 * (`PickMenu` gives a font row `content-visibility: auto`), so opening the
 * dropdown on a phone does not fetch thirty-five faces.
 *
 * 💎 A Pro font keeps its ◆ on the row's label, drawn by the caller as before —
 * never a padlock on an option; Apply asks.
 *
 * `name` posts the choice from a server form (the Colours row's `site_font_key`):
 * `''` = the theme's own, exactly as the radios it replaces posted.
 */
export function FontPick({
  eventId,
  label,
  value,
  onPick,
  lead,
  name,
  dataAttr,
  className,
}: {
  eventId: string;
  /** What the control is, for a screen reader ("Font", "Typeface"). */
  label: string;
  /** The face chosen, or null for the lead option. */
  value: HubFontKey | null;
  /** A face, or null when the lead option ("Event Hub font") is picked. */
  onPick?: (key: HubFontKey | null) => void;
  /** The way back to no face of their own, first and always offered. Omitted = none (the logo always has a face). */
  lead?: string;
  /** Post the choice under this form field name (`''` = the lead). */
  name?: string;
  dataAttr?: string;
  className?: string;
}) {
  const maker = useMaker();
  const [recent, setRecent] = useState<HubFontKey[]>([]);
  const [picked, setPicked] = useState(value);
  useEffect(() => setPicked(value), [value]);
  useEffect(() => {
    const read = () => setRecent(readRecent(eventId));
    read();
    window.addEventListener(RECENT_EVENT, read);
    return () => window.removeEventListener(RECENT_EVENT, read);
  }, [eventId]);

  return (
    <>
      {name ? <input type="hidden" name={name} value={picked ?? ''} /> : null}
      <PickMenu
        label={label}
        dataAttr={dataAttr}
        value={picked ?? HUB_FONT_LEAD}
        stickyGroups
        options={hubFontPickOptions({ recent, inUse: maker?.lookPages?.fontsInUse ?? [], lead })}
        onPick={(k) => {
          const key = sanitizeHubFontKey(k);
          setPicked(key);
          if (key) {
            try {
              window.localStorage.setItem(HUB_FONT_RECENT_KEY(eventId), JSON.stringify(pushRecentHubFont(readRecent(eventId), key)));
            } catch {
              /* private mode / blocked storage: the font is still used, only not remembered */
            }
            window.dispatchEvent(new Event(RECENT_EVENT));
          }
          onPick?.(key);
        }}
        className={className}
      />
    </>
  );
}
