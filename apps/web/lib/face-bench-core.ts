// face-bench-core.ts — THE MEASURING BENCH for Papic face tagging. PURE: no model, no file system, no DB.
//
// ⚖ Owner 2026-11-05, DECISION_LOG "FACE MATCHING: MAKE IT FIND EVERY PHOTO OF A PERSON — APPROVED, IN SLICES,
// MEASURED FIRST", slice (1): *numbers before any threshold moves; the auto line does NOT change without measured
// Filipino-face data.* This file only COUNTS. It never decides a tag and it does not move 0.50 or 0.60
// (`lib/face-match-core.ts`) — it says what each line WOULD do on a labelled set of photos.
//
// 📁 THE LABELLED FOLDER. `<root>/<person>/<photo>.jpg`. A file whose name starts with `selfie` is that person's
// enrolment (up to N of them, matched by the CLOSEST — the same "closest wins" rule `planAutoTags` applies to one
// guest with several enrolments). Every other file is an event photo that the person IS IN. A group photo goes in
// every folder of everyone in it (copies are fine: photos are joined by content hash). A person who is not in a
// photo's folders is counted as NOT in that photo — so a missing copy shows up as a false auto-tag, never as a hit.
//
// 🧮 WHAT IS COUNTED is the unit the app writes: one (photo × enrolled person) pair, decided on the CLOSEST face in
// the photo — exactly `planAutoTags` (held by face-bench-core.test.ts, which runs both on the same numbers).

import { euclideanDistance, FACE_AUTO_MAX_DISTANCE, FACE_SUGGEST_MAX_DISTANCE } from '@/lib/face-match-core';

/**
 * The side, in px, the face DETECTOR resizes every photo to — SSD MobileNet v1 in `@vladmandic/face-api@1.7.15`,
 * `src/ssdMobilenetv1/SsdMobilenetv1.ts`: `input.toBatchTensor(512, false)` (the photo is padded square, then
 * scaled to 512 × 512). A face's height "as the detector sees it" is its height × 512 ÷ the photo's longest side.
 */
export const DETECTOR_INPUT_SIDE = 512;

/**
 * The longest side the server embedder decodes a photo to — mirrors `SERVER_EMBED_MAX_SIDE` in
 * `lib/face-embed-server.ts` (a `server-only` module a script cannot import; the test pins the two together).
 */
export const BENCH_SERVER_MAX_SIDE = 1024;

/** Files the bench reads as photos. */
export const BENCH_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export type BenchBox = { x: number; y: number; width: number; height: number };

/** One face the detector found in a photo. */
export type BenchFace = { vector: number[]; box: BenchBox; score: number };

/** One event photo after the model ran on it. `width`/`height` are the dims of the image the model was given. */
export type BenchPhoto = {
  key: string;
  /** Every path the photo was found under (for the report). */
  paths: string[];
  /** The people labelled as in this photo (the folders it sits in). */
  people: string[];
  width: number;
  height: number;
  faces: BenchFace[];
};

/** One enrolled person: the descriptors of their readable selfies (an unreadable selfie adds nothing). */
export type BenchEnrolment = { person: string; vectors: number[][] };

export type BenchFile = { relPath: string; hash: string };

export type BenchLayout = {
  /** person → their selfie paths, sorted. */
  selfies: Map<string, string[]>;
  /** One entry per distinct photo (by hash). */
  photos: Array<{ key: string; paths: string[]; people: string[] }>;
  /** Paths ignored, with why. */
  skipped: Array<{ relPath: string; why: string }>;
  /** A selfie whose bytes are also an event photo — a self-match the bench would count as a free hit. */
  selfieAlsoPhoto: string[];
};

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

/** Is this file a selfie (an enrolment), by its name? */
export function isSelfieName(fileName: string): boolean {
  return /^selfie/i.test(fileName);
}

/**
 * Read the labelled-folder layout from relative paths (forward slashes) + content hashes. Pure.
 * `maxSelfies` keeps only the first N selfies per person (sorted by name) — so one run can compare 1 frame vs 3.
 */
export function planBenchLayout(files: BenchFile[], opts: { maxSelfies?: number } = {}): BenchLayout {
  const maxSelfies = opts.maxSelfies ?? Infinity;
  const selfies = new Map<string, string[]>();
  const selfieHashes = new Map<string, string>();
  const byHash = new Map<string, { paths: string[]; people: Set<string> }>();
  const skipped: BenchLayout['skipped'] = [];

  for (const f of [...files].sort((a, b) => a.relPath.localeCompare(b.relPath))) {
    const parts = f.relPath.split('/').filter(Boolean);
    const name = parts[parts.length - 1] ?? '';
    if (parts.some((p) => p.startsWith('.'))) {
      skipped.push({ relPath: f.relPath, why: 'hidden' });
      continue;
    }
    if (!(BENCH_IMAGE_EXTENSIONS as readonly string[]).includes(extOf(name))) {
      skipped.push({ relPath: f.relPath, why: 'not a photo' });
      continue;
    }
    if (parts.length !== 2) {
      skipped.push({ relPath: f.relPath, why: 'not in <person>/<photo>' });
      continue;
    }
    const person = parts[0] as string;
    if (isSelfieName(name)) {
      const list = selfies.get(person) ?? [];
      if (list.length < maxSelfies) {
        list.push(f.relPath);
        selfies.set(person, list);
        selfieHashes.set(f.hash, f.relPath);
      } else {
        skipped.push({ relPath: f.relPath, why: `more than ${maxSelfies} selfie(s)` });
      }
      continue;
    }
    const entry = byHash.get(f.hash) ?? { paths: [], people: new Set<string>() };
    entry.paths.push(f.relPath);
    entry.people.add(person);
    byHash.set(f.hash, entry);
  }

  const selfieAlsoPhoto: string[] = [];
  const photos: BenchLayout['photos'] = [];
  for (const [hash, e] of byHash) {
    if (selfieHashes.has(hash)) {
      selfieAlsoPhoto.push(selfieHashes.get(hash) as string);
      for (const p of e.paths) skipped.push({ relPath: p, why: 'same bytes as a selfie' });
      continue;
    }
    photos.push({ key: hash, paths: e.paths, people: [...e.people].sort() });
  }
  photos.sort((a, b) => (a.paths[0] ?? '').localeCompare(b.paths[0] ?? ''));
  return { selfies, photos, skipped, selfieAlsoPhoto };
}

/** A face's height as the detector sees it (see {@link DETECTOR_INPUT_SIDE}). */
export function detectorFaceHeight(box: BenchBox, photoW: number, photoH: number): number {
  const side = Math.max(photoW, photoH);
  if (!(side > 0)) return 0;
  return (box.height * DETECTOR_INPUT_SIDE) / side;
}

/** One (photo × enrolled person) pair, decided on the closest face — the unit the app tags. */
export type BenchPair = {
  photoKey: string;
  person: string;
  /** The person is labelled as in this photo. */
  present: boolean;
  /** Closest distance over every face × every selfie of the person. Infinity when the photo has no face. */
  distance: number;
  /** The face that came closest (null when the photo has no face). */
  closestFace: { heightPx: number; detectorPx: number; score: number } | null;
};

/** Every pair for every photo × every enrolled person with at least one readable selfie. */
export function benchPairs(photos: BenchPhoto[], enrolments: BenchEnrolment[]): BenchPair[] {
  const pairs: BenchPair[] = [];
  const enrolled = enrolments.filter((e) => e.vectors.length > 0);
  for (const photo of photos) {
    const present = new Set(photo.people);
    for (const enr of enrolled) {
      let best = Infinity;
      let bestFace: BenchFace | null = null;
      for (const face of photo.faces) {
        for (const v of enr.vectors) {
          const d = euclideanDistance(face.vector, v);
          if (d < best) {
            best = d;
            bestFace = face;
          }
        }
      }
      pairs.push({
        photoKey: photo.key,
        person: enr.person,
        present: present.has(enr.person),
        distance: best,
        closestFace: bestFace
          ? {
              heightPx: bestFace.box.height,
              detectorPx: detectorFaceHeight(bestFace.box, photo.width, photo.height),
              score: bestFace.score,
            }
          : null,
      });
    }
  }
  return pairs;
}

export type PairOutcome = 'auto_true' | 'auto_false' | 'suggest_true' | 'suggest_false' | 'missed' | 'quiet';

/** What the app would do with one pair at these lines — the same bands as `planAutoTags`. */
export function pairOutcome(pair: Pick<BenchPair, 'present' | 'distance'>, autoLine: number, suggestLine: number): PairOutcome {
  if (pair.distance <= autoLine) return pair.present ? 'auto_true' : 'auto_false';
  if (pair.distance <= suggestLine) return pair.present ? 'suggest_true' : 'suggest_false';
  return pair.present ? 'missed' : 'quiet';
}

export type BenchRow = {
  autoLine: number;
  suggestLine: number;
  /** This row is the shipped pair of lines (0.50 / 0.60 today). */
  shipped: boolean;
  autoTrue: number;
  autoFalse: number;
  suggestTrue: number;
  suggestFalse: number;
  missed: number;
  /** Of the misses, how many were photos where no face was found at all. */
  missedNoFace: number;
  /** autoTrue ÷ (autoTrue + autoFalse); null when nothing was auto-tagged. */
  autoPrecision: number | null;
  /** autoTrue ÷ every present pair; null when nobody is labelled present. */
  autoRecall: number | null;
  /** (autoTrue + suggestTrue) ÷ every present pair — what a guest would see after confirming suggestions. */
  reachRecall: number | null;
};

const EPS = 1e-9;

/** Count every outcome at one pair of lines. */
export function benchRow(pairs: BenchPair[], autoLine: number, suggestLine: number): BenchRow {
  const row: BenchRow = {
    autoLine,
    suggestLine,
    shipped: Math.abs(autoLine - FACE_AUTO_MAX_DISTANCE) < EPS && Math.abs(suggestLine - FACE_SUGGEST_MAX_DISTANCE) < EPS,
    autoTrue: 0,
    autoFalse: 0,
    suggestTrue: 0,
    suggestFalse: 0,
    missed: 0,
    missedNoFace: 0,
    autoPrecision: null,
    autoRecall: null,
    reachRecall: null,
  };
  let present = 0;
  for (const p of pairs) {
    if (p.present) present += 1;
    switch (pairOutcome(p, autoLine, suggestLine)) {
      case 'auto_true': row.autoTrue += 1; break;
      case 'auto_false': row.autoFalse += 1; break;
      case 'suggest_true': row.suggestTrue += 1; break;
      case 'suggest_false': row.suggestFalse += 1; break;
      case 'missed':
        row.missed += 1;
        if (p.closestFace === null) row.missedNoFace += 1;
        break;
      case 'quiet': break;
    }
  }
  const autoAll = row.autoTrue + row.autoFalse;
  row.autoPrecision = autoAll > 0 ? row.autoTrue / autoAll : null;
  row.autoRecall = present > 0 ? row.autoTrue / present : null;
  row.reachRecall = present > 0 ? (row.autoTrue + row.suggestTrue) / present : null;
  return row;
}

/** The auto lines to try: `from` to `to` by `step`, always including the shipped line. Rounded to 3 places. */
export function sweepLines(from: number, to: number, step: number): number[] {
  const out = new Set<number>();
  if (step > 0 && to >= from) {
    for (let i = 0; ; i++) {
      const v = from + i * step;
      if (v > to + EPS) break;
      out.add(Math.round(v * 1000) / 1000);
    }
  }
  out.add(FACE_AUTO_MAX_DISTANCE);
  return [...out].sort((a, b) => a - b);
}

export type Histogram = Array<{ label: string; count: number }>;

/**
 * Count values into bins. `edges` are the inner edges, ascending: [a, b] → "< a", "a–b", "≥ b". REPORTING BINS
 * ONLY — they decide nothing; the bench prints whatever edges it is given.
 */
export function histogram(values: number[], edges: number[], unit = ''): Histogram {
  const sorted = [...edges].sort((a, b) => a - b);
  const bins: Histogram = [];
  if (sorted.length === 0) return [{ label: 'all', count: values.length }];
  bins.push({ label: `< ${sorted[0]}${unit}`, count: 0 });
  for (let i = 0; i + 1 < sorted.length; i++) bins.push({ label: `${sorted[i]}–${sorted[i + 1]}${unit}`, count: 0 });
  bins.push({ label: `≥ ${sorted[sorted.length - 1]}${unit}`, count: 0 });
  for (const v of values) {
    let idx = sorted.findIndex((e) => v < e);
    if (idx === -1) idx = sorted.length;
    (bins[idx] as { count: number }).count += 1;
  }
  return bins;
}

/** Reporting bins for a face's height in detector px (see {@link DETECTOR_INPUT_SIDE}). Display only. */
export const DEFAULT_SIZE_EDGES_PX = [16, 24, 32, 48, 64, 96];
/** Reporting bins for distances, 0.05 wide around the shipped lines. Display only. */
export const DEFAULT_DISTANCE_EDGES = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8];

export type BenchReport = {
  photos: number;
  facesFound: number;
  peopleEnrolled: number;
  /** People with selfies, none of which had a readable face. */
  selfiesUnread: string[];
  presentPairs: number;
  absentPairs: number;
  rows: BenchRow[];
  /** Closest distance of every pair where the person IS in the photo (finite only). */
  samePersonDistances: Histogram;
  /** Closest distance of every pair where the person is NOT in the photo (finite only). */
  otherPersonDistances: Histogram;
  /** At the shipped lines: the detector-px height of the face that matched, for each true auto-tag. */
  hitSizes: Histogram;
  /**
   * At the shipped lines: for each miss where faces were found, the detector-px height of the CLOSEST face. That face
   * may be somebody else — the person's own face may not have been found at all, which is the point of slice 3.
   */
  missSizes: Histogram;
  /** At the shipped lines: misses in photos where no face was found at all. */
  missesNoFace: number;
  /** Every face found, by detector-px height — the denominator for the two above. */
  allFaceSizes: Histogram;
};

export function benchReport(params: {
  photos: BenchPhoto[];
  enrolments: BenchEnrolment[];
  autoLines: number[];
  suggestLine?: number;
  sizeEdges?: number[];
  distanceEdges?: number[];
}): BenchReport {
  const suggestLine = params.suggestLine ?? FACE_SUGGEST_MAX_DISTANCE;
  const sizeEdges = params.sizeEdges ?? DEFAULT_SIZE_EDGES_PX;
  const distanceEdges = params.distanceEdges ?? DEFAULT_DISTANCE_EDGES;
  const pairs = benchPairs(params.photos, params.enrolments);

  const finite = (ps: BenchPair[]) => ps.map((p) => p.distance).filter((d) => Number.isFinite(d));
  const present = pairs.filter((p) => p.present);
  const absent = pairs.filter((p) => !p.present);

  const hits: number[] = [];
  const misses: number[] = [];
  let missesNoFace = 0;
  for (const p of present) {
    const o = pairOutcome(p, FACE_AUTO_MAX_DISTANCE, FACE_SUGGEST_MAX_DISTANCE);
    if (o === 'auto_true' && p.closestFace) hits.push(p.closestFace.detectorPx);
    if (o === 'missed') {
      if (p.closestFace) misses.push(p.closestFace.detectorPx);
      else missesNoFace += 1;
    }
  }

  const allFaces: number[] = [];
  for (const ph of params.photos) for (const f of ph.faces) allFaces.push(detectorFaceHeight(f.box, ph.width, ph.height));

  return {
    photos: params.photos.length,
    facesFound: allFaces.length,
    peopleEnrolled: params.enrolments.filter((e) => e.vectors.length > 0).length,
    selfiesUnread: params.enrolments.filter((e) => e.vectors.length === 0).map((e) => e.person).sort(),
    presentPairs: present.length,
    absentPairs: absent.length,
    rows: params.autoLines.map((a) => benchRow(pairs, a, Math.max(a, suggestLine))),
    samePersonDistances: histogram(finite(present), distanceEdges),
    otherPersonDistances: histogram(finite(absent), distanceEdges),
    hitSizes: histogram(hits, sizeEdges, 'px'),
    missSizes: histogram(misses, sizeEdges, 'px'),
    missesNoFace,
    allFaceSizes: histogram(allFaces, sizeEdges, 'px'),
  };
}

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function histLines(title: string, h: Histogram): string[] {
  const total = h.reduce((n, b) => n + b.count, 0);
  const lines = [`${title} (${total})`];
  for (const b of h) lines.push(`  ${pad(b.label, 14)} ${String(b.count).padStart(5)}`);
  return lines;
}

/** The plain-text report the script prints. */
export function formatBenchReport(r: BenchReport): string {
  const out: string[] = [];
  out.push('PAPIC FACE MEASURE — counts only; no line is changed by this run');
  out.push(`photos ${r.photos} · faces found ${r.facesFound} · people enrolled ${r.peopleEnrolled}`);
  out.push(`pairs: ${r.presentPairs} person-in-photo · ${r.absentPairs} person-not-in-photo`);
  if (r.selfiesUnread.length) out.push(`⚠ no face read in any selfie of: ${r.selfiesUnread.join(', ')} (not enrolled)`);
  out.push('');
  out.push('auto   suggest   auto✓   auto✗   sugg✓   sugg✗   missed (no face)   auto precision   auto recall   recall incl. suggestions');
  for (const row of r.rows) {
    out.push(
      [
        pad(row.autoLine.toFixed(3), 6),
        pad(row.suggestLine.toFixed(3), 9),
        pad(String(row.autoTrue), 7),
        pad(String(row.autoFalse), 7),
        pad(String(row.suggestTrue), 7),
        pad(String(row.suggestFalse), 7),
        pad(`${row.missed} (${row.missedNoFace})`, 18),
        pad(pct(row.autoPrecision), 16),
        pad(pct(row.autoRecall), 13),
        pct(row.reachRecall) + (row.shipped ? '   ◀ shipped' : ''),
      ].join(' '),
    );
  }
  out.push('');
  out.push(...histLines('closest distance, person IS in the photo', r.samePersonDistances));
  out.push(...histLines('closest distance, person is NOT in the photo', r.otherPersonDistances));
  out.push('');
  out.push(`face height as the detector sees it (px of its ${DETECTOR_INPUT_SIDE}-px input), at the shipped lines:`);
  out.push(...histLines('every face found', r.allFaceSizes));
  out.push(...histLines('auto-tagged (true)', r.hitSizes));
  out.push(...histLines('missed — closest face found (may be someone else)', r.missSizes));
  out.push(`missed — no face found in the photo at all: ${r.missesNoFace}`);
  return out.join('\n');
}
