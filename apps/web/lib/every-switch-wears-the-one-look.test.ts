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
  for (const need of ['sn-switch', 'sn-press-ring', 'h-[30px]', 'w-[50px]', 'rounded-full', 'after:h-6', 'after:w-6', 'after:left-[3px]', 'after:top-[3px]', "after:content-['']"]) {
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
  /* …and NO transition utility on the knob: a variant utility (`after:transition-transform`) is emitted at the END
     of the compiled sheet and, at the same weight, outranks `.sn-switch::after` — the knob then moves in 150 ms with
     no spring (measured on the compiled sheet, 2026-10-08). With none, the family's speed and spring are the only
     transition the knob has. */
  assert.doesNotMatch(SWITCH_TRACK, /(?:^|\s)(?:[\w-]+:)*after:(?:transition|ease|duration|delay)/, 'a utility on the knob outranks the family’s speed — the knob would jump in 150 ms');
  /* The bare button around it is a 44-px target with no paint — or the app's 44-px floor makes the track an oval. */
  assert.ok(SWITCH_BUTTON.split(/\s+/).includes('min-h-11'));
  assert.doesNotMatch(SWITCH_BUTTON, /(?:^|\s)(?:bg|border|text)-|(?:^|\s)h-/, 'the button paints or sizes itself — the track is the drawing');
});

test('(3b) no switch relies on a utility for its knob’s speed — the family’s rule outweighs every utility a drawing carries', () => {
  /* THE RULE: the class doubled, so it weighs (0,2,1) — more than `after:transition-*`, which Tailwind emits at
     the END of the compiled sheet at (0,1,1). It says the family's speed and spring, and NEVER what moves: one
     drawing moves its knob by `left`, another by `transform`; naming one would stop the other. */
  const outranks = declarationsOf('.sn-switch.sn-switch::after');
  assert.deepEqual(
    outranks.split(';').map((d) => d.trim()).filter(Boolean),
    ['transition-duration: var(--sn-pill-dur)', 'transition-timing-function: var(--sn-pill-spring)'],
    'the outranking rule says more (or less) than the family’s speed and spring',
  );
  /* It says exactly what the family's own rule says — one speed, declared once (`--sn-pill-dur`). */
  const family = RULES.find(([sels]) => sels.includes('.sn-switch::after'));
  assert.ok(family && family[1].replace(/\s+/g, ' ').trim() === outranks.replace(/\s+/g, ' ').trim(), 'the two knob rules disagree');

  /* EVERY DRAWING: each class string in the app that wears `sn-switch`. A timing utility on its knob may carry
     `after:` and nothing else — one more variant (`peer-checked:after:duration-300` compiles to
     `.peer:checked ~ .x::after`, (0,3,1)) would outweigh the rule again, in one state only, where nobody looks. */
  const sources = ['app', 'lib'].flatMap(walkAll).filter((f) => readFileSync(join(WEB, f), 'utf8').includes('sn-switch'));
  const drawings: [string, string][] = [];
  for (const f of sources) {
    const src = read(f);
    for (const m of src.matchAll(/(?<=["'`\s])sn-switch(?=["'`\s])/g)) {
      /* The class string around it: back to the quote that opens it, on to the same quote that closes it. */
      let open = m.index;
      while (open > 0 && !/["'`\n]/.test(src[open - 1] ?? '')) open -= 1;
      const quote = src[open - 1] ?? '';
      const close = src.indexOf(quote, m.index);
      const cls = quote && quote !== '\n' && close > 0 ? src.slice(open, close) : '';
      if (/\bafter:/.test(cls)) drawings.push([f, cls]);
    }
  }
  assert.ok(drawings.length >= 3, `anti-vacuity: only ${drawings.length} drawings with an ::after knob were found`);
  assert.ok(drawings.some(([, c]) => c === SWITCH_TRACK), 'anti-vacuity: the one drawing was not among them');
  for (const [f, cls] of drawings) {
    for (const token of cls.split(/\s+/)) {
      const parts = token.split(':');
      const utility = parts[parts.length - 1] ?? '';
      if (!parts.includes('after') || !/^(?:transition|duration|ease|delay)(?:-|$)/.test(utility)) continue;
      assert.deepEqual(parts.slice(0, -1), ['after'], `${f}: “${token}” outweighs the family’s speed in one state — the knob would move at the utility’s speed there`);
      assert.match(utility, /^transition(?:-|$)/, `${f}: “${token}” gives the knob a speed of its own that the family’s rule silently overrides — remove it`);
    }
  }
});

/* ── (4) THE WATCH ───────────────────────────────────────────────────────────────────────────────────────── */

/** The areas already moved onto the one drawing. EXTEND it as an area is swept — never make it the whole repo. */
const SWITCH_SWEPT: readonly string[] = [
  /* couple (2026-10-08) */
  'app/dashboard',
  'app/_components/push-toggle.tsx',
  /* supplier (2026-10-08) */
  'app/vendor-dashboard',
  /* sign-up and public (2026-10-08) */
  'app/_components/home',
  'app/tour',
  'app/onboarding',
  'app/signup',
  'app/login',
  'app/features',
  'app/for-suppliers',
  /* admin (2026-10-08) */
  'app/admin',
];
/**
 * Inside a swept area, what is NOT swept — a folder another builder owns, or one switch with a reason. A `has`
 * names ONE switch by words on it; without it the whole path is skipped. Converting one removes its line.
 */
const SWITCH_NOT_SWEPT: readonly { path: string; has?: string; why: string }[] = [
  /* THE MAKER (`launch/`), FILE BY FILE since 2026-10-09 — the Stages panel is swept (`stage-panel/kit.tsx`'s
     `PanelSwitch` is `<SwitchTrack>`; every other file under `launch/` that is not named here is watched). Each line
     below is a file whose switches still wear `.sn-switch` at a size of their own, or are another builder's; converting
     one removes its line. */
  { path: 'app/dashboard/[eventId]/launch/_components/maker-details.tsx', why: 'the shipped Maker’s `Toggle` (a hidden box and its own 44 × 24 track) — wears `.sn-switch` (the-press-feels-the-same-everywhere (5)); not the Stages panel' },
  { path: 'app/dashboard/[eventId]/launch/_components/maker-logo.tsx', why: 'the Logo maker’s own switch — not the Stages panel' },
  { path: 'app/dashboard/[eventId]/launch/_components/plan-myself.tsx', why: 'the guided flow’s switch — not the Stages panel' },
  { path: 'app/dashboard/[eventId]/launch/_components/studio-tools.tsx', why: '`StudioSwitch` — Studio’s side (wears `.sn-switch`, `STUDIO_SWITCH_TRACK`); its builder’s lane' },
  { path: 'app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx', why: 'the RSVP stage’s body — G1’s lane (its own hand-made `Switch`)' },
  { path: 'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx', why: 'the Reveal’s own two switches — the Stages builder’s next commit; its per-stage switches are already `PanelSwitch`' },
  { path: 'app/dashboard/[eventId]/website/editor/', why: 'the Maker’s work area — its own builders’ lane' },
  {
    path: 'app/onboarding/_shared/services-step.tsx',
    has: 'aria-checked={selection.ai}',
    why: 'a TICK by the owner’s ruling (2026-08-11, "THE TICK" in the file): "Add … to my event — ₱…" adds a paid line to the order. It is drawn as a tick box and says role="switch"; it belongs to the Ticks kind (11), not here',
  },
  {
    path: 'app/onboarding/_shared/services-step.tsx',
    has: 'aria-checked={selection.hubPro}',
    why: 'the same tick, for Event Hub Pro (pinned by lib/onboarding/event-hub-pro-on-the-services-step.test.ts)',
  },
];

/** Every non-test source file under a folder (`.ts` and `.tsx`). */
const walkAll = (rel: string): string[] =>
  readdirSync(join(WEB, rel)).flatMap((name) => {
    const child = `${rel}/${name}`;
    if (statSync(join(WEB, child)).isDirectory()) return name === 'node_modules' ? [] : walkAll(child);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [child] : [];
  });

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

const SAYS_SWITCH = /role=(?:"switch"|'switch'|\{'switch'\}|\{"switch"\})/g;
/** Each `role="switch"` in a file, as the source of the whole control: the element, and for a box its track beside it. */
export function switchesIn(src: string, says: RegExp = SAYS_SWITCH): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(says)) {
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

/**
 * DRAWN AS A SWITCH, SAID AS A PRESSED BUTTON. Two admin controls draw the on/off track but say `aria-pressed`
 * (their name carries "on"/"off", or the whole row is the button). What a screen reader hears is theirs; what the
 * eye sees is the one drawing. Named, because nothing in the source says "this is a switch".
 */
const DRAWN_AS_A_SWITCH: readonly { file: string; says: RegExp; what: string }[] = [
  { file: 'app/admin/categories/_components/ui.tsx', says: /aria-pressed=\{on\}/g, what: 'a category’s on/off row (a submit button in its own form)' },
  { file: 'app/admin/reveal-studio/studio.tsx', says: /aria-pressed=\{checked\}/g, what: 'the Reveal studio’s Toggle row' },
];

test('(4c) a control drawn as a switch wears the one drawing too, whatever it says to a screen reader', () => {
  for (const { file, says, what } of DRAWN_AS_A_SWITCH) {
    const found = switchesIn(read(file), says);
    assert.ok(found.length >= 1, `${file} no longer holds ${what} — remove its line`);
    for (const sw of found) {
      assert.match(sw, WEARS, `${file}: ${what} draws its own track`);
      assert.doesNotMatch(sw, HAND_MADE, `${file}: ${what} keeps a fill of its own`);
      /* …and no knob pushed along by the page, nor an "on" colour written inline. */
      assert.doesNotMatch(sw, /translateX\(|translate-x-|background:\s*(?:on|checked)\b/, `${file}: ${what} still moves a knob or paints "on" by hand`);
    }
  }
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
