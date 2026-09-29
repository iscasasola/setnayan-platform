import {
  HUB_SCENE_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_SELECTOR,
  hubRunDeclarations,
  hubRunsTarget,
  hubTextSegments,
  readHubSceneRuns,
  type HubElementStyle,
  type HubElementStyles,
} from '@/lib/element-style';

/**
 * ✍ RUNS LAID IN THE BROWSER — one letter, one word in its own font · colour ·
 * size, cut into the part's text as `<span data-el-run>`.
 *
 * ONE MECHANISM (`lib/element-style.ts`, `HUB_ELEMENT_RUN_KEYS`). The hero's
 * runs are cut server-side by `PahinaMasthead`; this file cuts the SAME spans
 * with the SAME segmenter (`hubTextSegments`) and the SAME declarations
 * (`hubRunDeclarations`) where no server render can reach:
 *
 *   · the Maker canvas's instant preview of any part (`editor-bridge.tsx`);
 *   · a SCENE's label / heading / words on the guest page (`HubSceneRuns`) —
 *     drawn by widgets that stay ignorant of the canvas, so the runs ride on the
 *     scene's `<style data-hub-runs>` and are laid here once the page loads.
 *
 * Every function is idempotent: the old run spans are unwrapped first, so a
 * part can be re-cut any number of times (a new choice, new words).
 */

/** The part of the DOM a cut writes through — a real document, or a test's. */
export type RunsDoc = Pick<Document, 'createElement' | 'createTextNode'>;

function textNodesOf(node: Node, out: Text[]): Text[] {
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) out.push(c as Text);
    else if (c.nodeType === 1) textNodesOf(c, out);
  });
  return out;
}

/** The part's run spans unwrapped back into plain text. */
function unwrapRuns(part: Element, doc: RunsDoc): void {
  part.querySelectorAll('[data-el-run]').forEach((span) => {
    span.parentNode?.replaceChild(doc.createTextNode(span.textContent ?? ''), span);
  });
  part.normalize();
}

/**
 * ✍ ONE PART'S RUNS, re-cut in place. The old run spans are unwrapped back
 * into plain text, then every text node is cut by `hubTextSegments` at its own
 * offset in the part's WHOLE text (`textContent` — the string the server's
 * `whole` is, and the one the selection's offsets are counted in), and each run
 * piece becomes the same `<span data-el-run>` the guest page draws. Runs made
 * on words that have since changed are ADAPTED onto the words drawn now
 * (`hubRunsOn`), never laid on the wrong letters.
 */
export function applyPartRuns(part: Element, style: HubElementStyle | null | undefined, doc: RunsDoc): void {
  unwrapRuns(part, doc);
  const whole = part.textContent ?? '';
  let at = 0;
  for (const node of textNodesOf(part, [])) {
    const text = node.data;
    const segments = hubTextSegments(text, style, { text: whole, segmentStart: at });
    at += text.length;
    if (segments.length === 1 && !segments[0]!.run) continue;
    const parent = node.parentNode;
    if (!parent) continue;
    for (const seg of segments) {
      if (!seg.run) {
        parent.insertBefore(doc.createTextNode(seg.text), node);
        continue;
      }
      const span = doc.createElement('span');
      span.setAttribute('data-el-run', '');
      for (const [p, v] of hubRunDeclarations(seg.run)) span.style.setProperty(p, v);
      span.appendChild(doc.createTextNode(seg.text));
      parent.insertBefore(span, node);
    }
    parent.removeChild(node);
  }
}

/**
 * ✍ A SCENE'S RUNS, laid on its parts. A scene key addresses every part its
 * selector finds (every heading, every paragraph), but a key's runs were made
 * on ONE of them — `hubRunsTarget` picks it by its words (the same words, else
 * the words that kept the most of the old ones). Every other part of that key
 * is left plain. Returns how many parts carry runs now.
 */
export function applySceneRuns(scene: Element, elements: HubElementStyles | null | undefined, doc: RunsDoc): number {
  let n = 0;
  for (const key of HUB_SCENE_ELEMENT_KEYS) {
    const parts = Array.from(scene.querySelectorAll(HUB_SCENE_ELEMENT_SELECTOR[key]));
    for (const part of parts) if (part.querySelector('[data-el-run]')) unwrapRuns(part, doc);
    const style = elements?.[key];
    const i = hubRunsTarget(
      parts.map((p) => p.textContent ?? ''),
      style,
    );
    if (i < 0) continue;
    applyPartRuns(parts[i]!, style, doc);
    if (parts[i]!.querySelector('[data-el-run]')) n += 1;
  }
  return n;
}

/**
 * ✍ EVERY SCENE ON THE PAGE WITH RUNS — each scoped `<style data-hub-runs>`
 * (`HubCanvasFrame`) stands straight after its scene, so its scene is its
 * previous sibling. The attribute is sanitized again on the way in.
 */
export function applyAllSceneRuns(root: Pick<Document, 'querySelectorAll'>, doc: RunsDoc): number {
  let n = 0;
  root.querySelectorAll('style[data-hub-runs]').forEach((tag) => {
    const scene = tag.previousElementSibling;
    if (!scene) return;
    n += applySceneRuns(scene, readHubSceneRuns(tag.getAttribute('data-hub-runs')), doc);
  });
  return n;
}
