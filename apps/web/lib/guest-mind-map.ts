/**
 * 🧠 GUESTS › MAP IS A MIND MAP (R4 slice 10; owner, Guests prototype v12–v18 `mapHubs` / `ringsFor` / `facePos` /
 * `fitMap`): the couple in the centre, the groups the ⇅ Group by makes as HUBS on one ring around them — at most six; the
 * smallest beyond five fold into "Other groups · N", which opens into its own map — each hub's people as 36-px faces on
 * rings around it, ten at most ("+N more" opens that hub alone), one hub alone shows everyone. It shows exactly what the
 * List shows (the same `mapTree` of the same filtered list).
 *
 * PURE layout: positions in a world centred on the couple (0, 0); the canvas (`guest-map-canvas.tsx`) draws, fits,
 * pinches and scrolls it. 🔒 lib/the-map-is-a-mind-map.test.ts
 */
import type { GuestRow } from '@/lib/guests';
import type { MapBranch } from '@/lib/guest-roster-view';

export const FACE_R = 18;
export const FACE_GAP = 42;
export const HUB_R = 24;
export const COUPLE_R = 34;
export const MAX_HUBS = 6;
export const MAX_FACES = 10;

/** Into "Other" (the folded hubs) or into one hub (its "+N more"). */
export type MindDrill = { kind: 'other'; keys: readonly string[] } | { kind: 'hub'; key: string };

export type MindHub = {
  key: string;
  label: string;
  /** Everyone in the hub (a side's own groups folded in). */
  guests: GuestRow[];
  /** The faces drawn. */
  shown: GuestRow[];
  /** Faces not drawn — the "+N more" chip opens the hub alone. */
  more: number;
  /** The folded hubs' keys, on "Other". */
  keys?: string[];
  isOther?: true;
  /** Ring radii around the hub, and how far the hub reaches (its last ring + a face). */
  rings: number[];
  ext: number;
  x: number;
  y: number;
};

function everyone(b: MapBranch): GuestRow[] {
  return [...b.guests, ...b.kids.flatMap(everyone)];
}

/** The rings a hub needs for `n` faces (each ring holds as many as fit at `FACE_GAP`, never fewer than six). */
export function ringsFor(n: number): number[] {
  const rings: number[] = [];
  let left = n;
  let R = FACE_R + 46;
  while (left > 0) {
    const cap = Math.max(6, Math.floor((2 * Math.PI * R) / FACE_GAP));
    rings.push(R);
    left -= cap;
    R += FACE_GAP;
  }
  return rings;
}

/** Where face `i` of a hub sits — ring by ring, every other ring turned half a step. */
export function facePos(hub: Pick<MindHub, 'x' | 'y' | 'shown'>, i: number): { x: number; y: number } {
  let R = FACE_R + 46;
  let start = 0;
  const n = hub.shown.length;
  for (let r = 0; ; r++) {
    const cap = Math.max(6, Math.floor((2 * Math.PI * R) / FACE_GAP));
    const inRing = Math.min(cap, n - start);
    if (i < start + inRing) {
      const j = i - start;
      const a = (j / inRing) * Math.PI * 2 - Math.PI / 2 + (r % 2 ? Math.PI / inRing : 0);
      return { x: hub.x + Math.cos(a) * R, y: hub.y + Math.sin(a) * R };
    }
    start += inRing;
    R += FACE_GAP;
  }
}

export function mindMapHubs(tree: readonly MapBranch[], drill: MindDrill | null = null): MindHub[] {
  let tops = tree.map((b) => ({ key: b.key, label: b.label, guests: everyone(b) })).filter((h) => h.guests.length > 0);
  if (drill?.kind === 'other') tops = tops.filter((h) => drill.keys.includes(h.key));
  if (drill?.kind === 'hub') tops = tops.filter((h) => h.key === drill.key);
  tops.sort((a, b) => b.guests.length - a.guests.length || a.label.localeCompare(b.label, 'en', { numeric: true }));
  let hubs: Array<Omit<MindHub, 'shown' | 'more' | 'rings' | 'ext' | 'x' | 'y'>> = tops;
  if (hubs.length > MAX_HUBS) {
    const rest = hubs.slice(MAX_HUBS - 1);
    hubs = [
      ...hubs.slice(0, MAX_HUBS - 1),
      { key: 'other', label: `Other groups · ${rest.length}`, guests: rest.flatMap((h) => h.guests), keys: rest.map((h) => h.key), isOther: true },
    ];
  }
  const single = hubs.length === 1;
  const laid = hubs.map((h) => {
    const shown = single && !h.isOther ? h.guests : h.guests.slice(0, MAX_FACES);
    const rings = ringsFor(shown.length);
    return { ...h, shown, more: h.guests.length - shown.length, rings, ext: rings.length ? rings[rings.length - 1]! + FACE_R + 4 : 40, x: 0, y: 0 };
  });
  const n = laid.length;
  // The ring: the prototype's (room for every hub around it), and never so tight that a hub's faces reach the couple or
  // two neighbours touch (a chord between them at least both reaches apart).
  const maxExt = laid.reduce((m, h) => Math.max(m, h.ext), 0);
  const ringR = single
    ? 0
    : Math.max(
        150,
        laid.reduce((a, h) => a + h.ext * 2 + 30, 0) / (2 * Math.PI) + 40,
        maxExt + COUPLE_R + 60, // the label and "+N more" under a hub stay clear of the couple
        n > 1 ? (2 * maxExt + 40) / (2 * Math.sin(Math.PI / n)) : 0,
      );
  laid.forEach((h, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    h.x = single ? 0 : Math.cos(a) * ringR;
    h.y = single ? 0 : Math.sin(a) * ringR;
  });
  return laid;
}

/** The world's box — every hub with its faces and its label, the couple in the middle. */
export function mindMapBounds(hubs: readonly MindHub[]): { minX: number; minY: number; width: number; height: number } {
  let minX = -COUPLE_R - 26;
  let minY = -COUPLE_R - 26;
  let maxX = COUPLE_R + 26;
  let maxY = COUPLE_R + 26;
  for (const h of hubs) {
    minX = Math.min(minX, h.x - h.ext - 20);
    maxX = Math.max(maxX, h.x + h.ext + 20);
    minY = Math.min(minY, h.y - h.ext - 14);
    maxY = Math.max(maxY, h.y + h.ext + 52);
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** Two letters for a face: first and last name, never a title. */
export function faceInitials(g: Pick<GuestRow, 'first_name' | 'last_name'>): string {
  const a = (g.first_name ?? '').trim()[0] ?? '';
  const b = (g.last_name ?? '').trim()[0] ?? '';
  return `${a}${b}`.toUpperCase() || '·';
}
