/**
 * the-press-feels-the-same-everywhere.test.ts — ONE PRESS FEEL, ONE SPEED, ONE SWITCH LOOK — AND THE GUEST'S EVENT
 * HUB LEFT ALONE.
 *
 * Owner, 2026-10-08 (the template gallery; `INTERACTION_RULES.md` § 9): *"the animation when tapped on selector must
 * feel the same on the rest when pressed"* · *"we want the whole app to be adaptive to the same feel"* · *"the only
 * part that does not follow our rules is their customized event hub"* · *"0.7 seconds"* · *"switch is teracota or
 * greyed out"*.
 *
 *   (1) THE PRESS — every button and every `.sn-press` card dips to .93 under the finger and springs back with an
 *       overshoot, at the family's one speed — played by ONE delegated listener (`app/_components/press-feel.tsx`),
 *       so it composes with any `transition-*` a control carries; the stylesheet's own scale is off there (the two
 *       never double); a second press mechanism is the bug this guards.
 *   (2) THE EXEMPTION — nothing inside the guest shell (`.sn-editorial`, the root `GuestLookScope` puts around every
 *       guest page) is touched: an EXCLUSION, never a list of surfaces.
 *   (3) THE RING — opt-in (`sn-press-ring`), drawn by the same listener as a transient element (no `::after`),
 *       transform and opacity only, never in the guest shell.
 *   (4) THE SPEED — `--sn-pill-dur` is declared once; the press, the pill and the switch all read it.
 *   (5) THE SWITCH — the Maker's four switches wear ONE look (`.sn-switch`): grey off, terracotta on, the knob
 *       landing with the spring. No green, no red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { STUDIO_SWITCH_TRACK } from './studio-skin';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const css = raw('app/globals.css');
const E = 'app/dashboard/[eventId]/website/editor/_components';
const L = 'app/dashboard/[eventId]/launch/_components';
/** The declarations of the rule whose selector list ENDS with `lastSelector`. */
const rule = (lastSelector: string): string => {
  const at = css.indexOf(`${lastSelector} {`);
  assert.ok(at > 0, `no rule ends with “${lastSelector}”`);
  return css.slice(at, css.indexOf('}', at));
};
const selectorsBefore = (lastSelector: string): string[] => {
  const at = css.indexOf(`${lastSelector} {`);
  const from = css.lastIndexOf('}', at);
  return stripComments(css.slice(from + 1, at + lastSelector.length))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

test('(1) ONE listener plays the press — the dip to .93 and the spring back — on every control the app owns; it composes with any transition', async () => {
  const { PRESS_TARGETS, pressMs } = await import('../app/_components/press-feel');
  // The same seven the stylesheet's universal press names.
  assert.deepEqual(PRESS_TARGETS.split(',').map((x) => x.trim()), ['button', "[role='button']", 'a.button', '.sn-press', "input[type='submit']", "input[type='button']", 'summary']);
  const src = read('app/_components/press-feel.tsx');
  // ONE delegated listener on the document — never one per element — and it is taken off again.
  assert.equal((src.match(/addEventListener\(/g) ?? []).length, 1, 'more than one listener');
  assert.match(src, /document\.addEventListener\('pointerdown', onDown, true\);\s*return \(\) => document\.removeEventListener\('pointerdown', onDown, true\);/);
  assert.doesNotMatch(src, /querySelectorAll\([^)]*\)\.forEach|\.addEventListener\('(?:click|pointerup|touchstart)/, 'a listener per element, or a second trigger');
  // The dip and the spring: Web Animations (it composes with a control's own `transition-colors` — nothing snaps).
  assert.match(src, /el\.animate\(\[\{ scale: 1 \}, \{ scale: 0\.93, offset: 0\.35 \}, \{ scale: 1 \}\], \{ duration: ms, easing: SPRING \}\);/);
  assert.match(src, /const SPRING = 'cubic-bezier\(\.34,1\.56,\.64,1\)';/);
  // At the family's ONE speed, read from the token — never a number of its own.
  assert.match(src, /const ms = pressMs\(getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--sn-pill-dur'\)\);/);
  assert.deepEqual([pressMs('700ms'), pressMs(' 700ms '), pressMs('0.7s'), pressMs('460ms'), pressMs(''), pressMs('none')], [700, 700, 700, 460, 700, 700]);
  // No timer, no dependency, no state: a few hundred bytes in the root layout.
  assert.doesNotMatch(src, /setTimeout|setInterval|requestAnimationFrame|useState|framer-motion/);
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['react']);
  // Mounted ONCE, in the root layout — and nowhere else.
  const layout = read('app/layout.tsx');
  assert.equal((layout.match(/<PressFeel \/>/g) ?? []).length, 1);
  // THE TWO NEVER DOUBLE: where the listener acts, the stylesheet's own press scale is taken off (the dimming stays).
  const off = rule('summary:active:not(.sn-editorial *)');
  assert.match(off, /\{\s*scale: none;\s*$/, 'the stylesheet still scales a press the listener already plays');
  assert.match(css, /summary:active \{\s*scale: 0\.96;\s*filter: brightness\(0\.97\);\s*\}/, 'the no-script dimming is gone');
  const SEVEN = ['button', "[role='button']", 'a.button', '.sn-press', "input[type='submit']", "input[type='button']", 'summary'];
  const bare = (x: string) => x.replace(/:not\(\.sn-editorial \*\)/g, '').replace(/:not\(:disabled\)|:not\(\[aria-disabled='true'\]\)|:active/g, '');
  assert.deepEqual(selectorsBefore('summary:active:not(.sn-editorial *)').map(bare), SEVEN, 'a control keeps the stylesheet’s scale AND gets the listener’s');
  // A SECOND PRESS MECHANISM is the bug this replaced: no CSS spring on :active, no `.93` in the stylesheet's press.
  assert.doesNotMatch(css, /:active[^{]*\{[^}]*scale: 0\.93/, 'a second press mechanism (a CSS dip beside the listener)');
  assert.doesNotMatch(css, /:not\(\.sn-editorial \*\) \{\s*transition: scale var\(--sn-pill-dur\)/, 'a second press mechanism (a CSS spring beside the listener)');
});

test('(2) the ONE exemption is the guest’s Event Hub; a disabled control and “reduce motion” get nothing', async () => {
  const { pressable } = await import('../app/_components/press-feel');
  const el = (inGuest: boolean, disabled: boolean) => ({ closest: (sel: string) => (sel === '.sn-editorial' && inGuest ? {} : null), matches: (sel: string) => sel.includes(':disabled') && disabled });
  assert.equal(pressable(el(false, false)), true);
  assert.equal(pressable(el(true, false)), false, 'a guest page’s button wears the app’s press');
  assert.equal(pressable(el(false, true)), false, 'a disabled control presses');
  const src = read('app/_components/press-feel.tsx');
  assert.match(src, /return !el\.closest\('\.sn-editorial'\) && !el\.matches\(':disabled, \[aria-disabled="true"\]'\);/);
  assert.match(src, /if \(still\.matches \|\| !\(e\.target instanceof Element\)\) return;/, 'the press plays under “reduce motion”');
  assert.match(src, /if \(!el \|\| !pressable\(el\) \|\| !el\.animate\) return;/);
  // An EXCLUSION, never a list of surfaces — a new screen gets the feel by default.
  assert.doesNotMatch(src, /app-surface|dashboard|admin|vendor/);
  for (const sel of selectorsBefore('summary:active:not(.sn-editorial *)')) assert.ok(sel.endsWith(':not(.sn-editorial *)'), `${sel}: the guest page loses its own press`);
  // What marks a guest page in the DOM: the shell's root, on EVERY guest page (worn or not).
  const scope = read('app/[slug]/_components/guest-look-scope.tsx');
  assert.match(scope, /className=\{worn \? `sn-editorial contents text-ink \$\{fontClassName\}`\.trim\(\) : 'sn-editorial contents'\}/, 'the guest shell no longer wears `sn-editorial` on every page — the exemption has nothing to key on');
  assert.match(read('app/[slug]/layout.tsx'), /<GuestLookScope \{\.\.\.lookScopeProps\(look\)\}>/);
  // The guest page keeps the shipped press, and never wears the app's control look.
  assert.match(css, /\.sn-press:active \{\s*scale: 0\.97;\s*\}/);
  for (const f of ['app/[slug]/_components/rsvp-widget.tsx', 'app/[slug]/_components/arrival-action.tsx', 'app/[slug]/_components/guest-look-scope.tsx']) {
    assert.doesNotMatch(read(f), /sn-switch|sn-press-ring|sn-pill-thumb/, `${f} (the guest’s Event Hub) wears the app’s control look`);
  }
});

test('(3) the ring is opt-in and drawn by the listener — a transient element over the control, transform and opacity only', () => {
  const src = read('app/_components/press-feel.tsx');
  // The pressed control itself, or the part of it that is marked (a card's picture, a switch's track, the ⓘ's dot).
  assert.match(src, /const ringed = el\.matches\('\.sn-press-ring'\) \? el : el\.querySelector<HTMLElement>\('\.sn-press-ring'\);\s*if \(!ringed\) return;/, 'every control grows a ring');
  // Laid over its box, in its own shape, in the terracotta; it never takes a tap; it removes itself.
  assert.match(src, /position:fixed;pointer-events:none;/);
  assert.match(src, /border:2px solid rgb\(var\(--sn-accent\) \/ \.45\);border-radius:\$\{getComputedStyle\(ringed\)\.borderRadius\}/);
  assert.match(src, /\.onfinish = \(\) => ring\.remove\(\);/, 'a ring is left in the page after it fades');
  assert.match(src, /ring\.animate\(\[\{ opacity: 1, transform: 'scale\(1\)' \}, \{ opacity: 0, transform: `scale\(\$\{1 \+ 20 \/ r\.width\}, \$\{1 \+ 20 \/ r\.height\}\)` \}\], \{ duration: ms \* 1\.3, easing: 'ease-out' \}\)/);
  assert.doesNotMatch(src, /boxShadow|box-shadow/, 'the ring animates paint');
  // No `::after` any more — so a control that already draws with ::after can wear it (the ⓘ's halo, a clipped card).
  assert.doesNotMatch(css, /\.sn-press-ring[^{]*::(?:after|before)/, 'the ring is drawn twice (CSS and the listener)');
  assert.doesNotMatch(css, /\.sn-switch::before/);
  // WORN BY the template controls: the dropdown's button, the ⓘ, a style card's picture, a switch's track.
  assert.match(read(`${E}/pick-menu-place.ts`), /return `sn-press sn-press-ring inline-flex /);
  assert.match(read('app/_components/info-tip.tsx'), /className="sn-press sn-press-ring sn-dot-btn /);
  assert.match(read(`${E}/background-cards.tsx`), /className=\{`sn-phone-card sn-press-ring \$\{/);
  assert.ok(STUDIO_SWITCH_TRACK.split(/\s+/).includes('sn-press-ring'));
});

test('(4) ONE speed for the family, declared once — 0.7 seconds', () => {
  assert.equal((css.match(/--sn-pill-dur:/g) ?? []).length, 1, 'the family’s speed is declared more than once');
  assert.match(css, /--sn-pill-dur:\s*700ms;/, 'the speed is not the owner’s 0.7 seconds');
  // The press, the pill thumb's pulse and the switch all read it — none carries a number of its own.
  for (const reader of [rule('.sn-pill-thumb[data-pulse]'), rule('.sn-switch'), rule('.sn-switch > .sn-switch-knob')]) {
    assert.match(reader, /var\(--sn-pill-dur\)/, 'a member of the family has its own speed');
  }
});

test('(5) the Maker’s four switches wear ONE look — grey off, terracotta on, the knob landing with the spring', () => {
  const track = rule('.sn-switch');
  assert.match(track, /background-color: rgb\(var\(--color-ink\) \/ 0\.2\);/, 'a switch that is off is not grey');
  const on = rule('.peer:checked ~ .sn-switch');
  assert.match(on, /background-color: rgb\(var\(--sn-accent\)\);/, 'a switch that is on is not the accent');
  assert.deepEqual(selectorsBefore('.peer:checked ~ .sn-switch'), [".sn-switch[data-on='true']", '.peer:checked ~ .sn-switch'], 'a switch can be on another way');
  const knob = rule('.sn-switch > .sn-switch-knob');
  assert.match(knob, /transition-duration: var\(--sn-pill-dur\);\s*transition-timing-function: var\(--sn-pill-spring\);/);
  // The four: each wears the class, none keeps a colour of its own (no green, no red, no second terracotta).
  const OWN = /bg-success-\d+|--sp-ok|bg-emerald|bg-green|bg-red|bg-danger|peer-checked:bg-|aria-checked:bg-/;
  assert.ok(STUDIO_SWITCH_TRACK.split(/\s+/).includes('sn-switch'), 'StudioSwitch');
  assert.doesNotMatch(STUDIO_SWITCH_TRACK, OWN, 'StudioSwitch keeps its own colour');
  assert.doesNotMatch(STUDIO_SWITCH_TRACK, /(?:^|\s)bg-ink\//, 'StudioSwitch keeps its own off colour');
  const panel = read(`${L}/stage-panel/kit.tsx`);
  const panelSwitch = panel.slice(panel.indexOf('export function PanelSwitch'), panel.indexOf('export function Swatch'));
  /* The Stages panel's switch is the app's ONE drawing since 2026-10-09 (`SwitchTrack`, 50 × 30 — which wears
     `.sn-switch` itself, `every-switch-wears-the-one-look` (3)); it draws no track or knob of its own. */
  assert.match(panelSwitch, /className=\{SP_SWITCH\}>\s*<SwitchTrack on=\{on\} \/>\s*<\/button>/, 'PanelSwitch');
  assert.doesNotMatch(panelSwitch, /sn-switch-knob|h-8 w-\[54px\]/, 'PanelSwitch still draws a track of its own');
  assert.doesNotMatch(panelSwitch, OWN, 'PanelSwitch keeps its own colour');
  const details = read(`${L}/maker-details.tsx`);
  const toggle = details.slice(details.indexOf('export function Toggle'), details.indexOf('{note ? <div className="text-xs text-ink/60">'));
  assert.match(toggle, /role="switch"[^>]*className="peer sr-only" \/>\s*<span\s+aria-hidden\s+className="sn-switch sn-press-ring relative h-6 w-11 /, 'Toggle');
  assert.doesNotMatch(toggle, OWN, 'Toggle keeps its own colour');
  const day = read('app/dashboard/[eventId]/schedule/_components/day-ui.tsx');
  const sw = day.slice(day.indexOf('export function Switch('), day.indexOf('export function', day.indexOf('export function Switch(') + 10));
  assert.match(sw, /data-on=\{on\}\s*className="sn-switch sn-press-ring relative h-6 w-10 flex-none rounded-full"/, 'Switch');
  assert.match(sw, /className=\{`sn-switch-knob absolute /);
  assert.doesNotMatch(sw, OWN, 'Switch keeps its own colour');
  // Each is still a switch a screen reader can read, and still its own size.
  for (const [name, src] of [['PanelSwitch', panelSwitch], ['Toggle', toggle], ['Switch', sw]] as const) assert.match(src, /role="switch"/, `${name} is no longer a switch`);
});
