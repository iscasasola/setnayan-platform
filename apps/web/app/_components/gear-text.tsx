import { Fragment, type ReactNode } from 'react';
import { Settings } from 'lucide-react';

/**
 * GEAR TEXT — a line of copy that names the page's ⚙ draws the REAL Settings icon in its place, never the emoji.
 *
 * Build 5 F5 (2026-11-10, Step 0b item 9 "Words"): copy said "Open in Guests ⚙ ›" and "stay in Clients ⚙" with the
 * emoji glyph, which every platform draws differently and none draws like the button it points at — the page's
 * Settings button is lucide `Settings` (`menu-settings-button.tsx`). So the words keep their ⚙ as the one marker in
 * the source (greppable, and the tests read it), and the RENDER swaps it for that same icon, sized to the text and
 * read as "Settings" by a screen reader.
 *
 * ⚠ For copy rendered as JSX text. A string that ends up in an attribute (`title=`, `aria-label=`) or in HTML
 * (`dangerouslySetInnerHTML`) cannot hold an icon — say "Settings" in words there instead.
 */
export function gearText(text: string): ReactNode {
  if (!text.includes('⚙')) return text;
  const parts = text.split('⚙');
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? (
        <Settings
          role="img"
          aria-label="Settings"
          data-gear-text=""
          className="inline-block h-[1em] w-[1em] align-[-0.125em]"
        />
      ) : null}
    </Fragment>
  ));
}
