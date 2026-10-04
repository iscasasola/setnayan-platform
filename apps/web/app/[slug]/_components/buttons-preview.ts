/**
 * ⚡ LOOK › BUTTONS, ON THE MAKER CANVAS NOW — the frame side.
 *
 * Owner, 2026-10-04: *"Realtime effects for seeing what will change but always
 * need to press apply to publish to the actual event hub"*. The Maker computes
 * the buttons with the guest page's own resolver (`resolveHubButtons`,
 * `lib/hub-buttons.ts`) and posts the answer; this file only LAYS it on every
 * look scope in the canvas — the same two attributes and the same custom
 * properties `GuestLookScope` wears — so `globals.css`'s button rules repaint
 * every button at once. The draft save follows; the next canvas render draws
 * the same thing from the draft (`HostDraftLook`).
 *
 *   parent → frame  { source:'setnayan-editor', t:'buttons', shape, paint, vars }
 *
 * 🔒 NOTHING FROM THE MESSAGE BECOMES CSS UNCHECKED: the attributes take only
 * the resolver's own words, a variable must be one of the `--hub-btn-…` names,
 * and a value may not carry `;` `{` `}` `<` `>` or a backslash. The bridge also
 * checks the message's origin. Tiny and dependency-free: it ships in the guest
 * page's bundle, behind the bridge.
 */

const SHAPES = ['square', 'rounded', 'pill'];
const PAINTS = ['solid', 'outline'];
const VARS = [
  '--hub-btn-radius',
  '--hub-btn-fill',
  '--hub-btn-label',
  '--hub-btn-border',
  '--hub-btn-hover',
  '--hub-btn-solid',
  '--hub-btn-solid-label',
];
const UNSAFE = /[;{}<>\\]/;

export type ButtonsPreview = { shape: string | null; paint: string | null; vars: Record<string, string> };

/** The message's payload, or null when any part of it is not the resolver's. */
export function sanitizeButtonsPreview(data: unknown): ButtonsPreview | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { shape?: unknown; paint?: unknown; vars?: unknown };
  const shape = d.shape === null ? null : typeof d.shape === 'string' && SHAPES.includes(d.shape) ? d.shape : undefined;
  const paint = d.paint === null ? null : typeof d.paint === 'string' && PAINTS.includes(d.paint) ? d.paint : undefined;
  if (shape === undefined || paint === undefined) return null;
  const vars: Record<string, string> = {};
  if (d.vars && typeof d.vars === 'object') {
    for (const [k, v] of Object.entries(d.vars as Record<string, unknown>)) {
      if (!VARS.includes(k) || typeof v !== 'string' || v.length > 40 || UNSAFE.test(v)) return null;
      vars[k] = v;
    }
  }
  return { shape, paint, vars };
}

/** Lay it on every look scope in the document (the layout's, and the host draft's inside it). */
export function applyButtonsPreview(doc: Document, preview: ButtonsPreview): void {
  for (const scope of doc.querySelectorAll<HTMLElement>('.sn-editorial')) {
    if (preview.shape) scope.setAttribute('data-hub-btn-shape', preview.shape);
    else scope.removeAttribute('data-hub-btn-shape');
    if (preview.paint) scope.setAttribute('data-hub-btn-paint', preview.paint);
    else scope.removeAttribute('data-hub-btn-paint');
    for (const k of VARS) {
      const v = preview.vars[k];
      if (v) scope.style.setProperty(k, v);
      else scope.style.removeProperty(k);
    }
  }
}
