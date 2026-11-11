/**
 * lib/maker-editor-rise.ts — ⤴ A SCENE'S EDITOR RISES FROM THE SCENE, AND ✕ FALLS BACK INTO IT (Build 6 Lane F, owner
 * 2026-11-10; prototype `prototypes/event_hub_stages_scenes_2026-11-10/`: *"Anything that opens rises full screen in
 * 0.7 s (--sn-pill-dur, cubic-bezier(.2,.8,.2,1)) … ✕ is the exact reverse"*).
 *
 * The motion is the house's ONE rise (`lib/rise-motion.ts` `riseFromRect`, 700 ms, reduced motion = a 120 ms fade).
 * What this adds is only WHERE it rises from: the stage's tap names the scene (`noteRiseFrom`) — its rect on the screen,
 * measured inside the canvas frame and offset by the frame — and the editor's layer (`[data-maker-details-layer]`)
 * plays from it. With no scene noted (an editor opened from the ⚙ or an old link) it rises from the foot of the screen.
 * Client-only; on the server every call is a no-op.
 */
import { riseFromRect, type RiseRect } from './rise-motion';

/** The layer the full-screen editor is drawn in (`maker-shell.tsx`). */
export const MAKER_EDITOR_LAYER = '[data-maker-details-layer]';

/** The scene the NEXT editor rises from (noted by the tap), and the one the editor on screen rose from (✕ goes back). */
let from: RiseRect | null = null;
let open: RiseRect | null = null;

/** The scene the next editor rises from (its rect on the screen), or null: the foot of the screen. */
export function noteRiseFrom(rect: RiseRect | null): void {
  from = rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

/** The scene an editor rises from, or the foot of the screen when none was noted. */
export function riseOrigin(screen: { width: number; height: number }, noted: RiseRect | null): RiseRect {
  return noted ?? { left: 0, top: screen.height - 1, width: screen.width, height: 1 };
}

function layer(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(MAKER_EDITOR_LAYER);
}

/** ⤴ Play the rise on the editor's layer, from the noted scene (spent here: an editor opened later from the ⚙ or a
 *  link rises from the foot of the screen). Waits one frame for the layer to be drawn. */
export function riseEditorIn(): void {
  if (typeof window === 'undefined') return;
  open = from;
  from = null;
  const origin = open;
  window.requestAnimationFrame(() => {
    const el = layer();
    if (el) riseFromRect(el, riseOrigin({ width: window.innerWidth, height: window.innerHeight }, origin));
  });
}

/** ⤵ The exact reverse, back into the same scene; resolves when it has played (at once where there is nothing to play). */
export async function riseEditorOut(): Promise<void> {
  if (typeof window === 'undefined') return;
  const el = layer();
  const anim = el ? riseFromRect(el, riseOrigin({ width: window.innerWidth, height: window.innerHeight }, open), { reverse: true }) : null;
  open = null;
  try {
    await anim?.finished;
  } catch {
    /* cancelled (the layer left first): nothing to wait for */
  }
}
