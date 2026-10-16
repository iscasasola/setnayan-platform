/**
 * ▶ ONE PART'S WHOLE LIFE ON THE CANVAS — Build in, then its Action, then Build out, then back to rest
 * (owner 2026-10-07, on the preview: *"i cannot see the build out and action"* — ▶ replayed the arrival only).
 *
 * Editor canvas only (the bridge calls it). It plays what the PAGE already holds, never a copy of the choices:
 *   · a scene's frame carries its keyframe NAMES (`--hub-in-kf` / `--hub-out-kf`, `hubCanvasVars`) and its
 *     Slow lift as `.hub-during-lift`, which moves the scene's PHOTO (no photo → nothing moves, and it says so);
 *   · a part's In / Drift / Out are its running CSS animations (`el-in-*`, `el-during-*`, `el-out-*`).
 * Each phase is set as ONE inline `animation` on the clock (the shorthand also puts any scroll timeline back to
 * the clock for the replay), and removed at the end, so the part rests exactly as the page draws it.
 * A phase that has nothing is skipped and NAMED — a blank never looks like a bug.
 *
 * ▶ ONE PHASE (owner 2026-10-09: *"preview button allow preview the animate on where they are"*): `only` plays just
 * Build in, just the Action or just Build out — the phase the toolbar's Animate is on.
 * 🎚 AT ITS OWN TEMPO: a Build in that plays ON ARRIVAL runs for the seconds the page itself would give it (a
 * scene's `--hub-duration`, a part's own duration) — that is the Movement the couple picked. An end that FOLLOWS THE
 * SCROLL has no seconds of its own: the same keyframes are played once on a clock, and the report says so.
 * ♿ REDUCE MOTION: nothing is played, and the report says that too (a guest who asked for stillness gets none).
 */
export type SeqPhase = 'in' | 'act' | 'out' | 'rest';
export type SeqReport = { phase: SeqPhase; skipped: string[] };

export const SEQ_MS = { in: 900, act: 2600, out: 900, hold: 450 } as const;

/**
 * One phase on the page. `node` + `animation` is what it plays; `more` is the rest of a scene that arrives ONE AFTER
 * ANOTHER — each part, and a list's rows one by one, each on its own delay — exactly as the guest page staggers them
 * (the 2026-10-15 walk, F7: ▶ played the scene as one block whatever Rows said).
 */
type Step = { phase: Exclude<SeqPhase, 'rest'>; node: HTMLElement; animation: string; ms: number; more?: Array<{ node: HTMLElement; animation: string }> };

const list = (v: string | undefined) => (v ?? '').split(',').map((n) => n.trim());
const kfOf = (node: HTMLElement, re: RegExp): string | null => {
  const hit = list(getComputedStyle(node).animationName).find((n) => re.test(n));
  return hit ? hit.replace(/-p$/, '') : null;
};
/** A part's slot for a keyframe: its own seconds, and whether a scroll (not the clock) drives it. */
function slotOf(node: HTMLElement, re: RegExp): { ms: number | null; scroll: boolean } {
  const cs = getComputedStyle(node) as CSSStyleDeclaration & { animationTimeline?: string };
  const i = list(cs.animationName).findIndex((n) => re.test(n));
  if (i < 0) return { ms: null, scroll: false };
  const tl = list(cs.animationTimeline)[i] ?? list(cs.animationTimeline)[0] ?? 'auto';
  const scroll = tl !== '' && tl !== 'auto' && tl !== 'none';
  const sec = parseFloat(list(cs.animationDuration)[i] ?? '');
  return { ms: !scroll && Number.isFinite(sec) && sec > 0 ? Math.round(sec * 1000) : null, scroll };
}
/** What the Maker is told when an end that follows the scroll is shown on a clock. */
export const SEQ_ON_A_CLOCK = { in: 'Build in follows the scroll — shown here on a clock', out: 'Build out follows the scroll — shown here on a clock' } as const;
export const SEQ_STILL = 'Reduce motion is on — nothing plays';

/** What a scene or a part will play, and what it has none of. */
export function sequenceOf(target: HTMLElement, isScene: boolean, only?: Exclude<SeqPhase, 'rest'>): { steps: Step[]; skipped: string[] } {
  const all = wholeSequenceOf(target, isScene);
  if (!only) return all;
  const word = { in: 'Build in', act: 'Action', out: 'Build out' }[only];
  return { steps: all.steps.filter((s) => s.phase === only), skipped: all.skipped.filter((line) => line.startsWith(word)) };
}

const SEQ_EASE = 'cubic-bezier(.16,1,.3,1)';
/** The guest page's cap on a stagger (`HUB_SEQUENCE_DEPTH`: eight parts / rows, then the eighth's delay). */
const STAGGER_CAP = 8;

/**
 * 🧾 A SCENE THAT ARRIVES ONE AFTER ANOTHER (`hub-seq-parts` — Rows: One by one, or a preset that does), played as
 * the guest page plays it ("ONE PART AFTER ANOTHER" · "THE ROWS OF A LIST", globals.css): each part on its own
 * delay (`--hub-stagger` × its place, the eighth's for the rest), and a list's own part standing still while its
 * rows arrive one by one, the first a stagger after the heading. A part with an In of its own plays its own. Null
 * for a scene that arrives whole (or a page too small to have parts) — then the frame plays as one block.
 */
function oneAfterAnother(frame: HTMLElement, kf: string, ms: number): Step | null {
  if (!frame.classList.contains('hub-seq-parts') || typeof frame.querySelectorAll !== 'function') return null;
  const parts = Array.from(frame.querySelectorAll<HTMLElement>(':scope > .hub-canvas-body > * > *'));
  if (parts.length === 0) return null;
  const gap = Math.round((parseFloat(getComputedStyle(frame).getPropertyValue('--hub-stagger')) || 0.12) * 1000);
  const items: Array<{ node: HTMLElement; animation: string; delay: number }> = [];
  const add = (node: HTMLElement, delay: number) => {
    const own = kfOf(node, /^el-in-/);
    items.push({ node, delay, animation: `${own ?? kf} ${ms}ms ${SEQ_EASE} ${delay}ms 1 normal both` });
  };
  parts.forEach((part, i) => {
    const list = part.matches('[data-hub-rows]') ? part : part.querySelector<HTMLElement>('[data-hub-rows]');
    if (list) Array.from(list.children as HTMLCollectionOf<HTMLElement>).forEach((row, j) => add(row, gap * Math.min(j + 1, STAGGER_CAP)));
    else add(part, gap * Math.min(i, STAGGER_CAP - 1));
  });
  const [first, ...rest] = items;
  if (!first) return null;
  return {
    phase: 'in',
    node: first.node,
    animation: first.animation,
    ms: ms + Math.max(...items.map((x) => x.delay)),
    more: rest.map(({ node, animation }) => ({ node, animation })),
  };
}

/**
 * 🛬 BACK TO REST, AT REST (the 2026-10-15 walk, F8). Taking the inline `animation` off gives the part its page
 * animations back — and the browser STARTS them again: ▶ on Action ended with the part dropping to opacity 0.02
 * and fading in again. Every arrival the page starts here (an `el-in-*` / `hub-in-*` on the clock) is finished at
 * once, so the part ends exactly where the page left it; a scroll-driven one is the scroll's and is left alone.
 */
export function settleAtRest(node: HTMLElement): void {
  node.style.removeProperty('animation');
  finishArrivals(node, false);
}

/** Every arrival the page has on the clock under `node` (itself, or its whole subtree), finished — never a scroll's. */
export function finishArrivals(node: HTMLElement, subtree: boolean): void {
  const doc = typeof document === 'undefined' ? null : document;
  for (const a of node.getAnimations?.({ subtree }) ?? []) {
    const name = (a as Animation & { animationName?: string }).animationName ?? '';
    if (!/^(hub|el)-in-/.test(name)) continue;
    if (doc && a.timeline && a.timeline !== doc.timeline) continue;
    try {
      a.finish();
    } catch {
      /* an animation the browser will not finish keeps its place */
    }
  }
}

function wholeSequenceOf(target: HTMLElement, isScene: boolean): { steps: Step[]; skipped: string[] } {
  const steps: Step[] = [];
  const skipped: string[] = [];
  const cs = getComputedStyle(target);
  const inKf = isScene ? cs.getPropertyValue('--hub-in-kf').trim() : kfOf(target, /^el-in-/);
  /* 🎚 The arrival's own seconds where it plays on the clock; a scroll-driven one is shown on a clock and says so. */
  const sceneScroll = isScene && target.classList.contains('hub-tl-scrub');
  const inSlot = isScene ? { ms: sceneScroll ? null : Math.round(parseFloat(cs.getPropertyValue('--hub-duration')) * 1000) || null, scroll: sceneScroll } : slotOf(target, /^el-in-/);
  const inMs = inSlot.ms ?? SEQ_MS.in;
  if (inKf && inKf !== 'none') {
    const staggered = isScene ? oneAfterAnother(target, inKf, inMs) : null;
    steps.push(staggered ?? { phase: 'in', node: target, animation: `${inKf} ${inMs}ms ${SEQ_EASE} 0s 1 normal both`, ms: inMs });
    if (inSlot.scroll) skipped.push(SEQ_ON_A_CLOCK.in);
  } else skipped.push('Build in: none');
  if (isScene) {
    const media = target.classList.contains('hub-during-lift') ? target.querySelector<HTMLElement>(':scope > .hub-canvas-media') : null;
    if (media) steps.push({ phase: 'act', node: media, animation: `hub-during-lift ${SEQ_MS.act / 2}ms ease-in-out 0s 2 alternate both`, ms: SEQ_MS.act });
    else skipped.push(target.classList.contains('hub-during-lift') ? 'Action: Slow lift moves the scene’s photo — this scene has none' : 'Action: none');
  } else {
    const act = kfOf(target, /^el-during-/);
    if (act) steps.push({ phase: 'act', node: target, animation: `${act} ${SEQ_MS.act / 4}ms ease-in-out 0s 4 alternate both`, ms: SEQ_MS.act });
    else skipped.push('Action: none');
  }
  const outKf = isScene ? cs.getPropertyValue('--hub-out-kf').trim() : kfOf(target, /^el-out-/);
  if (outKf && outKf !== 'none') {
    steps.push({ phase: 'out', node: target, animation: `${outKf} ${SEQ_MS.out}ms ease-in 0s 1 normal both`, ms: SEQ_MS.out });
    /* A Build out only ever follows the scroll (the page has no timed exit). */
    skipped.push(SEQ_ON_A_CLOCK.out);
  } else skipped.push('Build out: none');
  return { steps, skipped };
}

/** Play it. Returns a stop that puts every node back at rest at once. */
export function playSequence(target: HTMLElement, isScene: boolean, report: (r: SeqReport) => void, only?: Exclude<SeqPhase, 'rest'>): () => void {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    report({ phase: 'rest', skipped: [SEQ_STILL] });
    return () => {};
  }
  const { steps, skipped } = sequenceOf(target, isScene, only);
  const touched = new Set<HTMLElement>();
  let timer: number | null = null;
  const rest = () => {
    for (const n of touched) settleAtRest(n);
    touched.clear();
  };
  const stop = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    rest();
  };
  target.scrollIntoView({ behavior: 'auto', block: 'center' });
  let i = 0;
  const next = () => {
    const s = steps[i++];
    if (!s) {
      rest();
      report({ phase: 'rest', skipped });
      timer = null;
      return;
    }
    /* A name already inline does not restart — clear it, read layout once, then set it. */
    const all = [{ node: s.node, animation: s.animation }, ...(s.more ?? [])];
    for (const x of all) x.node.style.setProperty('animation', 'none');
    void s.node.offsetWidth;
    for (const x of all) {
      x.node.style.setProperty('animation', x.animation);
      touched.add(x.node);
    }
    report({ phase: s.phase, skipped });
    timer = window.setTimeout(() => {
      /* The Action is the part ON screen — it ends where it began before the part leaves (and, the last phase, at rest). */
      if (s.phase === 'act') settleAtRest(s.node);
      next();
    }, s.ms + (s.phase === 'out' ? SEQ_MS.hold : 0));
  };
  next();
  return stop;
}
