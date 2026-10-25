/**
 * react-children-keep.ts — 🧯 WHAT THE MAKER WROTE INTO REACT'S OWN NODES, PUT BACK BEFORE REACT LOOKS AGAIN.
 *
 * MEASURED 2026-10-15 on the production build of the Maker lab (`controller-2026-10-12/maker-speed/`): type a word in
 * the names, then pick any scene's Style card — the canvas page fell to "Something on our end didn't work"
 * (`NotFoundError: Failed to execute 'removeChild' on 'Node'`), and a `client-fault` was posted. On main too.
 *
 * WHY. Typing in place writes the words straight into the page (`setPartWords` / `layNames`: `textContent = …`, and
 * the second name and joiner taken off and put back), and a run's spans are cut and unwrapped (`part-runs.ts`). Each of
 * those REPLACES text nodes and elements that React created. The next in-place redraw (`router.refresh()` — every
 * Style pick, palette, box) is React reconciling the same elements: it removes or updates the nodes it remembers —
 * and they are no longer there. `removeChild` throws, and the page's error boundary takes over.
 *
 * NOW. Before the bridge's first write into an element (only on the Maker's canvas — `keepReactNodes(true)` is the
 * bridge's), that element's child list is noted ONCE. In the commit that brings the server's render
 * (`BeforeRedrawCommits` → `undoLaidPreviews`), every noted element gets React's own nodes back — a lone text node
 * carrying the words drawn now, so nothing flashes — and React then updates them to the server's words as it expects.
 */
let on = false;
const kept = new Map<Element, ChildNode[]>();

/** The bridge turns this on for the Maker's canvas (a guest's own page never mounts the bridge, and keeps nothing). */
export function keepReactNodes(enable: boolean): void {
  on = enable;
  if (!enable) kept.clear();
}

/** Note `el`'s children as React left them — before the first write into it. Later calls change nothing. */
export function keepReactChildren(el: Element | null | undefined): void {
  if (!on || !el || kept.has(el)) return;
  kept.set(el, Array.from(el.childNodes));
}

/** Every noted element gets React's nodes back (a lone text node keeps the words shown now). Then forgotten. */
export function putReactChildrenBack(): number {
  let put = 0;
  for (const [el, nodes] of kept) {
    const now = el.childNodes;
    const same = nodes.length === now.length && nodes.every((n, i) => now[i] === n);
    if (same) continue;
    if (nodes.length === 1 && nodes[0]!.nodeType === 3) nodes[0]!.nodeValue = el.textContent ?? '';
    el.replaceChildren(...nodes);
    put += 1;
  }
  kept.clear();
  return put;
}
