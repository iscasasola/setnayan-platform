/**
 * SwitchTrack — the ONE drawing of a switch outside the Maker (`INTERACTION_RULES.md` § 9, kind 3; the approved
 * gallery `prototypes/control_templates_2026-10-08.html` § 3).
 *
 * Owner, 2026-10-08: *"switch is teracota or greyed out"* · *"we want the whole app to be adaptive to the same
 * feel"*. A page never draws its own track: it keeps its own `<button role="switch">` (or its real checkbox) — the
 * handler, the form field, `aria-checked`, the name, the disabled state — and puts THIS inside it.
 *
 * The look is `.sn-switch` in `app/globals.css` (grey off, the app's accent `--sn-accent` on, the knob landing with the press family's
 * spring at `--sn-pill-dur`); this file adds only the template's SIZE: a 50 × 30 track, a 24-px knob, 3 px in,
 * travelling 20 px. No colour is chosen here — the knob is white, everything else is the stylesheet's.
 *
 * Three ways a switch is built, one drawing:
 *   · a button      → `<button role="switch" aria-checked={on} className={SWITCH_BUTTON}><SwitchTrack on={on} /></button>`
 *                     (or the track at the end of a wider button that also holds the words);
 *   · a hidden box  → `<input type="checkbox" role="switch" className="peer sr-only" /><span aria-hidden className={SWITCH_TRACK} />`;
 *   · a real box    → `<input type="checkbox" role="switch" className="sn-switch" />` (the stylesheet draws it).
 *
 * No hook, no state, no listener: it renders on the server or the client alike, and costs no request.
 * Guard: `lib/every-switch-wears-the-one-look.test.ts`.
 */

/** The track and its knob. On = `data-on="true"` on it, or a checked `.peer` before it. */
export const SWITCH_TRACK =
  "sn-switch sn-press-ring relative block h-[30px] w-[50px] flex-none rounded-full after:absolute after:left-[3px] after:top-[3px] after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] data-[on=true]:after:translate-x-5 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-sn-accent/40 peer-disabled:opacity-40";

/**
 * A button that is nothing but the switch: a 44-px target around the 30-px track (the app's `min-height: 44px` on
 * every button would otherwise stretch a track drawn ON the button into an oval). Dimmed when it cannot be used.
 */
export const SWITCH_BUTTON = 'inline-flex min-h-11 flex-none items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50';

export function SwitchTrack({ on }: { on: boolean }) {
  return <span aria-hidden data-on={on} className={SWITCH_TRACK} />;
}
