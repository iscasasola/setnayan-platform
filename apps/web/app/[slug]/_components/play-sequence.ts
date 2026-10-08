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
 */
export type SeqPhase = 'in' | 'act' | 'out' | 'rest';
export type SeqReport = { phase: SeqPhase; skipped: string[] };

export const SEQ_MS = { in: 900, act: 2600, out: 900, hold: 450 } as const;

type Step = { phase: Exclude<SeqPhase, 'rest'>; node: HTMLElement; animation: string; ms: number };

const kfOf = (node: HTMLElement, re: RegExp): string | null => {
  const names = getComputedStyle(node)
    .animationName.split(',')
    .map((n) => n.trim());
  const hit = names.find((n) => re.test(n));
  return hit ? hit.replace(/-p$/, '') : null;
};

/** What a scene or a part will play, and what it has none of. */
export function sequenceOf(target: HTMLElement, isScene: boolean): { steps: Step[]; skipped: string[] } {
  const steps: Step[] = [];
  const skipped: string[] = [];
  const cs = getComputedStyle(target);
  const inKf = isScene ? cs.getPropertyValue('--hub-in-kf').trim() : kfOf(target, /^el-in-/);
  if (inKf && inKf !== 'none') steps.push({ phase: 'in', node: target, animation: `${inKf} ${SEQ_MS.in}ms cubic-bezier(.16,1,.3,1) 0s 1 normal both`, ms: SEQ_MS.in });
  else skipped.push('Build in: none');
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
  if (outKf && outKf !== 'none') steps.push({ phase: 'out', node: target, animation: `${outKf} ${SEQ_MS.out}ms ease-in 0s 1 normal both`, ms: SEQ_MS.out });
  else skipped.push('Build out: none');
  return { steps, skipped };
}

/** Play it. Returns a stop that puts every node back at rest at once. */
export function playSequence(target: HTMLElement, isScene: boolean, report: (r: SeqReport) => void): () => void {
  const { steps, skipped } = sequenceOf(target, isScene);
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
