import type { ReactNode } from 'react';
import { DOS_LOOK_DEFAULT, type DosLookId } from '@/lib/dress-code-looks';

/**
 * 🧾 THE DO'S & DON'TS, IN THE EVENT HUB'S OWN TYPE (owner, preview check 08 Oct: *"the presentation of do's and
 * don'ts doesn't look good with the rest of the website"*) — the two looks beside the shipped notes
 * (`lib/dress-code-looks.ts`): **Ticks and crosses** and **Side by side**.
 *
 * Same two lists, same order, the couple's words untouched. What changes is the furniture:
 *   · the headings are in the page's display face (`font-pahina` — the event's own font), not mono labels;
 *   · the lines are the scene's body text (`text-base`, ink), not small print;
 *   · NO filled box — nothing sits on `bg-veil` / `bg-paper-deep`; a hairline is the only rule;
 *   · a ✓ before each "do" (gild, the page's accent) and a ✕ before each "don't" (ink) — the two lists stay
 *     told apart by their mark and their heading, never by a traffic-light hue (design 2026-07-25 §4).
 *
 * The marks are `aria-hidden`: each list is named by its heading, so a screen reader hears "Do" then the lines.
 * The shipped look is NOT drawn here — `dress-code-widget.tsx` and `dress-code-styles.tsx` keep their own
 * markup for it, byte for byte.
 *
 * A server component, CSS only.
 */

const HEAD = 'font-pahina text-2xl font-light leading-tight tracking-tight text-ink';
const LINES = 'space-y-1.5 text-base leading-relaxed text-ink/80';

function List({ heading, rows, mark, tone, kind }: { heading: ReactNode; rows: readonly string[]; mark: '✓' | '✕'; tone: string; kind: 'do' | 'dont' }) {
  return (
    <div className="space-y-2" data-dos-list={kind}>
      <p className={HEAD}>{heading}</p>
      <ul className={LINES}>
        {rows.map((row, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden data-dos-mark="" className={`w-4 shrink-0 text-center font-sans font-medium ${tone}`}>
              {mark}
            </span>
            <span className="min-w-0">{row}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DressCodeDos({ dos, donts, look }: { dos: readonly string[]; donts: readonly string[]; look: DosLookId }) {
  /* The shipped notes are the callers' own markup — asked for them, this draws nothing rather than a guess. */
  if (look === DOS_LOOK_DEFAULT || (dos.length === 0 && donts.length === 0)) return null;
  const side = look === 'side-by-side';
  const both = dos.length > 0 && donts.length > 0;
  return (
    <div
      data-dress-code="dos"
      data-dos-look={look}
      className={side ? `grid gap-x-6 gap-y-5 border-y border-ink/15 py-5 text-left ${both ? 'grid-cols-2' : 'grid-cols-1'}` : 'space-y-5 text-left'}
    >
      {dos.length > 0 ? <List kind="do" heading="Do" rows={dos} mark="✓" tone="text-gild" /> : null}
      {donts.length > 0 ? (
        <div className={side && both ? 'border-l border-ink/15 pl-6' : undefined}>
          <List kind="dont" heading={<>Don&rsquo;t</>} rows={donts} mark="✕" tone="text-ink/55" />
        </div>
      ) : null}
    </div>
  );
}
