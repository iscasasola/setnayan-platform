/**
 * ✂ A LAYER'S PARTS, IN THE BROWSER — shared by the player (which reveals each
 * part along the pen, `writeRevealPlan`) and the editor (which colours each
 * part and numbers the order the pen reaches them, `writePartPassages`), so
 * what the couple is shown is what guests get.
 *
 * A part is one traced shape: the tracer makes one path per gap-separated piece
 * of ink (`lib/monogram-studio/trace.ts`). A white card (`rect`) is not a part.
 */

/** The parts under `root`, in drawing order. */
export function logoParts(root: Element): SVGGeometryElement[] {
  return Array.from(root.querySelectorAll<SVGGeometryElement>('path, circle, ellipse, polygon')).filter(
    (el) => !el.hasAttribute('data-logo-pen'),
  );
}

/**
 * Is a point of the layer's own box (the space `root`'s children are drawn in)
 * on part `k`? Asked with a finger's tolerance — a ring of points `reach`
 * around it — because a traced line rarely sits exactly on thin ink.
 */
export function partCovers(
  root: SVGGraphicsElement,
  parts: SVGGeometryElement[],
  reach: number,
): (k: number, x: number, y: number) => boolean {
  const rootCtm = root.getCTM();
  // Each part's own coordinates ↔ the layer's box (a part may sit in a
  // translated group; the writing path is in the layer's box).
  const toPart = parts.map((part) => {
    const pc = part.getCTM();
    return rootCtm && pc ? pc.inverse().multiply(rootCtm) : new DOMMatrix();
  });
  const ring = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4) * reach, Math.sin((k * Math.PI) / 4) * reach])];
  return (k, x, y) => {
    const part = parts[k];
    const m = toPart[k];
    if (!part || !m || typeof part.isPointInFill !== 'function') return false;
    return ring.some(([dx = 0, dy = 0]) => {
      try {
        return part.isPointInFill(new DOMPoint(x + dx, y + dy).matrixTransform(m));
      } catch {
        return false;
      }
    });
  };
}

/** The matrix taking the layer's box into part `part`'s own space. */
export function boxToPart(root: SVGGraphicsElement, part: SVGGraphicsElement): DOMMatrix {
  const rootCtm = root.getCTM();
  const pc = part.getCTM();
  return rootCtm && pc ? pc.inverse().multiply(rootCtm) : new DOMMatrix();
}
