/**
 * every-switch-wears-the-one-look.test.ts — A SWITCH IS DRAWN ONCE.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, kind 3; the approved gallery
 * `prototypes/control_templates_2026-10-08.html` § 3): *"switch is teracota or greyed out"* · *"we want the whole
 * app to be adaptive to the same feel"* · *"the only part that does not follow our rules is their customized event
 * hub"*.
 *
 *   (1) ONE NAME, NO COLLISION — `.sn-switch` was TWO rules in `globals.css`: the span track's (colours and the
 *       spring only) and, later in the file at the same weight, a real checkbox's (its own size, its own `::after`
 *       knob, a `transform`-only transition, green when on). The second landed on every span track: a forced
 *       44 × 26 box, a second knob that never moved, a knob that jumped. The checkbox's rule is now
 *       `input.sn-switch`, and NO bare `.sn-switch` rule may size a track or draw a knob.
 *   (2) THE CHECKBOX IS THE SAME SWITCH — terracotta when on (never the green, never a hex), the approved size, its
 *       knob taking the family's speed and spring from the track's rule.
 *   (3) THE DRAWING — `SwitchTrack` / `SWITCH_TRACK` (`app/_components/switch-track.tsx`): the approved 50 × 30
 *       track and 24-px knob, on both ways a switch is built, and no colour of its own.
 *   (4) THE WATCH — in the areas listed in `SWITCH_SWEPT`, every `role="switch"` wears that drawing and keeps no
 *       hand-made track. A later builder EXTENDS the list area by area; it is never a repo-wide rule. What a swept
 *       area may still hold by hand is named in `SWITCH_NOT_SWEPT`, each with why.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { SWITCH_BUTTON, SWITCH_TRACK } from '../app/_components/switch-track';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const css = read('app/globals.css');

/** Every rule of the stylesheet as `[selectors, declarations]`. */
const RULES: [string[], string][] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [(m[1] ?? '').split(',').map((s) => s.trim()), m[2] ?? '']);
const declarationsOf = (selector: string): string => {
  const hit = RULES.filter(([sels]) => sels.includes(selector));
  assert.equal(hit.length, 1, `“${selector}” is declared ${hit.length} times`);
  return hit[0]?.[1] ?? '';
};

test('(1) no bare `.sn-switch` rule sizes a track or draws a knob — the checkbox’s own drawing is scoped to the input', () => {
  /* A selector that reaches a span track: it names `.sn-switch` and is not narrowed to the input. */
  const reachesATrack = (sel: string) => /\.sn-switch(?![\w-])/.test(sel) && !/input\.sn-switch(?![\w-])/.test(sel);
  const reaching = RULES.filter(([sels]) => sels.some(reachesATrack));
  assert.ok(reaching.length >= 3, `anti-vacuity: only ${reaching.length} rules reach a track`);
  /* What such a rule MAY say: its colour, and how the colour and the knob move. Nothing that lays out or draws. */
  const MAY = /^(?:background-color|transition|transition-duration|transition-timing-function)$/;
  for (const [sels, body] of reaching) {
    for (const decl of body.split(';').map((d) => d.trim()).filter(Boolean)) {
      const prop = decl.slice(0, decl.indexOf(':')).trim();
      assert.match(prop, MAY, `“${sels.join(', ')}” sets ${prop} on every switch track — a track’s size and knob are its own (the 2026-10-08 collision)`);
    }
  }
  /* …and where a bare rule names `transition`, it never narrows it to one property for a knob that moves by `left`. */
  for (const [sels, body] of reaching) {
    if (sels.some((s) => /::after|sn-switch-knob/.test(s))) assert.doesNotMatch(body, /transition:\s*transform/, 'a knob that moves by `left` would jump');
  }
});

test('(2) a real checkbox is the same switch — terracotta on, the approved size, the family’s speed', () => {
  const box = declarationsOf('input.sn-switch');
  assert.match(box, /appearance: none;/);
  assert.match(box, /width: 3\.125rem;\s*height: 1\.875rem;/, 'not the approved 50 × 30');
  assert.doesNotMatch(box, /background/, 'the checkbox has its own “off” colour — the track’s grey is the one');
  /* ON is the SAME colour the track's own "on" names — one setting, so a change of accent moves both or neither. */
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  const trackOn = RULES.find(([sels]) => sels.includes('.peer:checked ~ .sn-switch'));
  assert.ok(trackOn, 'the track has no “on” rule');
  assert.match(flat(trackOn[1]), /^background-color: [^;]+;$/, 'the track’s “on” is more than its colour');
  assert.equal(flat(declarationsOf('input.sn-switch:checked')), flat(trackOn[1]), 'a checked box is not the colour a track is when on');
  assert.doesNotMatch(trackOn[1], /#[0-9a-f]{3,8}\b/i, 'the “on” colour is a hex — the accent is one setting');
  const knob = declarationsOf('input.sn-switch::after');
  assert.match(knob, /width: 1\.5rem;\s*height: 1\.5rem;/, 'not the 24-px knob');
  assert.match(knob, /transition-property: transform;/);
  assert.doesNotMatch(knob, /transition:|transition-duration|transition-timing-function/, 'the checkbox’s knob has a speed of its own');
  assert.match(declarationsOf('input.sn-switch:checked::after'), /transform: translateX\(1\.25rem\);/, 'the knob does not travel 20 px');
  /* The speed and the spring it takes are the track rule’s (same element, lower weight, not overridden above). */
  const family = RULES.find(([sels]) => sels.includes('.sn-switch::after'));
  assert.ok(family, 'no rule gives a switch’s knob the family’s speed');
  assert.match(family[1], /transition-duration: var\(--sn-pill-dur\);\s*transition-timing-function: var\(--sn-pill-spring\);/);
  /* Order: the track's colours come first, the input's "on" after — so `:checked` is never repainted grey. */
  assert.ok(css.indexOf('input.sn-switch:checked {') > css.indexOf('.sn-switch {'), 'the input’s “on” is declared before the track’s grey');
});

test('(3) the drawing is the approved template — 50 × 30, a 24-px knob travelling 20 px — and has no colour of its own', () => {
  const cls = SWITCH_TRACK.split(/\s+/);
  for (const need of ['sn-switch', 'sn-press-ring', 'h-[30px]', 'w-[50px]', 'rounded-full', 'after:h-6', 'after:w-6', 'after:left-[3px]', 'after:top-[3px]', "after:content-['']", 'after:transition-transform']) {
    assert.ok(cls.includes(need), `the track lost “${need}”`);
  }
  /* On, both ways a switch is built: `data-on` on the track, or a checked `.peer` before it — the same 20 px. */
  assert.ok(cls.includes('data-[on=true]:after:translate-x-5'), 'a button’s switch does not move');
  assert.ok(cls.includes('peer-checked:after:translate-x-5'), 'a hidden checkbox’s switch does not move');
  /* The track's two colours are the stylesheet's; the only colour here is the white knob and the focus ring. */
  const colours = cls.filter((c) => /(?:^|:)(?:bg|text|border|from|to|via)-/.test(c));
  assert.deepEqual(colours, ['after:bg-white'], 'the drawing chooses a colour — the accent is one setting, in the stylesheet');
  assert.doesNotMatch(SWITCH_TRACK, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'a colour is written by hand');
  /* `duration-[…]` emits nothing in this repo (tailwindcss-animate); the speed is the stylesheet's token. */
  assert.doesNotMatch(SWITCH_TRACK, /duration-/);
  /* The bare button around it is a 44-px target with no paint — or the app's 44-px floor makes the track an oval. */
  assert.ok(SWITCH_BUTTON.split(/\s+/).includes('min-h-11'));
  assert.doesNotMatch(SWITCH_BUTTON, /(?:^|\s)(?:bg|border|text)-|(?:^|\s)h-/, 'the button paints or sizes itself — the track is the drawing');
});

/* ── (4) THE WATCH ───────────────────────────────────────────────────────────────────────────────────────── */

/** The areas already moved onto the one drawing. EXTEND it as an area is swept — never make it the whole repo. */
const SWITCH_SWEPT: readonly string[] = [
  /* couple (2026-10-08) */
  'app/dashboard',
  'app/_components/push-toggle.tsx',
];
/**
 * Inside a swept area, what is NOT swept — a folder another builder owns, or one switch with a reason. A `has`
 * names ONE switch by words on it; without it the whole path is skipped. Converting one removes its line.
 */
const SWITCH_NOT_SWEPT: readonly { path: string; has?: string; why: string }[] = [
  { path: 'app/dashboard/[eventId]/launch/', why: 'the Maker — its four shared switches already wear `.sn-switch` (the-press-feels-the-same-everywhere); the rest are its own builders’ lane' },
  { path: 'app/dashboard/[eventId]/website/editor/', why: 'the Maker’s work area — its own builders’ lane' },
];

const walk = (rel: string): string[] => {
  const abs = join(WEB, rel);
  if (!statSync(abs).isDirectory()) return [rel];
  return readdirSync(abs).flatMap((name) => {
    const child = `${rel}/${name}`;
    if (statSync(join(WEB, child)).isDirectory()) return name === 'node_modules' ? [] : walk(child);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [child] : [];
  });
};

/** A track drawn by hand: a fill of the page's own that says on/off (a green, the gold, a second terracotta). */
const HAND_MADE = /bg-success-\d+|bg-emerald|bg-green|bg-terracotta|bg-mulberry|(?:peer-checked|checked|aria-checked):bg-|--m-orange/;
const WEARS = /<SwitchTrack\b|\bSWITCH_TRACK\b|(?:["'`\s])sn-switch(?:["'`\s])/;

/** Each `role="switch"` in a file, as the source of the whole control: the element, and for a box its track beside it. */
export function switchesIn(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/role=(?:"switch"|'switch'|\{'switch'\}|\{"switch"\})/g)) {
    const at = m.index;
    let open = src.lastIndexOf('<', at);
    while (open >= 0 && !/[A-Za-z]/.test(src[open + 1] ?? '')) open = src.lastIndexOf('<', open - 1);
    assert.ok(open >= 0, 'a role="switch" outside an element');
    const tag = /^<([A-Za-z][\w.]*)/.exec(src.slice(open))![1];
    if (tag === 'input') {
      /* A box: itself, then whatever follows it up to the end of its label (its track, when the box is hidden). */
      const end = src.indexOf('</label>', at);
      out.push(src.slice(open, end < 0 ? at + 600 : end));
    } else {
      const end = src.indexOf(`</${tag}>`, at);
      assert.ok(end > at, `<${tag} role="switch"> never closes`);
      out.push(src.slice(open, end));
    }
  }
  return out;
}

test('(4) in the swept areas every switch wears the one drawing — and none keeps a hand-made track', () => {
  const files = SWITCH_SWEPT.flatMap(walk).filter((f) => !SWITCH_NOT_SWEPT.some((n) => !n.has && f.startsWith(n.path)));
  assert.ok(files.length >= 300, `anti-vacuity: only ${files.length} files were read`);
  let seen = 0;
  const strays: string[] = [];
  const stillByHand = new Set<string>();
  for (const f of files) {
    for (const sw of switchesIn(read(f))) {
      const known = SWITCH_NOT_SWEPT.find((n) => n.has && n.path === f && sw.includes(n.has));
      if (known) {
        stillByHand.add(`${known.path}|${known.has}`);
        continue;
      }
      seen += 1;
      const name = /aria-label(?:ledby)?=(?:"[^"]*"|\{[^}]*\})/.exec(sw)?.[0] ?? sw.slice(0, 80).replace(/\s+/g, ' ');
      if (!WEARS.test(sw)) strays.push(`${f}: ${name} — does not wear the one switch`);
      else if (HAND_MADE.test(sw)) strays.push(`${f}: ${name} — still carries a hand-made track (${HAND_MADE.exec(sw)![0]})`);
    }
  }
  assert.deepEqual(strays, [], 'a switch is drawn by hand — put <SwitchTrack> (app/_components/switch-track.tsx) inside it');
  assert.ok(seen >= 12, `anti-vacuity: only ${seen} switches were found in the swept areas`);
  /* A named exception that is no longer there is removed from the list, not left to hide the next one. */
  for (const n of SWITCH_NOT_SWEPT.filter((x) => x.has)) assert.ok(stillByHand.has(`${n.path}|${n.has}`), `${n.path} no longer holds “${n.has}” — remove its line`);
});

test('(4b) the watch sees a hand-made switch, a bare one, and a box whose track is by hand', () => {
  const by = (s: string) => switchesIn(s).map((sw) => (!WEARS.test(sw) ? 'bare' : HAND_MADE.test(sw) ? 'hand' : 'ok'));
  assert.deepEqual(by('<button type="button" role="switch" aria-checked={on} className={SWITCH_BUTTON}><SwitchTrack on={on} /></button>'), ['ok']);
  assert.deepEqual(by('<label><input type="checkbox" role="switch" className="peer sr-only" /><span aria-hidden className={SWITCH_TRACK} /></label>'), ['ok']);
  assert.deepEqual(by('<label><input type="checkbox" role="switch" name="x" className="sn-switch" /></label>'), ['ok']);
  assert.deepEqual(by("<button role=\"switch\" className={`h-6 w-11 ${on ? 'bg-success-600' : 'bg-ink/15'}`}><span className=\"h-5 w-5\" /></button>"), ['bare']);
  assert.deepEqual(by("<button role=\"switch\" className={on ? 'bg-terracotta' : 'bg-ink/20'}><SwitchTrack on={on} /></button>"), ['hand']);
  assert.deepEqual(by('<label><input type="checkbox" role="switch" className="peer sr-only" /><span className="h-6 w-11 peer-checked:bg-terracotta-700" /></label>'), ['bare']);
  /* Two in one file are two, each judged by its own source. */
  assert.deepEqual(by('<button role="switch"><SwitchTrack on={a} /></button><button role="switch"><i /></button>'), ['ok', 'bare']);
});
