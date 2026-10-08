/**
 * a-laid-scene-frame-is-undone-before-a-redraw.test.ts — A BACKGROUND PREVIEW NEVER LEAVES THE PAGE'S OWN NODES WHERE
 * REACT CANNOT FIND THEM.
 *
 * Measured on the Maker lab, 2026-10-08 (Message → Style › Background ▾ → Opaque): the guest sample fell to "Something
 * on our end didn't work · Try again · Take me home", its console saying `NotFoundError: Failed to execute
 * 'removeChild' on 'Node': The node to be removed is not a child of this node`.
 *
 * Why: the bridge lays a background by hand (`app/[slug]/_components/scene-bg-preview.ts`) — a scene with no frame
 * is WRAPPED, which moves a node the page's React tree drew — and the pick is then confirmed by a redraw IN PLACE
 * (`editor-bridge.tsx`, `router.refresh()`), where React removes that scene from the parent it remembers.
 *
 * Held, each EXECUTED over a small DOM whose `removeChild` throws exactly as a browser's does:
 *   (1) THE FAULT IS REAL — after a preview wraps a scene, the removal React would make throws;
 *   (2) UNDONE, IT DOES NOT — the scene is back in its parent, at its own place, and the frame is gone;
 *   (3) A PHOTO LAYER — one laid here is dropped; one the PAGE drew is only hidden (never removed) and shows again;
 *   (4) THE MOMENT — the bridge undoes in the commit where the redraw's transition ends, before React touches the
 *       DOM (`getSnapshotBeforeUpdate`), and at no other time: the preview does not blink off while the server answers.
 *   (5) THE WHOLE SEQUENCE — wrap → the bridge's own class at the redraw's end → the DOM changes React makes: no
 *       throw; and the same sequence WITHOUT the undo throws (today's behaviour).
 *
 * ⚠ What this cannot execute: React itself committing in a browser. (4) pins the lifecycle React documents as "right
 * before the DOM is changed"; the lab (`/dev/maker-lab?studio=1`, Message → Background ▾ → Opaque) is the real proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { SCENE_BG_HID_ATTR, SCENE_BG_LAID_ATTR, SCENE_BG_WRAP_ATTR, applySceneBgPreview, undoSceneBgPreviews } from '../app/[slug]/_components/scene-bg-preview';

/* ── a small DOM: what the two functions touch, with a browser's own refusal ── */
class El {
  className = '';
  children: El[] = [];
  parentNode: El | null = null;
  attrs: Record<string, string> = {};
  private props = new Map<string, string>();
  constructor(public tagName: string) {}
  classList = { contains: (c: string) => this.className.split(/\s+/).includes(c) };
  style = {
    length: 0,
    item: (i: number) => [...this.props.keys()][i]!,
    setProperty: (p: string, v: string) => void this.props.set(p, v),
    removeProperty: (p: string) => void this.props.delete(p),
  };
  get firstChild(): El | null {
    return this.children[0] ?? null;
  }
  setAttribute(n: string, v: string) {
    this.attrs[n] = v;
  }
  removeAttribute(n: string) {
    delete this.attrs[n];
  }
  hasAttribute(n: string) {
    return n in this.attrs;
  }
  appendChild(c: El) {
    return this.insertBefore(c, null);
  }
  insertBefore(c: El, ref: El | null) {
    if (ref && ref.parentNode !== this) throw new Error("NotFoundError: Failed to execute 'insertBefore' on 'Node'");
    if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1);
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c);
    else this.children.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  /** What React calls to delete a node it drew — and what a browser answers when the node was moved away. */
  removeChild(c: El) {
    if (c.parentNode !== this) throw new Error("NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.");
    this.children.splice(this.children.indexOf(c), 1);
    c.parentNode = null;
    return c;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  /** `[attr]` only — all `undoSceneBgPreviews` asks. */
  querySelectorAll(sel: string): El[] {
    const attr = /^\[([a-z-]+)\]$/.exec(sel)?.[1];
    assert.ok(attr, `the small DOM cannot answer “${sel}”`);
    const out: El[] = [];
    const walk = (n: El) => {
      for (const c of n.children) {
        if (c.hasAttribute(attr)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}
const doc = { createElement: (t: string) => new El(t.toUpperCase()) } as unknown as Pick<Document, 'createElement'>;
const asEl = (e: El) => e as unknown as HTMLElement;
const asDoc = (e: El) => e as unknown as Pick<Document, 'querySelectorAll'>;

/** A page: the cover, a bare scene, the scene after it — as the page's own render left them. */
function page() {
  const main = new El('MAIN');
  const before = new El('HEADER');
  const scene = new El('SECTION');
  const after = new El('SECTION');
  for (const n of [before, scene, after]) main.appendChild(n);
  return { main, before, scene, after };
}
const OPAQUE = { key: 'w:special_message', classes: ['hub-canvas', 'hub-bg-glass'], vars: { '--hub-bg': '#ffffff' } };
const PHOTO = { key: 'w:special_message', classes: ['hub-canvas', 'hub-has-media'], vars: { '--hub-media': 'url("https://example.test/a.jpg")' } };

test('(1) the fault: a wrapped scene is no longer where React left it — the removal a redraw makes THROWS', () => {
  const { main, scene } = page();
  const frame = applySceneBgPreview(asEl(scene), OPAQUE, doc) as unknown as El;
  assert.ok(frame && frame.hasAttribute(SCENE_BG_WRAP_ATTR), 'the frame this file wrapped is not marked');
  assert.notEqual(scene.parentNode, main, 'anti-vacuity: the preview did not wrap the scene');
  assert.throws(() => main.removeChild(scene), /not a child of this node/, 'anti-vacuity: this DOM lets a moved node be removed');
});

test('(2) undone, the page is as its own render left it: the scene in its parent, at its place, the frame gone — and the removal succeeds', () => {
  const { main, before, scene, after } = page();
  applySceneBgPreview(asEl(scene), OPAQUE, doc);
  assert.equal(undoSceneBgPreviews(asDoc(main)), 1);
  assert.deepEqual(main.children, [before, scene, after], 'the scene is not back at its own place');
  assert.equal(scene.parentNode, main);
  assert.equal(main.querySelectorAll(`[${SCENE_BG_WRAP_ATTR}]`).length, 0, 'the laid frame is still in the page');
  assert.doesNotThrow(() => main.removeChild(scene), 'React still cannot remove the scene');
  /* …and what React places next lands beside its real neighbours. */
  assert.doesNotThrow(() => main.insertBefore(new El('DIV'), after));
  /* Nothing laid: nothing to undo, nothing moved. */
  const clean = page();
  assert.equal(undoSceneBgPreviews(asDoc(clean.main)), 0);
  assert.deepEqual(clean.main.children, [clean.before, clean.scene, clean.after]);
  /* Two scenes wrapped ("Every scene"): both go back, in order. */
  const two = page();
  applySceneBgPreview(asEl(two.scene), OPAQUE, doc);
  applySceneBgPreview(asEl(two.after), OPAQUE, doc);
  assert.equal(undoSceneBgPreviews(asDoc(two.main)), 2);
  assert.deepEqual(two.main.children, [two.before, two.scene, two.after]);
});

test('(3) a photo layer: one laid here is dropped; one the PAGE drew is hidden — never removed — and shows again', () => {
  /* A frame the page drew, with its own photo layer. */
  const main = new El('MAIN');
  const frame = new El('DIV');
  frame.className = 'hub-canvas hub-has-media';
  const own = new El('DIV');
  own.className = 'hub-canvas-media';
  const body = new El('DIV');
  body.className = 'hub-canvas-body';
  main.appendChild(frame);
  frame.appendChild(own);
  frame.appendChild(body);
  /* The photo is taken off: the page's layer stays React's — hidden, still its parent's child. */
  applySceneBgPreview(asEl(frame), OPAQUE, doc);
  assert.equal(own.parentNode, frame, 'a node React drew was removed by hand');
  assert.ok(own.hasAttribute('hidden') && own.hasAttribute(SCENE_BG_HID_ATTR), 'the page’s photo layer still shows under a background with no photo');
  assert.doesNotThrow(() => frame.removeChild(own) && frame.insertBefore(own, body), 'React could not remove its own layer');
  /* A photo again: the same layer shows — never a second one beside it. */
  applySceneBgPreview(asEl(frame), PHOTO, doc);
  assert.ok(!own.hasAttribute('hidden') && !own.hasAttribute(SCENE_BG_HID_ATTR));
  assert.equal(frame.children.filter((c) => c.className === 'hub-canvas-media').length, 1, 'two photo layers');
  /* Off once more, then the redraw: it shows again and the server's render decides. */
  applySceneBgPreview(asEl(frame), OPAQUE, doc);
  assert.equal(undoSceneBgPreviews(asDoc(main)), 1);
  assert.ok(!own.hasAttribute('hidden') && !own.hasAttribute(SCENE_BG_HID_ATTR), 'a layer hidden for a preview stays hidden after the redraw');

  /* A layer LAID here (the page drew a frame with no photo): marked, and dropped by the undo. */
  const bare = new El('MAIN');
  const f2 = new El('DIV');
  f2.className = 'hub-canvas';
  const b2 = new El('DIV');
  b2.className = 'hub-canvas-body';
  bare.appendChild(f2);
  f2.appendChild(b2);
  applySceneBgPreview(asEl(f2), PHOTO, doc);
  const laid = f2.children.find((c) => c.className === 'hub-canvas-media');
  assert.ok(laid?.hasAttribute(SCENE_BG_LAID_ATTR), 'a photo layer laid here is not marked');
  assert.equal(undoSceneBgPreviews(asDoc(bare)), 1);
  assert.deepEqual(f2.children, [b2], 'a hand-laid photo layer outlives the redraw (the server’s own would sit beside it)');
  assert.equal(f2.parentNode, bare, 'a frame the PAGE drew was taken out');
});

/** What React does to the DOM when the redraw's render frames the scene itself: the bare scene goes, the framed one is placed before the next thing. */
function reactCommitsAFramedScene(main: El, scene: El, after: El) {
  main.removeChild(scene);
  const framed = new El('DIV');
  framed.className = 'hub-canvas hub-bg-glass';
  main.insertBefore(framed, after);
  return framed;
}

test('(5) THE WHOLE SEQUENCE — wrap, then the in-place redraw that frames the scene itself: no throw; photo off, then the redraw that drops the layer: no throw', async () => {
  const { BeforeRedrawCommits } = await import('../app/[slug]/_components/editor-bridge');
  /* The bridge's own class, handed the bridge's own undo over this page — exactly what `EditorBridge` mounts. */
  const redrawEnds = (root: El) => new BeforeRedrawCommits({ pending: false, run: () => void undoSceneBgPreviews(asDoc(root)) }).getSnapshotBeforeUpdate({ pending: true });

  /* A · a first background on a bare scene, confirmed by a redraw in place. */
  const a = page();
  applySceneBgPreview(asEl(a.scene), OPAQUE, doc);
  redrawEnds(a.main); // before React touches the DOM…
  let framed: El | null = null;
  assert.doesNotThrow(() => (framed = reactCommitsAFramedScene(a.main, a.scene, a.after)), 'the sample would fall to the error screen'); // …then React does.
  assert.deepEqual(a.main.children, [a.before, framed, a.after], 'a hand-laid frame is left beside the server’s own');
  /* WITHOUT the bridge's undo (today's behaviour): the same commit throws. */
  const b = page();
  applySceneBgPreview(asEl(b.scene), OPAQUE, doc);
  assert.throws(() => reactCommitsAFramedScene(b.main, b.scene, b.after), /removeChild/, 'anti-vacuity: the sequence does not reproduce the fault');

  /* B · a photo taken off a scene the page framed, then a redraw whose render has no photo layer. */
  const main = new El('MAIN');
  const frame = new El('DIV');
  frame.className = 'hub-canvas hub-has-media';
  const own = new El('DIV');
  own.className = 'hub-canvas-media';
  const body = new El('DIV');
  body.className = 'hub-canvas-body';
  main.appendChild(frame);
  frame.appendChild(own);
  frame.appendChild(body);
  applySceneBgPreview(asEl(frame), OPAQUE, doc);
  redrawEnds(main);
  assert.doesNotThrow(() => frame.removeChild(own), 'React could not drop the photo layer it drew');
  assert.deepEqual(frame.children, [body]);
});

test('(4) the bridge undoes in the commit where the redraw ends — before React touches the DOM — and at no other time', async () => {
  const { BeforeRedrawCommits } = await import('../app/[slug]/_components/editor-bridge');
  let ran = 0;
  const at = (pending: boolean) => new BeforeRedrawCommits({ pending, run: () => (ran += 1) });
  /* The redraw's transition ENDS in this commit: undo, once. */
  assert.equal(at(false).getSnapshotBeforeUpdate({ pending: true }), null);
  assert.equal(ran, 1, 'the laid frames are not undone when the server’s render is committed');
  /* It starts (the server has not answered): the preview stays on screen. */
  at(true).getSnapshotBeforeUpdate({ pending: false });
  /* Any other render of the bridge, during or outside a redraw: nothing. */
  at(true).getSnapshotBeforeUpdate({ pending: true });
  at(false).getSnapshotBeforeUpdate({ pending: false });
  assert.equal(ran, 1, 'the preview is taken off while the server is still answering, or on an unrelated render');
  assert.equal(at(false).render(), null, 'it draws something');

  const src = stripComments(readFileSync(join(__dirname, '..', 'app/[slug]/_components/editor-bridge.tsx'), 'utf8'));
  /* `pending` IS the transition the in-place redraw runs in… */
  assert.match(src, /const \[redrawing, startRedraw\] = useTransition\(\);/);
  assert.match(src, /startRedrawRef\.current\(\(\) => \{\s*routerRef\.current\.refresh\(\);\s*\}\);/);
  assert.match(src, /<BeforeRedrawCommits pending=\{redrawing\} run=\{undoLaidPreviews\} \/>/);
  assert.match(src, /const undoLaidPreviews = \(\) => \{\s*undoSceneBgPreviews\(document\);\s*\};/);
  /* …the hook is the one that runs BEFORE the DOM is changed (an effect runs after React has already thrown)… */
  const cls = src.slice(src.indexOf('export class BeforeRedrawCommits'), src.indexOf('const undoLaidPreviews'));
  assert.match(cls, /getSnapshotBeforeUpdate\(prev: \{ pending: boolean \}\) \{\s*if \(prev\.pending && !this\.props\.pending\) this\.props\.run\(\);\s*return null;\s*\}/);
  assert.doesNotMatch(cls, /componentDidUpdate\(\) \{[^}]*run\(/, 'the undo runs after the commit — React has already thrown by then');
  /* …and nothing undoes when the refresh is ASKED (the background would vanish for the whole server round trip). */
  const asked = src.slice(src.indexOf("data.t === 'refresh'"), src.indexOf("data.t === 'sceneBg'"));
  assert.ok(asked.length > 100, 'anti-vacuity: the refresh branch was not found');
  assert.doesNotMatch(asked, /undoSceneBgPreviews|undoLaidPreviews/, 'the preview is taken off before the server has answered');
  /* The file that lays never removes a node it did not lay. */
  const lay = stripComments(readFileSync(join(__dirname, '..', 'app/[slug]/_components/scene-bg-preview.ts'), 'utf8'));
  assert.match(lay, /if \(layer\.hasAttribute\(SCENE_BG_LAID_ATTR\)\) layer\.remove\(\);\s*else \{\s*layer\.setAttribute\(SCENE_BG_HID_ATTR, ''\);\s*layer\.setAttribute\('hidden', ''\);/);
});
