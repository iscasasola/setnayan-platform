/**
 * 🧯 WORDS TYPED IN PLACE NEVER TAKE THE CANVAS DOWN AT THE NEXT REDRAW (`react-children-keep.ts`).
 *
 * Measured 2026-10-15 on the production build of the Maker lab: type a letter in the names, close, pick a scene's Style
 * card → the canvas page fell to its error screen (`NotFoundError … removeChild`) — React reconciling the names it had
 * drawn, whose text nodes the typing had replaced. This drives the real writers (`setPartWords`, `layNames` through it,
 * `applyPartRuns`) on a stand-in DOM whose `removeChild` throws exactly as the browser's does, then runs what the
 * bridge runs in the commit that brings the server's render (`putReactChildrenBack`) and asks React's question: is
 * every node React made still where React left it?
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* ── a stand-in DOM with the browser's own rule: a node can only be removed from its parent ──────────────────────── */
class N {
  parentNode: N | null = null;
  childNodes: N[] = [];
  attrs = new Map<string, string>();
  style = { setProperty: () => {}, removeProperty: () => {} };
  constructor(public nodeType: number, public tagName = '', public data = '') {}
  get nodeValue(): string | null { return this.nodeType === 3 ? this.data : null; }
  set nodeValue(v: string | null) { if (this.nodeType === 3) this.data = v ?? ''; }
  get children(): N[] { return this.childNodes.filter((c) => c.nodeType === 1); }
  get parentElement(): N | null { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get textContent(): string { return this.nodeType === 3 ? this.data : this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v: string) { if (this.nodeType === 3) { this.data = v; return; } for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; if (v) this.appendChild(new N(3, '', v)); }
  appendChild(c: N) { c.parentNode?.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  removeChild(c: N) { const i = this.childNodes.indexOf(c); if (i < 0) throw new Error("NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."); this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  insertBefore(c: N, ref: N) { c.parentNode?.removeChild(c); const i = this.childNodes.indexOf(ref); c.parentNode = this; this.childNodes.splice(i, 0, c); return c; }
  replaceChild(c: N, old: N) { this.insertBefore(c, old); return this.removeChild(old); }
  replaceChildren(...cs: N[]) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; for (const c of cs) this.appendChild(c); }
  remove() { this.parentNode?.removeChild(this); }
  getAttribute(k: string) { return this.attrs.get(k) ?? null; }
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  hasAttribute(k: string) { return this.attrs.has(k); }
  removeAttribute(k: string) { this.attrs.delete(k); }
  private all(): N[] { return this.childNodes.flatMap((c) => (c.nodeType === 1 ? [c, ...c.all()] : [])); }
  querySelectorAll(sel: string) { const m = /^\[([a-z-]+)\]$/.exec(sel); return m ? this.all().filter((e) => e.hasAttribute(m[1]!)) : []; }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] ?? null; }
  normalize() {}
}
const el = (tag: string, ...kids: N[]) => { const e = new N(1, tag.toUpperCase()); for (const k of kids) e.appendChild(k); return e; };
const text = (t: string) => new N(3, '', t);
const doc = { createElement: (t: string) => el(t), createTextNode: (t: string) => text(t) };

/** What React does at the redraw: update the text node it made, then (a new layout) remove a child it made. */
function reactReconciles(parent: N, made: N[], words: string) {
  (made[0]!.childNodes[0] ?? made[0]!).nodeValue = words; // React keeps its own text node and sets its value…
  for (const m of made) assert.ok(m.parentNode, 'React finds every node it made attached');
  parent.removeChild(made[0]!); // …and a style change removes the node it made: this is what threw.
}

test('the names typed in place (the real `setPartWords` → `layNames`): React finds its own nodes at the redraw — no throw', async () => {
  const { keepReactNodes, putReactChildrenBack } = await import('./react-children-keep');
  const { setPartWords } = await import('./type-in-place-canvas');
  keepReactNodes(true);
  /* React drew the names: <h1 data-el="names"><span person=0>Maria</span><span joiner>&</span><span person=1>Jose</span></h1> */
  const t0 = text('Maria');
  const tj = text('&');
  const t1 = text('Jose');
  const p0 = el('span', t0);
  p0.setAttribute('data-el-person', '0');
  const joiner = el('span', tj);
  joiner.setAttribute('data-el', 'joiner');
  const p1 = el('span', t1);
  p1.setAttribute('data-el-person', '1');
  const names = el('h1', p0, joiner, p1);
  const section = el('section', names);
  /* the Maker types a letter into the names */
  setPartWords(names as never, 'Maria & JoseZ');
  assert.notEqual(p1.childNodes[0], t1, 'the typing replaced React’s text node (the cause)');
  assert.equal(p1.textContent, 'JoseZ');
  /* the redraw commits: the bridge first puts React's nodes back, keeping the words shown now */
  assert.ok(putReactChildrenBack() >= 1);
  assert.equal(p1.childNodes[0], t1, 'React’s own text node is back');
  assert.equal(p1.textContent, 'JoseZ', 'and it carries the words shown now — nothing flashes back');
  assert.doesNotThrow(() => reactReconciles(names, [p0], 'Maria'));
  assert.doesNotThrow(() => reactReconciles(section, [names], 'Maria & JoseZ'));
  keepReactNodes(false);
});

test('one name typed: the second name and the joiner taken off — React’s nodes come back where it left them', async () => {
  const { keepReactNodes, putReactChildrenBack } = await import('./react-children-keep');
  const { setPartWords } = await import('./type-in-place-canvas');
  keepReactNodes(true);
  const p0 = el('span', text('Maria'));
  p0.setAttribute('data-el-person', '0');
  const joiner = el('span', text('&'));
  joiner.setAttribute('data-el', 'joiner');
  const p1 = el('span', text('Jose'));
  p1.setAttribute('data-el-person', '1');
  const names = el('h1', p0, joiner, p1);
  setPartWords(names as never, 'Maria');
  assert.equal(p1.parentNode, null, 'the second name was taken off (the cause)');
  putReactChildrenBack();
  assert.deepEqual(names.childNodes, [p0, joiner, p1], 'every node React made is back, in its order');
  assert.doesNotThrow(() => names.removeChild(p1));
  keepReactNodes(false);
});

test('without the put-back, the same redraw throws exactly as the canvas did (the stand-in is honest)', () => {
  const reactText = text('Maria');
  const span = el('span', reactText);
  const h1 = el('h1', span);
  h1.textContent = 'MariaZ'; // React's span is gone from the h1
  assert.throws(() => h1.removeChild(span), /NotFoundError/);
});

test('runs cut and unwrapped by the real `applyPartRuns` are put back to React’s nodes', async () => {
  const { keepReactNodes, putReactChildrenBack } = await import('./react-children-keep');
  const { applyPartRuns } = await import('./part-runs');
  const { hubTextHash } = await import('@/lib/element-style');
  keepReactNodes(true);
  const reactText = text('Together with their families');
  const part = el('p', reactText);
  const section = el('section', part);
  applyPartRuns(part as never, { runs: [{ start: 0, end: 8, color: '#B5543A' }], of: hubTextHash('Together with their families') } as never, doc as never);
  assert.ok(part.childNodes.length > 1 && !part.childNodes.includes(reactText), 'the cutter replaced React’s node (the cause)');
  putReactChildrenBack();
  assert.equal(part.childNodes.length, 1);
  assert.equal(part.childNodes[0], reactText, 'the paragraph holds React’s own text node again');
  assert.doesNotThrow(() => reactReconciles(section, [part], 'Together with their families'));
  keepReactNodes(false);
});

test('a guest’s own page keeps nothing (only the Maker’s canvas turns it on)', async () => {
  const { keepReactNodes, keepReactChildren, putReactChildrenBack } = await import('./react-children-keep');
  keepReactNodes(false);
  const h1 = el('h1', text('A'));
  keepReactChildren(h1 as never);
  h1.textContent = 'B';
  assert.equal(putReactChildrenBack(), 0);
});

test('every writer into React’s nodes notes them first, and the redraw commit puts them back first', () => {
  const read = (f: string) => fs.readFileSync(path.join(__dirname, f), 'utf8');
  const typing = read('type-in-place-canvas.ts');
  assert.match(typing, /keepReactChildren\(target\);\s*target\.textContent = text;/, 'setPartWords writes without noting');
  assert.match(typing, /for \(const el of \[first, second, joiner, second\?\.parentElement, joiner\?\.parentElement, first\.parentElement\]\) keepReactChildren\(el\);/, 'layNames rewrites the names without noting');
  assert.match(typing, /keepReactChildren\(target\);\s*target\.setAttribute\('contenteditable'/, 'a typing session starts without noting');
  const runs = read('part-runs.ts');
  assert.equal((runs.match(/keepReactChildren\(/g) ?? []).length, 2, 'the runs cutter writes without noting');
  const bridge = read('editor-bridge.tsx');
  const commit = bridge.slice(bridge.indexOf('const undoLaidPreviews = () => {'), bridge.indexOf('const SHOW_ON_REDRAW_ATTR'));
  assert.ok(commit.indexOf('putReactChildrenBack();') > 0 && commit.indexOf('putReactChildrenBack();') < commit.indexOf('dispatchEvent(new Event(CANVAS_REDRAW_COMMITS_EVENT))'), 'the redraw commit does not put React’s nodes back');
  assert.match(bridge, /keepReactNodes\(true\);\s*cleanups\.push\(\(\) => keepReactNodes\(false\)\);/);
});
