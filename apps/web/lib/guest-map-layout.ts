/**
 * lib/guest-map-layout.ts — where every node of the Guests map sits (Maker PR 4f,
 * G22/G38). The prototype's layout, pure: every leaf (a guest) gets a row of
 * its own; a parent sits centred over its children; the root centred over the
 * top branches. Columns are tighter on a phone. Drawn by `guest-map-canvas.tsx`.
 */
import type { GuestRow } from '@/lib/guests';
import type { MapBranch } from '@/lib/guest-roster-view';

export type MapNode =
  | { kind: 'root'; label: string; depth: 0; y: number }
  | { kind: 'branch'; label: string; count: number; depth: number; y: number; top: boolean }
  | { kind: 'leaf'; guest: GuestRow; depth: number; y: number };

/** Place every node: leaves one row each, parents centred over their children. */
export function layoutMap(
  rootLabel: string,
  tree: readonly MapBranch[],
  phone: boolean,
): { nodes: MapNode[]; links: [number, number][]; width: number; height: number; colX: number[] } {
  const ROW = phone ? 40 : 44;
  const colX = phone ? [12, 150, 300, 470] : [24, 190, 400, 620];
  const nodes: MapNode[] = [];
  const links: [number, number][] = [];
  let row = 0;
  const leafAt = (g: GuestRow, depth: number) => {
    const i = nodes.push({ kind: 'leaf', guest: g, depth, y: row * ROW + 40 }) - 1;
    row++;
    return i;
  };
  const place = (b: MapBranch, depth: number): number => {
    const kidIdx = [...b.kids.map((k) => place(k, depth + 1)), ...b.guests.map((g) => leafAt(g, depth + 1))];
    const ys = kidIdx.map((i) => nodes[i]!.y);
    const y = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : row * ROW + 40;
    const count = b.guests.length + b.kids.reduce((n, k) => n + k.guests.length, 0);
    const idx = nodes.push({ kind: 'branch', label: b.label, count, depth, y, top: depth === 1 }) - 1;
    for (const k of kidIdx) links.push([idx, k]);
    return idx;
  };
  const top = tree.map((b) => place(b, 1));
  const ys = top.map((i) => nodes[i]!.y);
  const rootIdx =
    nodes.push({ kind: 'root', label: rootLabel, depth: 0, y: ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 40 }) - 1;
  for (const t of top) links.push([rootIdx, t]);
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  return {
    nodes,
    links,
    width: (colX[Math.min(maxDepth, colX.length - 1)] ?? 470) + (phone ? 200 : 260),
    height: Math.max(row, 1) * ROW + 80,
    colX,
  };
}

