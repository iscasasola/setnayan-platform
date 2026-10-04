/**
 * 🎛 ONE MOTION VOCABULARY — FOUR EFFECTS THAT COMBINE (owner, 2026-10-04,
 * DECISION_LOG rows "THEME → SCENE → ELEMENT" … "THE MOTION SHEET RUNS IN THE
 * ORDER A GUEST SEES IT").
 *
 *   *"fade / none · move (different corners) / none · grow / shrink / none ·
 *   blur / none · SPEED : fast / regular / ease"*
 *
 * An element's (and a scene's) In — and its Out, the same way — is FOUR
 * independent effects, each with a None, and they combine freely:
 *
 *   Fade  Fade · None
 *   Move  one of 8 directions (4 edges + 4 corners) · None — picked on a 3×3
 *         grid of ARROWS showing the way it TRAVELS (owner: *"if from lowerleft
 *         to center that is an upper right arrow"*); the centre is None
 *   Size  Grow · Shrink · None
 *   Blur  Blur · None
 *
 * and Speed ▾ = Fast · Regular · Gentle (the shipped quick · normal · slow).
 *
 * 🔒 EVERY VALUE IS A CLOSED-SET KEY. What reaches CSS is built HERE from the
 * maps below — a direction becomes a px offset, a size a scale, blur one fixed
 * radius — never from text a couple (or a draft) carried in. Shared by
 * `lib/element-style.ts` (a part) and `lib/hub-canvas.ts` (a scene), so the two
 * layers cannot drift apart in what a word means.
 *
 * 📍 A DIRECTION NAMES THE FAR END OF THE MOVE — where the thing starts when it
 * comes in, where it ends when it goes out. One fact, one list, two sets of
 * words (the scene's `HUB_DIRECTIONS` rule, extended to the corners).
 */

export const MOTION_DIRS = [
  'top_left',
  'above',
  'top_right',
  'left',
  'right',
  'bottom_left',
  'below',
  'bottom_right',
] as const;
export type MotionDir = (typeof MOTION_DIRS)[number];

/** The 3×3 grid, row by row; `null` is the centre — None. */
export const MOTION_GRID: ReadonlyArray<MotionDir | null> = [
  'top_left',
  'above',
  'top_right',
  'left',
  null,
  'right',
  'bottom_left',
  'below',
  'bottom_right',
];

/** Where it is, in the words a guest would use. */
const PLACE: Record<MotionDir, string> = {
  top_left: 'upper-left',
  above: 'the top',
  top_right: 'upper-right',
  left: 'the left',
  right: 'the right',
  bottom_left: 'lower-left',
  below: 'the bottom',
  bottom_right: 'lower-right',
};
export function motionDirLabel(dir: MotionDir, end: 'in' | 'out'): string {
  return `${end === 'in' ? 'From' : 'To'} ${PLACE[dir]}`;
}
/** The arrow's accessible name — "Comes in from lower-left". */
export function motionDirName(dir: MotionDir, end: 'in' | 'out'): string {
  return `${end === 'in' ? 'Comes in from' : 'Goes out to'} ${PLACE[dir]}`;
}

/** Which way the unit vector of the far end points: x right, y down. */
const VEC: Record<MotionDir, readonly [number, number]> = {
  top_left: [-1, -1],
  above: [0, -1],
  top_right: [1, -1],
  left: [-1, 0],
  right: [1, 0],
  bottom_left: [-1, 1],
  below: [0, 1],
  bottom_right: [1, 1],
};

/**
 * 🏹 THE ARROW OF TRAVEL. Coming in from lower-left it travels up and right
 * (↗); going out to lower-left it travels down and left (↙).
 */
const ARROW_OF_VEC: Record<string, string> = {
  '-1,-1': '↖',
  '0,-1': '↑',
  '1,-1': '↗',
  '-1,0': '←',
  '1,0': '→',
  '-1,1': '↙',
  '0,1': '↓',
  '1,1': '↘',
};
export function motionArrow(dir: MotionDir, end: 'in' | 'out'): string {
  const [x, y] = VEC[dir];
  return end === 'in' ? ARROW_OF_VEC[`${-x},${-y}`]! : ARROW_OF_VEC[`${x},${y}`]!;
}

export const MOTION_SIZES = ['grow', 'shrink'] as const;
export type MotionSize = (typeof MOTION_SIZES)[number];
export const MOTION_SIZE_LABEL: Record<MotionSize | 'settle', string> = {
  grow: 'Grow',
  shrink: 'Shrink',
  settle: 'Settle back',
};

/**
 * ONE END OF A MOTION — the four effects, each absent = None.
 *
 * `size: 'settle'` is the shipped "Settle back" Out (fade to 96.5%). The four
 * cannot say it — Shrink is 85% — so a stored Settle back is CARRIED as its own
 * Size value, kept on an Out only, and offered in Size ▾ only while it is the
 * one chosen. Picking another size takes it off; nothing new can write it.
 */
export type MotionFx = {
  fade?: true;
  move?: MotionDir;
  size?: MotionSize | 'settle';
  blur?: true;
};

export const MOTION_SPEEDS = ['fast', 'regular', 'gentle'] as const;
export type MotionSpeed = (typeof MOTION_SPEEDS)[number];
export const MOTION_SPEED_LABEL: Record<MotionSpeed, string> = { fast: 'Fast', regular: 'Regular', gentle: 'Gentle' };

const inList = <T,>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

export function isMotionDir(v: unknown): v is MotionDir {
  return inList(MOTION_DIRS, v);
}

/** One end's effects, or null when none is on. Drops — never repairs — anything off the closed sets. */
export function sanitizeMotionFx(raw: unknown, opts: { settle?: boolean } = {}): MotionFx | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: MotionFx = {};
  if (src.fade === true) out.fade = true;
  if (isMotionDir(src.move)) out.move = src.move;
  if (inList(MOTION_SIZES, src.size) || (opts.settle && src.size === 'settle')) out.size = src.size as MotionFx['size'];
  if (src.blur === true) out.blur = true;
  return Object.keys(out).length > 0 ? out : null;
}

/** Is any effect on? */
export function motionFxOn(fx: MotionFx | null | undefined): fx is MotionFx {
  return Boolean(fx && (fx.fade || fx.move || fx.size || fx.blur));
}

/** The two effect sets are the same choice. */
export function sameMotionFx(a: MotionFx | null | undefined, b: MotionFx | null | undefined): boolean {
  return (
    Boolean(a?.fade) === Boolean(b?.fade) &&
    (a?.move ?? null) === (b?.move ?? null) &&
    (a?.size ?? null) === (b?.size ?? null) &&
    Boolean(a?.blur) === Boolean(b?.blur)
  );
}

/** One effect changed — the rest kept (the four never clear each other). Null = none left. */
export function withMotionFx(
  fx: MotionFx | null | undefined,
  part: keyof MotionFx,
  value: string | boolean | null,
): MotionFx | null {
  const next: Record<string, unknown> = { ...(fx ?? {}) };
  if (value === null || value === false || value === 'none') delete next[part];
  else next[part] = value;
  return sanitizeMotionFx(next, { settle: true });
}

/** The words a closed Fade · Move · Size · Blur reads as — "Fade + ↗ from lower-left + Grow". */
export function motionFxWords(fx: MotionFx | null | undefined, end: 'in' | 'out'): string {
  if (!motionFxOn(fx)) return 'None';
  const words: string[] = [];
  if (fx.fade) words.push('Fade');
  if (fx.move) words.push(`${motionArrow(fx.move, end)} ${motionDirLabel(fx.move, end).toLowerCase()}`);
  if (fx.size) words.push(MOTION_SIZE_LABEL[fx.size]);
  if (fx.blur) words.push('Blur');
  return words.join(' + ');
}

/* ── WHAT REACHES CSS ───────────────────────────────────────────────────── */

const SCALE: Record<MotionSize | 'settle', Record<'in' | 'out', number>> = {
  /* Grow: it GROWS — from smaller on the way in, to larger on the way out. */
  grow: { in: 0.85, out: 1.15 },
  shrink: { in: 1.15, out: 0.85 },
  settle: { in: 0.965, out: 0.965 },
};
/** One blur radius — the brief's 8px, a constant, never an input. */
export const MOTION_BLUR = 'blur(8px)';

/**
 * The far end of one motion as THREE closed-set values — the opacity, the
 * transform (translate by direction, then scale) and the filter — that ONE
 * keyframe reads (`el-in-mix` / `hub-in-mix` …, `globals.css`). `dist` is the
 * layer's own travel in px: [x, y] — a part travels 18px in and 22px out, a
 * scene 28px across and 26px up or down, the distances that shipped.
 */
export function motionFxFrame(
  fx: MotionFx,
  end: 'in' | 'out',
  dist: readonly [number, number],
): { opacity: string; transform: string; filter: string } {
  const [vx, vy] = fx.move ? VEC[fx.move] : [0, 0];
  const x = vx * dist[0];
  const y = vy * dist[1];
  const s = fx.size ? SCALE[fx.size][end] : 1;
  return {
    opacity: fx.fade ? '0' : '1',
    transform: `translate3d(${x}px, ${y}px, 0) scale(${s})`,
    filter: fx.blur ? MOTION_BLUR : 'none',
  };
}

/** The three custom properties one mix keyframe reads, under `prefix` (`--el-in` …). */
export function motionFxVars(
  fx: MotionFx,
  end: 'in' | 'out',
  prefix: '--el-in' | '--el-out' | '--hub-in' | '--hub-out',
  dist: readonly [number, number],
): Array<[string, string]> {
  const f = motionFxFrame(fx, end, dist);
  return [
    [`${prefix}-o`, f.opacity],
    [`${prefix}-t`, f.transform],
    [`${prefix}-f`, f.filter],
  ];
}
