/**
 * 🎭 THE REVEAL'S PICTURE — the prototype's `.rv-box` (owner 2026-10-07, on the
 * prototype's Reveal part: *"this is the reveal"*): a 150 × 96 card in the event's
 * colours, drawn as the chosen opening — the nine reveals of 23 Nov 2026 (Veil · Beach curtains ·
 * Envelope classic + gatefold · Fabric · Scratch · Smoke · Cathedral doors · Petals · Fireworks,
 * `app/[slug]/_components/reveal/reveal-templates.ts`), each in the event's own colours. ONE source, two uses: the
 * Cover Scene › Style's cards (`RevealPicture`) — the tile above the cover is gone (2026-10-16).
 *
 * Inline styles only: the canvas is the guest page, whose stylesheet the Maker does
 * not write.
 */
import { COVER_PAPER } from '@/lib/cover-scene';
import { REVEAL_LIBRARY } from '@/app/[slug]/_components/reveal/reveal-templates';
import type { RevealTemplateId } from '@/lib/reveal-config-pure';

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

/** The Fireworks REVEAL's id (`REVEAL_LIBRARY`) — a reveal, not the supplier service of the same word. */
const FIREWORKS_REVEAL: RevealTemplateId = 'fireworks';

const piece = (css: string) => `<i style="position:absolute;display:block;${css}"></i>`;

/** The picture's own size on the page (the Reveal part's stub at the top of the canvas). */
export const REVEAL_PICTURE_PX = { w: 150, h: 96 } as const;

/**
 * `fill` — the picture takes its container's whole box instead of its own 150 × 96: a look CARD is the phone-
 * shaped frame (`.sn-phone-card`, 3 : 4, owner 2026-10-08), and the opening covers a guest's whole phone screen,
 * so the card draws the same flaps at the frame's portrait shape. Every piece is laid in percentages, so nothing
 * is redrawn — the same picture at another proportion, never new artwork.
 */
export function revealPictureHtml(kind: string, c: RevealColours, w: number = REVEAL_PICTURE_PX.w, h: number = REVEAL_PICTURE_PX.h, fill = false, over = false): string {
  /* 🎭 OVER THE COUPLE'S REAL COVER (the Cover Scene's Style cards, controller 2026-10-17; prototype `.lc .pic`): the
     card already shows the cover itself (`StylePreview`), so None adds nothing and the Sheer veil is the sheer cloth and
     its stripes ON it (the prototype's `.v`); a rigid opening stays the closed opening, which hides the cover. */
  if (over && kind === 'none') return '';
  if (over && kind === 'veil-sheer') {
    return `<span data-reveal-picture="${kind}" data-reveal-over="" style="position:absolute;inset:0;display:block;background:linear-gradient(180deg,rgba(255,252,247,.82),rgba(255,250,243,.7));-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)">${piece('inset:0;background:repeating-linear-gradient(100deg,transparent 0 10px,rgba(255,255,255,.4) 10px 12px)')}</span>`;
  }
  const box = `position:${fill ? 'absolute;inset:0' : `relative;width:${w}px;height:${h}px`};margin:0 auto;border-radius:var(--m-r-sm,8px);overflow:hidden;border:1px solid rgba(0,0,0,.08);box-shadow:0 8px 20px -12px rgba(44,42,41,.45);`;
  const d = `background:${c.dominant};`;
  switch (kind) {
    case 'none':
      /* 🚫 No opening: the cover itself, with nothing over it. */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral}"></span>`;
    case 'envelope-gatefold':
      /* two panels meeting at the middle, a band across them */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral}">${piece(`${d}opacity:.85;left:0;top:0;width:50%;height:100%`)}${piece(`${d}opacity:.6;right:0;top:0;width:50%;height:100%`)}${piece(`background:${c.accent};left:0;top:44%;width:100%;height:9%`)}</span>`;
    case 'beach-curtains':
      /* two sheer curtains hung on a rod, their folds in stripes */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.supporting}">${piece(`left:0;top:0;width:52%;height:100%;background:repeating-linear-gradient(90deg,${c.neutral} 0 7px,${c.supporting} 7px 9px)`)}${piece(`right:0;top:0;width:52%;height:100%;background:repeating-linear-gradient(90deg,${c.neutral} 0 7px,${c.supporting} 7px 9px)`)}${piece(`background:${c.accent};left:0;top:3%;width:100%;height:3%`)}</span>`;
    case 'fabric':
      /* one satin drape laid over the cover, folding on the diagonal */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:repeating-linear-gradient(135deg,${c.supporting} 0 14px,${c.neutral} 14px 30px)">${piece(`${d}opacity:.25;inset:0`)}</span>`;
    case 'scratch':
      /* foil with a corner already rubbed away */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral}">${piece(`background:${c.accent};inset:0;clip-path:polygon(0 0,100% 0,100% 62%,70% 78%,44% 66%,18% 92%,0 80%)`)}</span>`;
    case 'smoke':
      /* white fog, thinning in a ring */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:radial-gradient(circle at 50% 55%,${c.supporting} 0 22%,${c.neutral} 38%,${c.neutral} 100%)">${piece(`inset:0;background:radial-gradient(circle at 50% 55%,transparent 0 30%,${c.neutral} 46%)`)}</span>`;
    case 'cathedral-doors':
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.supporting}">${piece(`background:${c.accent};left:6%;top:8%;width:42%;height:92%;border-radius:40px 0 0 0`)}${piece(`background:${c.accent};right:6%;top:8%;width:42%;height:92%;border-radius:0 40px 0 0`)}</span>`;
    case 'petals':
      /* the cover under petals */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.neutral};background-image:radial-gradient(ellipse 5px 7px at 20% 30%,${c.supporting} 98%,transparent),radial-gradient(ellipse 6px 4px at 70% 20%,${c.accent} 98%,transparent),radial-gradient(ellipse 4px 6px at 45% 65%,${c.supporting} 98%,transparent),radial-gradient(ellipse 6px 5px at 80% 75%,${c.supporting} 98%,transparent);background-size:34px 30px"></span>`;
    case FIREWORKS_REVEAL:
      /* a night sky with one burst */
      return `<span data-reveal-picture="${kind}" style="${box}display:block;background:${c.dominant}">${piece(`inset:0;background:radial-gradient(circle at 60% 35%,${c.accent} 0 3%,transparent 4%),repeating-conic-gradient(from 0deg at 60% 35%,${c.accent} 0 2deg,transparent 2deg 20deg);-webkit-mask:radial-gradient(circle at 60% 35%,black 0 28%,transparent 30%);mask:radial-gradient(circle at 60% 35%,black 0 28%,transparent 30%)`)}</span>`;
    default:
      /* Envelope · classic (the four flaps) — and any opening without its own picture. */
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
  'position:absolute;right:10px;top:10px;z-index:4;pointer-events:none;white-space:nowrap;padding:4px 8px;border-radius:var(--m-r-full,999px);' +
  'font:600 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.62);' +
  'background:rgba(255,255,255,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)';
export function coverOpeningTag(kind: string): string {
  if (kind === 'none') return 'No opening';
  const name = REVEAL_LIBRARY.find((r) => r.id === kind)?.label ?? 'The opening';
  return `${name} ◆ opens over it`;
}

export function RevealPicture({ kind, colours, scale = 1, fill = false, over = false }: { kind: string; colours: RevealColours; scale?: number; fill?: boolean; over?: boolean }) {
  return (
    <span
      aria-hidden
      className={fill ? 'absolute inset-0 block' : 'block'}
      style={fill || scale === 1 ? undefined : { transform: `scale(${scale})`, transformOrigin: 'center' }}
      dangerouslySetInnerHTML={{ __html: revealPictureHtml(kind, colours, REVEAL_PICTURE_PX.w, REVEAL_PICTURE_PX.h, fill, over) }}
    />
  );
}
