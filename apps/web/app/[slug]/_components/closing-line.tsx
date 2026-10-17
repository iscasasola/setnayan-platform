import type { CSSProperties, ReactNode } from 'react';
import { HUB_FX_LINE_ATTR, hubFxCut } from '@/lib/part-fx';
import { HUB_CLOSING_DEFAULT_WORDS, hubElementMotionAttr, hubElementWordCut, type HubElementStyle } from '@/lib/element-style';
import { CLOSING_EL, closingLineInlineStyle, closingLineWords } from '@/lib/closing-line';
import { fxWords } from './pahina-masthead';

/**
 * 🕯 "SEE YOU SOON." — THE CLOSING'S LINE, IN THE COUPLE'S WORDS AND LOOK (owner 2026-10-17, `lib/closing-line.ts`).
 *
 * ONE line for both sign-offs the shell draws (`invitation-shell.tsx`: the plain footer, and the art kit's
 * `KitClosing`), and for the Maker lab's stand-in — so the line a guest reads is the line the Maker edits.
 *
 *   words   the couple's (`elements.closing.word`), or "See you soon." — never empty
 *   look    a cover word's (`hubElementDeclarations`: colour · size · font · width …) laid inline OVER the sign-off's own
 *           (`base`: the kit's ink, the plain footer's theme class) — the couple's own choice wins, as on the cover
 *   motion  the cover's properties and hooks (`[data-el-motion]`, Shimmer's band, Glow's cut), laid for the page's foot
 *
 * 🔒 A line nobody touched renders byte for byte as before: the same `<p data-shell-sign-off>`, the same classes, the
 * same text, no `style` beyond the base, no hooks. On the Maker's canvas only (`stamp`) it carries its part key
 * (`data-el="closing"`, so a tap names it and the Maker's Edit reads it) and the words it falls back to
 * (`data-el-word`, so clearing the couple's words puts "See you soon." back) and the sign-off's own ink (`data-el-ink`,
 * which the canvas puts back when the couple's colour is taken off).
 */
export function ClosingLine({
  line,
  stamp = false,
  className,
  base,
}: {
  /** The hero row's `elements.closing` — null: the line as it always was. */
  line?: HubElementStyle | null;
  /** The Maker's canvas: stamp the part. */
  stamp?: boolean;
  className: string;
  /** The sign-off's own inline look (the kit's ink) — under the couple's. */
  base?: CSSProperties;
}) {
  const words = closingLineWords(line);
  const own = closingLineInlineStyle(line);
  const style = own ? ({ ...base, ...own } as CSSProperties) : base;
  /* ✨ Glow: the words cut into spans here, server-side, as the cover's are (`pahina-masthead.tsx` `fxWords`). */
  const fx = hubElementWordCut(line);
  let content: ReactNode = words;
  if (fx) {
    const cut = hubFxCut(fx.words, words);
    const drawn = fxWords(words, words, 0, cut);
    content = cut.line ? <span {...{ [HUB_FX_LINE_ATTR]: '' }}>{drawn}</span> : drawn;
  }
  return (
    <p
      data-shell-sign-off=""
      {...(stamp ? { 'data-el': CLOSING_EL, 'data-el-word': HUB_CLOSING_DEFAULT_WORDS, ...(base?.color ? { 'data-el-ink': String(base.color) } : {}) } : {})}
      {...hubElementMotionAttr(line)}
      className={className}
      style={style}
    >
      {content}
    </p>
  );
}
