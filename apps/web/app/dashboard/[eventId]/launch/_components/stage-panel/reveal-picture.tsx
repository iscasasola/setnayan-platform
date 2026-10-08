/**
 * 🎭 THE REVEAL'S PICTURE — the prototype's `.rv-box` (owner 2026-10-07, on the
 * prototype's Reveal part: *"this is the reveal"*): a 150 × 96 card in the event's
 * colours, drawn as the chosen opening — Four-flap envelope · Two-flap side open ·
 * Two-flap top open · Church doors · Sheer veil (the shipped kinds,
 * `app/[slug]/_components/reveal/reveal-templates.ts`). ONE source, two uses: the
 * Reveal part drawn at the top of the page in Stages (`revealStubHtml`, put into the
 * canvas by `stage-tools.tsx`) and its Style › Look cards (`RevealPicture`).
 *
 * Inline styles only: the canvas is the guest page, whose stylesheet the Maker does
 * not write.
 */
export type RevealColours = { dominant: string; supporting: string; accent: string; neutral: string };

const piece = (css: string) => `<i style="position:absolute;display:block;${css}"></i>`;

/** The picture's own size — a look card is as wide as this shape at the row's height (`spCardWidth`). */
export const REVEAL_PICTURE_PX = { w: 150, h: 96 } as const;

export function revealPictureHtml(kind: string, c: RevealColours, w: number = REVEAL_PICTURE_PX.w, h: number = REVEAL_PICTURE_PX.h): string {
  const box = `position:relative;width:${w}px;height:${h}px;margin:0 auto;border-radius:var(--m-r-sm,8px);overflow:hidden;border:1px solid rgba(0,0,0,.08);box-shadow:0 8px 20px -12px rgba(44,42,41,.45);`;
  const d = `background:${c.dominant};`;
  switch (kind) {
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

/** The Reveal part as the page draws it in Stages: the picture, then its two lines. */
export function revealStubHtml(kind: string, c: RevealColours, ink: string, mute: string): string {
  return (
    revealPictureHtml(kind, c) +
    `<p style="margin:.5em 0 0;text-align:center;font-size:.82em;color:${mute}">` +
    `<b style="display:block;margin-bottom:.2em;font-weight:500;font-size:1.25em;color:${ink};font-family:var(--font-pahina,Georgia,serif)">Opens once, over the cover</b>` +
    'then every page after it opens plain</p>'
  );
}

export function RevealPicture({ kind, colours, scale = 1 }: { kind: string; colours: RevealColours; scale?: number }) {
  return (
    <span
      aria-hidden
      className="block"
      style={scale === 1 ? undefined : { transform: `scale(${scale})`, transformOrigin: 'center' }}
      dangerouslySetInnerHTML={{ __html: revealPictureHtml(kind, colours) }}
    />
  );
}
