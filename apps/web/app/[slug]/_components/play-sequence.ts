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

type Step = { phase: Exclude<SeqPhase, 'rest'>; node: HTMLElement; animation: string; ms: number };

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
    steps.push({ phase: 'in', node: target, animation: `${inKf} ${inMs}ms cubic-bezier(.16,1,.3,1) 0s 1 normal both`, ms: inMs });
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
    for (const n of touched) n.style.removeProperty('animation');
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
    s.node.style.setProperty('animation', 'none');
    void s.node.offsetWidth;
    s.node.style.setProperty('animation', s.animation);
    touched.add(s.node);
    report({ phase: s.phase, skipped });
    timer = window.setTimeout(() => {
      /* The Action is the part ON screen — it ends where it began before the part leaves. */
      if (s.phase === 'act') s.node.style.removeProperty('animation');
      next();
    }, s.ms + (s.phase === 'out' ? SEQ_MS.hold : 0));
  };
  next();
  return stop;
}
