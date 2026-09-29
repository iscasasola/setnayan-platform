/**
 * ⚡ A SCENE'S BACKGROUND, ON THE MAKER CANVAS NOW — the frame side.
 *
 * #6046 made element choices instant and left background choices as save +
 * buffered reload (~3.5 s), because the frame's classes and variables are
 * computed by `lib/hub-canvas` (`hubCanvasClass` / `hubCanvasVars`), too big for
 * the guest page's client bundle. So the MAKER computes them — with those SAME
 * functions the server's `HubCanvasFrame` uses (`scene-bg-preview-message.ts`) —
 * and posts the answer; this file only LAYS it, and is deliberately tiny and
 * dependency-free (it ships in the guest page's bundle, behind the bridge).
 *
 *   parent → frame  { source:'setnayan-editor', t:'sceneBg', scenes:[{ key, classes, vars }] }
 *
 * A scene already framed (`.hub-canvas`) takes the new class list and variables;
 * a scene with no frame yet is wrapped in one exactly as the frame draws it
 * (`.hub-canvas > .hub-canvas-body > <scene>`); a scene whose background was
 * taken off keeps its frame with the "no media" classes the server would give
 * it. The buffered reload that follows the save confirms — this is the preview.
 *
 * 🔒 NOTHING FROM THE MESSAGE BECOMES CSS UNCHECKED. A class must be
 * `hub-…` lowercase; a variable must be a `--hub-…` or `--color-…` name (or
 * `color`, the ink the words follow), and its value may not
 * carry `;` `{` `}` `<` `>` or a backslash — so a value can never close the
 * declaration it sits in. The message is also origin-checked by the bridge.
 */

/**
 * `bare` (optional): the server's answer (`sceneWidgetIsBare`) for the new
 * canvas — the widget draws no card of its own. The bridge swaps the card to
 * that look at once (`lib/scene-card-look.ts` `applySceneCardPreview`); absent
 * when the Maker could not answer, and the reload decides.
 */
export type SceneBgPreviewScene = { key: string; classes: string[]; vars: Record<string, string>; bare?: boolean };

const CLASS = /^hub-[a-z0-9_-]{1,60}$/;
/** The frame's own variables (`--hub-…`) and the legibility tokens its words are painted through (`--color-…`, `color`). */
const VAR = /^(?:--hub-[a-z0-9-]{1,40}|--color-[a-z0-9-]{1,40}|color)$/;
const OWNED = (p: string) => p.startsWith('--hub-') || p.startsWith('--color-') || p === 'color';
const UNSAFE = /[;{}<>\\]/;

/** The message's scenes, with anything that is not a closed-shape class or variable dropped. */
export function sanitizeSceneBgPreview(raw: unknown): SceneBgPreviewScene[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneBgPreviewScene[] = [];
  for (const s of raw.slice(0, 40)) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    if (typeof r.key !== 'string' || !/^w:[a-z0-9_]{1,40}$/.test(r.key)) continue;
    const classes = Array.isArray(r.classes) ? r.classes.filter((c): c is string => typeof c === 'string' && CLASS.test(c)) : [];
    const vars: Record<string, string> = {};
    if (r.vars && typeof r.vars === 'object' && !Array.isArray(r.vars)) {
      for (const [k, v] of Object.entries(r.vars as Record<string, unknown>)) {
        if (VAR.test(k) && typeof v === 'string' && v.length <= 2000 && !UNSAFE.test(v)) vars[k] = v;
      }
    }
    out.push(typeof r.bare === 'boolean' ? { key: r.key, classes, vars, bare: r.bare } : { key: r.key, classes, vars });
  }
  return out;
}

type PreviewDoc = Pick<Document, 'createElement'>;

/**
 * Lay one scene's frame. `scene` is what the navigator's marker points at — the
 * frame (`.hub-canvas`) when there is one, else the scene itself. Returns the
 * frame now carrying the choice (null when there was nothing to lay).
 */
export function applySceneBgPreview(scene: HTMLElement, preview: SceneBgPreviewScene, doc: PreviewDoc): HTMLElement | null {
  let frame: HTMLElement | null = scene.classList.contains('hub-canvas') ? scene : null;
  if (!frame) {
    if (preview.classes.length === 0) return null;
    frame = doc.createElement('div') as HTMLElement;
    const body = doc.createElement('div') as HTMLElement;
    body.className = 'hub-canvas-body';
    scene.parentNode?.insertBefore(frame, scene);
    frame.appendChild(body);
    body.appendChild(scene);
  }
  frame.className = ['hub-canvas', ...preview.classes.filter((c) => c !== 'hub-canvas')].join(' ');
  // Every variable and ink the frame carried goes, then the new set is laid.
  const old: string[] = [];
  for (let i = 0; i < frame.style.length; i += 1) {
    const p = frame.style.item(i);
    if (OWNED(p)) old.push(p);
  }
  for (const p of old) frame.style.removeProperty(p);
  for (const [p, v] of Object.entries(preview.vars)) frame.style.setProperty(p, v);
  // A photo behind the words is a layer of its own (`.hub-canvas-media`).
  const wantsPhoto = '--hub-media' in preview.vars;
  const layer = Array.from(frame.children).find((c) => c.classList.contains('hub-canvas-media') && c.tagName === 'DIV');
  if (wantsPhoto && frame.classList.contains('hub-has-media') && !layer) {
    const media = doc.createElement('div') as HTMLElement;
    media.className = 'hub-canvas-media';
    media.setAttribute('aria-hidden', 'true');
    frame.insertBefore(media, frame.firstChild);
  } else if (!wantsPhoto && layer) {
    layer.remove();
  }
  /* 🌄 Parallax — the frame says so with `hub-bg-parallax`; the photo layer
     then wears the SHIPPED hero parallax's own mark, which its script reads on
     every frame (`PahinaCoverParallax`), exactly as `hub-canvas-frame.tsx`
     draws it. */
  const photo = Array.from(frame.children).find((c) => c.classList.contains('hub-canvas-media') && c.tagName === 'DIV');
  if (photo) {
    if (frame.classList.contains('hub-bg-parallax')) photo.setAttribute('data-pahina-parallax', '');
    else photo.removeAttribute('data-pahina-parallax');
  }
  return frame;
}
