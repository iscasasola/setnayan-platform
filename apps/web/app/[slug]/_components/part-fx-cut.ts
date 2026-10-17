import { HUB_EL_FX_ATTRS, hubElementFxAttrs, hubElementPhotoParallax, hubElementWordCut, type HubElementStyle } from '@/lib/element-style';
import { HUB_FX_LETTER_ATTR, HUB_FX_LINE_ATTR, HUB_FX_WORD_ATTR, hubFxCut, hubFxPieces } from '@/lib/part-fx';
import { keepReactChildren } from './react-children-keep';
import type { RunsDoc } from './part-runs';

/**
 * ✂ THE SIX NEW EFFECTS, ON THE MAKER'S CANVAS NOW (owner-approved 2026-10-16, "SIX NEW EFFECTS") — the instant
 * preview's half of `pahina-masthead.tsx`: a pick of Words ▾, Glow, Reveal ▾ or the photo's Action is laid on the
 * canvas at once, the save behind it (`editor-bridge.tsx` `applyElementPreview`), with the SAME cutter
 * (`lib/part-fx.ts`) and the SAME hooks (`hubElementFxAttrs`) the server draws — so the canvas and the guest page cannot
 * disagree. Idempotent: the old cut is unwrapped first. Every write into React's own nodes is noted first
 * (`keepReactChildren`), so the next in-place redraw finds them where it left them.
 */

/** The part's word / letter / line spans unwrapped back into plain text (before its words or runs are laid again). */
export function unwrapPartFx(part: Element, doc: RunsDoc): void {
  /* One attribute per query (the line, then the words, then their letters) — outermost first, so each unwrap moves
     whole pieces up. */
  const spans = [HUB_FX_LINE_ATTR, HUB_FX_WORD_ATTR, HUB_FX_LETTER_ATTR].flatMap((a) => Array.from(part.querySelectorAll(`[${a}]`)));
  if (spans.length === 0) return;
  spans.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    keepReactChildren(span.parentElement);
    for (const c of Array.from(span.childNodes)) parent.insertBefore(c, span);
    parent.removeChild(span);
  });
  void doc;
  part.normalize();
}

/** The part's text nodes in order — never inside the canvas's hidden second-name holder (`data-el-names-two`). */
function textNodesOf(node: Node, out: Text[]): Text[] {
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) out.push(c as Text);
    else if (c.nodeType === 1 && !(c as Element).hasAttribute('data-el-names-two')) textNodesOf(c, out);
  });
  return out;
}

/** The part's words cut for Word by word · Spread · Glow, as the server cuts them (`fxWords`). Nothing when none is on. */
export function wrapPartFx(part: Element, style: HubElementStyle | null | undefined, doc: RunsDoc): void {
  const fx = hubElementWordCut(style);
  if (!fx) return;
  const nodes = textNodesOf(part, []);
  const whole = nodes.map((n) => n.data).join('');
  const cut = hubFxCut(fx.words, whole);
  let at = 0;
  for (const node of nodes) {
    const text = node.data;
    const pieces = hubFxPieces(text, whole, at, cut);
    at += text.length;
    const parent = node.parentNode;
    if (!parent || pieces.length === 0) continue;
    keepReactChildren(node.parentElement);
    const line = cut.line ? doc.createElement('span') : null;
    if (line) line.setAttribute(HUB_FX_LINE_ATTR, '');
    const put = (n: Node) => {
      if (line) line.appendChild(n);
      else parent.insertBefore(n, node);
    };
    for (const p of pieces) {
      if ('space' in p) {
        put(doc.createTextNode(p.space));
        continue;
      }
      const w = doc.createElement('span');
      w.setAttribute(HUB_FX_WORD_ATTR, '');
      w.setAttribute('data-t', p.word);
      (w as HTMLElement).style.setProperty('--el-fx-i', String(p.i));
      if (p.letters) {
        for (const l of p.letters) {
          const s = doc.createElement('span');
          s.setAttribute(HUB_FX_LETTER_ATTR, '');
          (s as HTMLElement).style.setProperty('--el-fx-x', l.x);
          s.appendChild(doc.createTextNode(l.c));
          w.appendChild(s);
        }
      } else w.appendChild(doc.createTextNode(p.word));
      put(w);
    }
    if (line) parent.insertBefore(line, node);
    parent.removeChild(node);
  }
}

/**
 * The part's effect hooks laid as the server lays them (`hubElementMotionAttr`'s half), and — on the photo — whether
 * the picture keeps its own Parallax (`hubElementPhotoParallax`). The Light leak layer is already on the canvas's photo;
 * its hook shows it (`globals.css`).
 */
export function applyPartFxAttrs(part: HTMLElement, style: HubElementStyle | null | undefined): void {
  const attrs = hubElementFxAttrs(style?.motion);
  for (const name of HUB_EL_FX_ATTRS) {
    const v = attrs[name];
    if (v === undefined) part.removeAttribute(name);
    else part.setAttribute(name, v);
  }
  if (part.getAttribute('data-el') !== 'photo') return;
  const pic = part.querySelector<HTMLElement>('[data-el-pic]');
  if (!pic) return;
  if (hubElementPhotoParallax(style)) pic.setAttribute('data-pahina-parallax', '');
  else pic.removeAttribute('data-pahina-parallax');
}

/**
 * ▶ THE WORDS' AND THE REVEAL'S ARRIVAL, PLAYED AGAIN — every one-shot effect animation inside the part restarted
 * (its delay and stagger kept). The loops (Glow, Ken Burns, Light leak) run on. True when there was one to play.
 */
export const PART_FX_ONE_SHOT = /^el-fx-(word|letter|line|develop|curtain)$/;
export function replayPartFx(part: Element): boolean {
  const all = typeof (part as HTMLElement).getAnimations === 'function' ? (part as HTMLElement).getAnimations({ subtree: true }) : [];
  let played = false;
  for (const a of all) {
    const name = (a as Animation & { animationName?: string }).animationName ?? '';
    if (!PART_FX_ONE_SHOT.test(name)) continue;
    a.cancel();
    a.play();
    played = true;
  }
  return played;
}
