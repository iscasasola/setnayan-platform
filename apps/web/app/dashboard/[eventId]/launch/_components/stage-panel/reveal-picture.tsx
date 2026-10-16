/**
 * 🎭 THE REVEAL'S PICTURE — the prototype's `.rv-box` (owner 2026-10-07, on the
 * prototype's Reveal part: *"this is the reveal"*): a 150 × 96 card in the event's
 * colours, drawn as the chosen opening — Four-flap envelope · Two-flap side open ·
 * Two-flap top open · Church doors · Sheer veil (the shipped kinds,
 * `app/[slug]/_components/reveal/reveal-templates.ts`). ONE source, two uses: the
 * Cover Scene › Style's cards (`RevealPicture`) — the tile above the cover is gone (2026-10-16).
 *
 * Inline styles only: the canvas is the guest page, whose stylesheet the Maker does
 * not write.
 */
import { COVER_PAPER } from '@/lib/cover-scene';
import { REVEAL_LIBRARY } from '@/app/[slug]/_components/reveal/reveal-templates';

export type RevealColours = { dominant: string; supporting: string; accent: string; neutral: string };

/**
 * 🎨 THE EVENT'S INK, NOT THE COVER'S (owner 2026-10-16, live: a blank white rounded box over "Opens once, over the
 * cover"). The picture's colours are read off the page's own words — the names' ink, the Title's — but over a dark
 * Cover Scene background those words are CREAM (`COVER_SCENE_CREAM_VARS` repaints `--color-ink` on the cover), so the
 * flaps were cream on the cream page: an empty card. A word inside a cream-toned cover is read with the page's own
 * ink in place of the cover's paper, its alpha kept. Held by `lib/a-text-style-card-shows-its-words.test.ts`.
 */
export function revealPageInk(doc: Document, selector: string): string {
  const view = doc.defaultView;
  if (!view) return 'rgb(44, 42, 41)';
  const el = doc.querySelector(selector) ?? doc.body;
  const color = view.getComputedStyle(el).color;
  const cover = el.closest('[data-cover-tone="cream"]');
  if (!cover) return color;
  return coverPaperAsInk(color, view.getComputedStyle(cover.parentElement ?? doc.documentElement).getPropertyValue('--color-ink'));
}

const PAPER = [1, 3, 5].map((i) => parseInt(COVER_PAPER.slice(i, i + 2), 16));
/** `rgb(a)` in the cover's paper → the same alpha in the page's ink (`--color-ink`'s channels, "44 42 41"); else as is. */
export function coverPaperAsInk(color: string, inkChannels: string): string {
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/.exec(color.trim());
  const ink = inkChannels.trim().split(/[\s,]+/).map(Number);
  if (!m || ink.length !== 3 || ink.some((v) => !Number.isFinite(v))) return color;
  if ([m[1], m[2], m[3]].some((v, i) => Number(v) !== PAPER[i])) return color;
  return m[4] === undefined ? `rgb(${ink.join(', ')})` : `rgba(${ink.join(', ')}, ${m[4]})`;
}

const piece = (css: string) => `<i style="position:absolute;display:block;${css}"></i>`;

/** The picture's own size on the page (the Reveal part's stub at the top of the canvas). */
export const REVEAL_PICTURE_PX = { w: 150, h: 96 } as const;

/**
 * `fill` — the picture takes its container's whole box instead of its own 150 × 96: a look CARD is the phone-
 * shaped frame (`.sn-phone-card`, 3 : 4, owner 2026-10-08), and the opening covers a guest's whole phone screen,
 * so the card draws the same flaps at the frame's portrait shape. Every piece is laid in percentages, so nothing
 * is redrawn — the same picture at another proportion, never new artwork.
 */
export function revealPictureHtml(kind: string, c: RevealColours, w: number = REVEAL_PICTURE_PX.w, h: number = REVEAL_PICTURE_PX.h, fill = false): string {
  const box = `position:${fill ? 'absolute;inset:0' : `relative;width:${w}px;height:${h}px`};margin:0 auto;border-radius:var(--m-r-sm,8px);overflow:hidden;border:1px solid rgba(0,0,0,.08);box-shadow:0 8px 20px -12px rgba(44,42,41,.45);`;
  const d = `background:${c.dominant};`;
  switch (kind) {
    case 'none':
      /* 🚫 No opening: the cover itself, with nothing over it. */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral}"></span>`;
    case 'two-flap-vertical':
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral}">${piece(`${d}opacity:.85;left:0;top:0;width:50%;height:100%`)}${piece(`${d}opacity:.6;right:0;top:0;width:50%;height:100%`)}</span>`;
    case 'two-flap-horizontal':
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral}">${piece(`${d}opacity:.85;left:0;top:0;width:100%;height:50%`)}${piece(`${d}opacity:.6;left:0;bottom:0;width:100%;height:50%`)}</span>`;
    case 'church-doors':
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.supporting}">${piece(`background:${c.accent};left:6%;top:8%;width:42%;height:92%;border-radius:40px 0 0 0`)}${piece(`background:${c.accent};right:6%;top:8%;width:42%;height:92%;border-radius:0 40px 0 0`)}</span>`;
    case 'veil-sheer':
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:linear-gradient(180deg,${c.supporting},${c.neutral})">${piece('inset:0;background:rgba(255,255,255,.55);backdrop-filter:blur(2px)')}</span>`;
    default:
      /* Four-flap envelope — and any opening without its own picture. */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral}">${piece(`${d}opacity:.85;left:0;top:0;width:100%;height:50%;clip-path:polygon(0 0,100% 0,50% 100%)`)}${piece(`${d}opacity:.55;left:0;top:0;width:50%;height:100%;clip-path:polygon(0 0,100% 50%,0 100%)`)}${piece(`${d}opacity:.55;right:0;top:0;width:50%;height:100%;clip-path:polygon(100% 0,0 50%,100% 100%)`)}${piece(`${d}opacity:.7;left:0;bottom:0;width:100%;height:50%;clip-path:polygon(0 100%,100% 100%,50% 0)`)}</span>`;
  }
}

/**
 * 🎭 THE COVER'S CORNER NAMES ITS OPENING (owner-approved 2026-10-16, "THE COVER SCENE'S OWN … STYLE (OPENING)"; prototype
 * `.openhint`): the Reveal's tile that floated above the cover is gone — the opening is Cover Scene › Style, and the
 * cover's top-right corner says which ("Sheer veil ◆ opens over it", or "No opening"). Drawn on the Maker's canvas
 * only, by `stage-tools.tsx`; never a part, never pressable.
 */
export const COVER_OPENING_TAG_ATTR = 'data-maker-opening-tag';
export const COVER_OPENING_TAG_CSS =
  'position:absolute;right:10px;top:10px;z-index:4;pointer-events:none;white-space:nowrap;padding:4px 8px;border-radius:999px;' +
  'font:600 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.62);' +
  'background:rgba(255,255,255,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)';
export function coverOpeningTag(kind: string): string {
  if (kind === 'none') return 'No opening';
  const name = REVEAL_LIBRARY.find((r) => r.id === kind)?.label ?? 'The opening';
  return `${name} ◆ opens over it`;
}

export function RevealPicture({ kind, colours, scale = 1, fill = false }: { kind: string; colours: RevealColours; scale?: number; fill?: boolean }) {
  return (
    <span
      aria-hidden
      className={fill ? 'absolute inset-0 block' : 'block'}
      style={fill || scale === 1 ? undefined : { transform: `scale(${scale})`, transformOrigin: 'center' }}
      dangerouslySetInnerHTML={{ __html: revealPictureHtml(kind, colours, REVEAL_PICTURE_PX.w, REVEAL_PICTURE_PX.h, fill) }}
    />
  );
}
