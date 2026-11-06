/**
 * 🧵 A SCRIPT-LESS FRAME NEVER FINISHES STREAMING — SO THE PARENT FINISHES IT.
 *
 * Measured on the Vercel preview, 2026-10-07: a style miniature (`sandbox="allow-same-origin"`,
 * no scripts) loaded a 200 in ~5 s and drew NOTHING. The guest route streams: its sections arrive
 * as `<div hidden id="S:n">` segments that React's inline `$RS("S:n","P:n")` / `$RC("B:n","S:n")`
 * scripts move into place — scripts a sandboxed frame never runs. The lab (dev, unstreamed) drew
 * fine, which is why it shipped. Every section stayed `hidden` and the init splash stayed on top.
 *
 * The parent (same origin) reads those same calls out of the frame's own script text and applies
 * them as DOM moves — no script ever runs inside the miniature. Idempotent.
 */
export function finishStreamedHtml(d: Document): void {
  const root = d.documentElement;
  if (!root || root.hasAttribute('data-sn-streamed')) return;
  const text = Array.from(d.scripts, (s) => s.textContent ?? '').join('\n');
  for (const m of text.matchAll(/\$R([SC])\("([^"]+)","([^"]+)"\)/g)) {
    const [, kind, a, b] = m;
    if (kind === 'S') {
      /* $RS(segment, placeholder): the segment's nodes replace the placeholder. */
      const seg = d.getElementById(a!);
      const ph = d.getElementById(b!);
      if (!seg || !ph || !ph.parentNode) continue;
      while (seg.firstChild) ph.parentNode.insertBefore(seg.firstChild, ph);
      ph.remove();
      seg.remove();
    } else {
      /* $RC(boundary, segment): the fallback after the boundary's template goes; the segment takes its place. */
      const tpl = d.getElementById(a!);
      const seg = d.getElementById(b!);
      const parent = tpl?.parentNode;
      if (!tpl || !seg || !parent) continue;
      let n = tpl.nextSibling;
      let depth = 0;
      while (n) {
        if (n.nodeType === 8) {
          const t = (n as Comment).data;
          if (t === '/$') {
            if (depth === 0) break;
            depth -= 1;
          } else if (t.startsWith('$')) depth += 1;
        }
        const next = n.nextSibling;
        parent.removeChild(n);
        n = next;
      }
      while (seg.firstChild) parent.insertBefore(seg.firstChild, n);
      tpl.remove();
      seg.remove();
    }
  }
  d.getElementById('sn-init-splash')?.remove();
  root.setAttribute('data-sn-streamed', '');
}
