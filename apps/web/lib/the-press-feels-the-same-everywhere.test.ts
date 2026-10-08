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
 *       overshoot, at the family's one speed; scale only; one rule.
 *   (2) THE EXEMPTION — nothing inside the guest shell (`.sn-editorial`, the root `GuestLookScope` puts around every
 *       guest page) is touched: an EXCLUSION, never a list of surfaces.
 *   (3) THE RING — opt-in (`sn-press-ring`), scale and opacity only, never in the guest shell.
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

test('(1) every button and every .sn-press card dips to .93 and springs back, at the family’s one speed — scale only', () => {
  // The press, under the finger: quick in.
  const down = rule('summary:active:not(.sn-editorial *)');
  assert.match(down, /scale: 0\.93;/);
  assert.match(down, /transition: scale 90ms var\(--sn-ease\),\s*filter 90ms ease;/);
  // The release: the spring, at the family's speed.
  const rest = rule('summary:not(.sn-editorial *)');
  assert.match(rest, /transition: scale var\(--sn-pill-dur\) var\(--sn-pill-spring\),\s*filter 0\.13s ease;/, 'the spring back is not at the family’s speed');
  assert.doesNotMatch(down + rest, /\b(?:width|height|top|left|margin|padding|box-shadow)\b/, 'the press lays out or repaints');
  // EVERY control the shipped press reaches is reached by this one — the same seven, in both states.
  const SEVEN = ['button', "[role='button']", 'a.button', '.sn-press', "input[type='submit']", "input[type='button']", 'summary'];
  const bare = (s: string) => s.replace(/:not\(\.sn-editorial \*\)/g, '').replace(/:not\(:disabled\)|:not\(\[aria-disabled='true'\]\)|:active/g, '');
  assert.deepEqual(selectorsBefore('summary:not(.sn-editorial *)').map(bare), SEVEN, 'a control lost the press');
  assert.deepEqual(selectorsBefore('summary:active:not(.sn-editorial *)').map(bare), SEVEN, 'a control lost the press');
  // …in the same layer as the shipped rule and AFTER it (it wins by order plus the `:not`).
  const shipped = css.indexOf('  .sn-press:active {\n    scale: 0.97;');
  const mine = css.indexOf('  button:not(.sn-editorial *),');
  const baseEnds = css.indexOf('\n}\n', shipped);
  assert.ok(shipped > 0 && mine > shipped && mine < baseEnds, 'the press is not in the base layer after the shipped rule');
  // A disabled control does not press.
  assert.ok(selectorsBefore('summary:active:not(.sn-editorial *)').includes('button:not(:disabled):active:not(.sn-editorial *)'));
  // No script, no class to remember: `:active` only.
  assert.doesNotMatch(css.slice(mine, mine + 1400), /@keyframes|animation:/);
});

test('(2) the ONE exemption is the guest’s Event Hub — an exclusion on the guest shell, never a list of surfaces', () => {
  // Every selector of the new press carries the exclusion; none names a surface to include.
  for (const last of ['summary:not(.sn-editorial *)', 'summary:active:not(.sn-editorial *)']) {
    for (const sel of selectorsBefore(last)) {
      assert.ok(sel.endsWith(':not(.sn-editorial *)'), `${sel} reaches into the guest’s Event Hub`);
      assert.doesNotMatch(sel, /app-surface|dashboard|admin|vendor/, `${sel} lists a surface — a new screen would miss the feel`);
    }
  }
  // What marks a guest page in the DOM: the shell's root, on EVERY guest page (worn or not).
  const scope = read('app/[slug]/_components/guest-look-scope.tsx');
  assert.match(scope, /className=\{worn \? `sn-editorial contents text-ink \$\{fontClassName\}`\.trim\(\) : 'sn-editorial contents'\}/, 'the guest shell no longer wears `sn-editorial` on every page — the exemption has nothing to key on');
  assert.match(read('app/[slug]/layout.tsx'), /<GuestLookScope \{\.\.\.lookScopeProps\(look\)\}>/, 'the guest layout no longer wraps every page in the shell');
  // The shipped press (what the guest page keeps) is untouched.
  assert.match(css, /summary:active \{\s*scale: 0\.96;\s*filter: brightness\(0\.97\);\s*\}/);
  assert.match(css, /\.sn-press:active \{\s*scale: 0\.97;\s*\}/);
  // The ring and the switch never reach it either.
  assert.match(css, /\.sn-press-ring:not\(\.sn-editorial \*\)::after,/);
  assert.match(css, /\.sn-press-ring:not\(\.sn-editorial \*\):active::after,/);
  const guestFiles = ['app/[slug]/_components/rsvp-widget.tsx', 'app/[slug]/_components/arrival-action.tsx', 'app/[slug]/_components/guest-look-scope.tsx'];
  for (const f of guestFiles) assert.doesNotMatch(read(f), /sn-switch|sn-press-ring|sn-pill-thumb/, `${f} (the guest’s Event Hub) wears the app’s control look`);
});

test('(3) the ring is opt-in — there under the finger, widening and fading on release; scale and opacity only', () => {
  const ring = rule('.sn-switch::before');
  for (const d of ['position: absolute;', 'inset: 0;', 'border-radius: inherit;', 'opacity: 0;', 'pointer-events: none;']) assert.ok(ring.includes(d), `the ring lost ${d}`);
  assert.match(ring, /border: 2px solid rgb\(var\(--color-mulberry\) \/ 0\.\d+\);/, 'the ring is not the terracotta');
  assert.match(ring, /transition: opacity calc\(var\(--sn-pill-dur\) \* 1\.3\) ease-out, scale calc\(var\(--sn-pill-dur\) \* 1\.3\) ease-out;/);
  const on = rule('button:active > .sn-switch::before');
  assert.match(on, /opacity: 1;\s*scale: 1;\s*transition: none;/, 'the ring is not there at once under the finger');
  // Not on every button: only where the class is worn — and it positions its element in the BASE layer (a utility wins).
  assert.doesNotMatch(css, /\n\s*button[^{]*::after[^{]*\{[^}]*border: 2px solid rgb\(var\(--color-mulberry\)/, 'every button grew a ring');
  const pos = css.indexOf('  .sn-press-ring:not(.sn-editorial *) {\n    position: relative;');
  assert.ok(pos > 0 && pos < css.indexOf('\n}\n', css.indexOf('  .sn-press:active {')), 'the ring’s `position` is not in the base layer');
  // Worn today by the dropdown's button.
  assert.match(read(`${E}/pick-menu-place.ts`), /return `sn-press sn-press-ring inline-flex /);
  // Never on a control that already draws with ::after (the ⓘ's halo) — it would lose one of the two.
  assert.match(css, /\.sn-dot-btn::after \{/);
  assert.doesNotMatch(read('app/_components/info-tip.tsx'), /sn-press-ring/, 'the ⓘ wears the ring over its own ::after halo');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-press-ring::after,\s*\.sn-switch,/);
});

test('(4) ONE speed for the family, declared once — 0.7 seconds', () => {
  assert.equal((css.match(/--sn-pill-dur:/g) ?? []).length, 1, 'the family’s speed is declared more than once');
  assert.match(css, /--sn-pill-dur:\s*700ms;/, 'the speed is not the owner’s 0.7 seconds');
  // The press, the pill thumb's pulse and the switch all read it — none carries a number of its own.
  for (const reader of [rule('summary:not(.sn-editorial *)'), rule('.sn-pill-thumb[data-pulse]'), rule('.sn-switch'), rule('.sn-switch > .sn-switch-knob'), rule('.sn-switch::before')]) {
    assert.match(reader, /var\(--sn-pill-dur\)/, 'a member of the family has its own speed');
  }
});

test('(5) the Maker’s four switches wear ONE look — grey off, terracotta on, the knob landing with the spring', () => {
  const track = rule('.sn-switch');
  assert.match(track, /background-color: rgb\(var\(--color-ink\) \/ 0\.2\);/, 'a switch that is off is not grey');
  const on = rule('.peer:checked ~ .sn-switch');
  assert.match(on, /background-color: rgb\(var\(--color-mulberry\)\);/, 'a switch that is on is not the terracotta');
  assert.deepEqual(selectorsBefore('.peer:checked ~ .sn-switch'), [".sn-switch[data-on='true']", '.peer:checked ~ .sn-switch'], 'a switch can be on another way');
  const knob = rule('.sn-switch > .sn-switch-knob');
  assert.match(knob, /transition-duration: var\(--sn-pill-dur\);\s*transition-timing-function: var\(--sn-pill-spring\);/);
  // The four: each wears the class, none keeps a colour of its own (no green, no red, no second terracotta).
  const OWN = /bg-success-\d+|--sp-ok|bg-emerald|bg-green|bg-red|bg-danger|peer-checked:bg-|aria-checked:bg-/;
  assert.ok(STUDIO_SWITCH_TRACK.split(/\s+/).includes('sn-switch'), 'StudioSwitch');
  assert.doesNotMatch(STUDIO_SWITCH_TRACK, OWN, 'StudioSwitch keeps its own colour');
  assert.doesNotMatch(STUDIO_SWITCH_TRACK, /(?:^|\s)bg-ink\//, 'StudioSwitch keeps its own off colour');
  const panel = read(`${L}/stage-panel/kit.tsx`);
  const panelSwitch = panel.slice(panel.indexOf('export function PanelSwitch'), panel.indexOf('export function Dir'));
  assert.match(panelSwitch, /<span aria-hidden data-on=\{on\} className="sn-switch relative h-8 w-\[54px\] rounded-full">/);
  assert.match(panelSwitch, /className=\{`sn-switch-knob absolute /);
  assert.doesNotMatch(panelSwitch, OWN, 'PanelSwitch keeps its own colour');
  const details = read(`${L}/maker-details.tsx`);
  const toggle = details.slice(details.indexOf('export function Toggle'), details.indexOf('{note ? <div className="text-xs text-ink/60">'));
  assert.match(toggle, /role="switch"[^>]*className="peer sr-only" \/>\s*<span\s+aria-hidden\s+className="sn-switch relative h-6 w-11 /, 'Toggle');
  assert.doesNotMatch(toggle, OWN, 'Toggle keeps its own colour');
  const day = read('app/dashboard/[eventId]/schedule/_components/day-ui.tsx');
  const sw = day.slice(day.indexOf('export function Switch('), day.indexOf('export function', day.indexOf('export function Switch(') + 10));
  assert.match(sw, /data-on=\{on\}\s*className="sn-switch relative h-6 w-10 flex-none rounded-full"/, 'Switch');
  assert.match(sw, /className=\{`sn-switch-knob absolute /);
  assert.doesNotMatch(sw, OWN, 'Switch keeps its own colour');
  // Each is still a switch a screen reader can read, and still its own size.
  for (const [name, src] of [['PanelSwitch', panelSwitch], ['Toggle', toggle], ['Switch', sw]] as const) assert.match(src, /role="switch"/, `${name} is no longer a switch`);
});
