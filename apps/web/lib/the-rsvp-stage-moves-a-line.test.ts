/**
 * ✋ THE RSVP STAGE MOVES A LINE BY HOLDING IT — step 6 of the per-element work (owner 2026-10-09: *"can we drag and
 * drop the element. similar to the concept of wedding march"*; approved prototype
 * `prototypes/maker_rsvp_add_drag_group_2026-10-09.html` § 2).
 *
 *   1. WHERE A HELD LINE LANDS — the opening nearest the finger, within reach, measured on the page as it stood at the
 *      lift; its own two openings settle it back where it was (nothing is asked);
 *   2. A DROP IS ONE EDIT OF THE LIST, AND IT CAN NEVER LOSE A REPLY — every drop there is, on every screen, with
 *      added lines and groups: the list is the one expected, every line of the page's own is in it exactly once
 *      (Yes and No with them), a group moves as one, and a line of a group never leaves it by a drop;
 *   3. THE MARCH'S FEEL, NOT A COPY OF ITS NUMBERS — its two constants are imported; the one difference (the hold) is
 *      this drag's own constant; the bare numbers are named;
 *   4. THE DRAG WRITES NOTHING AND ADDS NOTHING AMONG THE LINES — it asks the panel for one `place`; the ghost is a
 *      picture (inert, nameless), drawn on the page's body;
 *   5. WHAT A PRESS PICKS UP — the prototype's rule; words being typed are never lifted;
 *   6. COLOUR TOKENS ONLY (owner 2026-10-11) — no white, black or hex in what the drag draws;
 *   7. the frame steps aside while a line is held; the Maker's first load and a guest's page learn nothing of it.
 *
 * SEEN IN A BROWSER (the lab, 375 × 812 and 375 × 667, real touches — the commit's contact sheet): a short tap only
 * picks · a hold lifts · the opening shows · a drop moves the line, on the page and in what is stored · a plain
 * swipe scrolls · a group moves as one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { RSVP_LOOK_CARDS, RSVP_SCREEN_LINES, readRsvpLook, rsvpLayoutIsGroup, rsvpScreenLayout, rsvpScreenOrder, type RsvpLookCard } from './rsvp-look';
import { rsvpDropBefore, rsvpDropSlot, rsvpGroupName, rsvpLayoutEdit } from './rsvp-layout-edit';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));

/** A screen's top row as names (a group by its name) and each group's lines — what stands beside what. */
function rowsOf(config: unknown, part: RsvpLookCard): { top: string[]; groups: Record<string, string[]> } {
  const list = rsvpScreenLayout(readRsvpLook(config), part) ?? RSVP_SCREEN_LINES[part].map((line) => ({ line, added: null }));
  const groups: Record<string, string[]> = {};
  const top = list.map((item) => {
    if (!rsvpLayoutIsGroup(item)) return item.line;
    const name = rsvpGroupName(item.group.id);
    groups[name] = item.lines.map((l) => l.line);
    return name;
  });
  return { top, groups };
}
const edited = (config: unknown, edit: Parameters<typeof rsvpLayoutEdit>[1]): Record<string, unknown> => {
  const res = rsvpLayoutEdit(config, edit);
  assert.ok(res.ok, `the fixture's own edit was refused: ${JSON.stringify(edit)}`);
  return { look: res.look };
};

test('1 · where a held line lands: the nearest opening within reach — and its own two settle it back', () => {
  /* Four rows of 40 px, 10 px apart: tops 0 · 50 · 100 · 150, ends 40 · 90 · 140 · 190. */
  const tops = [0, 50, 100, 150];
  const ends = [40, 90, 140, 190];
  /* The second row held (at 1): the openings before it (1) and after it (2) are its own. */
  assert.equal(rsvpDropSlot(tops, ends, 1, 52, 120), null, 'its own opening above asked for a move');
  assert.equal(rsvpDropSlot(tops, ends, 1, 98, 120), null, 'its own opening below asked for a move');
  assert.equal(rsvpDropSlot(tops, ends, 1, 4, 120), 0, 'above the first row');
  assert.equal(rsvpDropSlot(tops, ends, 1, 148, 120), 3, 'before the last row');
  assert.equal(rsvpDropSlot(tops, ends, 1, 400, 120), null, 'too far from any opening still landed');
  assert.equal(rsvpDropSlot(tops, ends, 1, 300, 120), 4, 'after the last row, within reach');
  /* Every row, every finger height: the answer is an opening that exists and is never one of its own two. */
  for (let at = 0; at < tops.length; at++) {
    for (let y = -150; y <= 350; y += 3) {
      const slot = rsvpDropSlot(tops, ends, at, y, 120);
      if (slot === null) continue;
      assert.ok(slot >= 0 && slot <= tops.length && slot !== at && slot !== at + 1, `at ${at}, y ${y}: opening ${slot}`);
    }
  }
  /* The opening as the list's word for a place. */
  assert.equal(rsvpDropBefore(['a', 'b', 'c'], null), undefined, 'no opening is "nothing asked"');
  assert.equal(rsvpDropBefore(['a', 'b', 'c'], 0), 'a');
  assert.equal(rsvpDropBefore(['a', 'b', 'c'], 2), 'c');
  assert.equal(rsvpDropBefore(['a', 'b', 'c'], 3), null, 'after the last is "last"');
  /* 🧪 SABOTAGE: a finder that takes its own openings would ask for a move that changes nothing. */
  const naive = (t: readonly number[], y: number) => t.reduce((best, top, i) => (Math.abs(y - top) < Math.abs(y - t[best]!) ? i : best), 0);
  assert.equal(naive(tops, 52), 1, 'anti-vacuity: the naive finder does take the held row’s own opening');
});

test('2 · a drop is one edit of the list — every drop there is, and no reply is ever lost by one', () => {
  let drops = 0;
  for (const part of RSVP_LOOK_CARDS) {
    const own = RSVP_SCREEN_LINES[part];
    /* The screen as the page draws it · with two lines added · with a group of two of its own lines and a line added
       into the group · with two groups. */
    const plain: unknown = {};
    const added = edited(edited(plain, { do: 'add', part, kind: 'h', anchor: own[0]!, where: 'above' }), { do: 'add', part, kind: 'm', anchor: own[own.length - 1]!, where: 'below' });
    const grouped = edited(added, { do: 'group', part, lines: [own[0]!, own[1]!] });
    const inGroup = edited(grouped, { do: 'add', part, kind: 'm', anchor: own[0]!, where: 'below' });
    const states: unknown[] = [plain, added, grouped, inGroup];
    if (part === 'rsvp') states.push(edited(inGroup, { do: 'group', part, lines: ['yes', 'no'] }));

    for (const config of states) {
      const before = rowsOf(config, part);
      const lists: { names: string[]; group: string | null }[] = [{ names: before.top, group: null }, ...Object.entries(before.groups).map(([group, names]) => ({ names, group }))];
      for (const { names, group } of lists) {
        for (let at = 0; at < names.length; at++) {
          for (let slot = 0; slot <= names.length; slot++) {
            const target = rsvpDropBefore(names, slot === at || slot === at + 1 ? null : slot);
            if (target === undefined) continue; /* its own opening: nothing is asked */
            drops++;
            const res = rsvpLayoutEdit(config, { do: 'place', part, name: names[at]!, before: target });
            assert.ok(res.ok, `${part}: dropping ${names[at]} before ${target} was refused`);
            const after = rowsOf({ look: res.look }, part);
            /* The list it stands in is the one expected: taken out, put in at the opening. */
            const want = names.filter((_, i) => i !== at);
            want.splice(slot > at ? slot - 1 : slot, 0, names[at]!);
            assert.deepEqual(group ? after.groups[group] : after.top, want, `${part}: ${names[at]} → opening ${slot}`);
            /* …and nothing else moved: the other list(s) stand as they stood. */
            if (group) assert.deepEqual(after.top, before.top, 'a drop inside a group moved the screen’s own row');
            for (const [g, held] of Object.entries(before.groups)) if (g !== group) assert.deepEqual(after.groups[g], held, 'a drop changed a group it was not in');
            /* 🔒 EVERY LINE OF THE PAGE'S OWN IS STILL THERE, ONCE — Yes and No with them. */
            const order = rsvpScreenOrder(readRsvpLook({ look: res.look }), part);
            for (const line of own) assert.equal(order.filter((n) => n === line).length, 1, `${part}: ${line} is not in the list exactly once after a drop`);
            assert.equal(res.pick, names[at], 'what was held is not what is picked');
          }
        }
      }
    }
  }
  if (process.env.SHOW_DROPS) console.log(`DROPS ${drops}`);
  assert.ok(drops > 150, `anti-vacuity: only ${drops} drops were tried`);
  /* A name that is not on the screen, or a `before` that is not beside it: nothing is lost either way. */
  const odd = rsvpLayoutEdit({}, { do: 'place', part: 'rsvp', name: 'nobody', before: 'yes' });
  assert.equal(odd.ok, false);
  const stray = rsvpLayoutEdit({}, { do: 'place', part: 'rsvp', name: 'yes', before: 'nobody' });
  assert.ok(stray.ok, 'a `before` that is not there is "last"');
  assert.deepEqual(rsvpScreenOrder(readRsvpLook({ look: stray.look }), 'rsvp'), ['eyebrow', 'question', 'no', 'yes']);
});

test('3 · the March’s feel by its own numbers: imported, never copied — the hold is this drag’s one difference', () => {
  const DRAG = src(`${L}/rsvp-canvas-drag.ts`);
  const MARCH = src(`${L}/details-march.tsx`);
  assert.match(DRAG, /import \{ EDGE_PX, SETTLE_MS \} from '\.\/details-march';/);
  assert.match(MARCH, /export const SETTLE_MS = 240;\s*export const EDGE_PX = 56;/, 'the March’s two numbers are not exported as they were');
  /* Not typed again here. */
  assert.doesNotMatch(DRAG, /\b(240|56)\b/, 'a March number is typed in the drag');
  assert.match(DRAG, /duration: SETTLE_MS/);
  assert.match(DRAG, /h\.y < EDGE_PX && h\.y > -40 \? -1 : h\.y > win\.innerHeight - EDGE_PX/);
  /* The hold: 350 ms, the prototype's own, used for the lift. */
  assert.match(DRAG, /export const RSVP_HOLD_MS = 350;/);
  assert.match(DRAG, /timer: win\.setTimeout\(\(\) => lift\(x, y\), RSVP_HOLD_MS\)/);
  /* The March's bare numbers, named where they are used. */
  for (const named of [/const GHOST_SCALE = 1\.03;/, /const LIFTED_DIM = 0\.3;/, /const LAND_MS = 220;/, /const MOUSE_LIFT_PX = 4;/]) assert.match(DRAG, named);
  assert.match(MARCH, /scale\(1\.03\)/, 'anti-vacuity: the March’s ghost no longer scales by 1.03');
  assert.match(MARCH, /duration: 220,/, 'anti-vacuity: the March’s ghost no longer flies home in 220 ms');
  /* A finger that moves before the hold ends is a scroll; while held, the page does not scroll under it. */
  assert.match(DRAG, /if \(p\.touch\) \{\s*if \(moved > TOUCH_SCROLL_PX\) stop\(\);/);
  assert.match(DRAG, /const onTouchMove = \(e: TouchEvent\) => \{\s*if \(held\) e\.preventDefault\(\);\s*\};/);
  assert.match(DRAG, /doc\.addEventListener\('touchmove', onTouchMove, \{ passive: false \}\);/);
  /* Reduced motion: it is simply there. */
  assert.match(DRAG, /if \(calm\(\)\) return done\(\);/);
});

test('4 · the drag writes nothing and puts nothing among the lines — a drop asks the panel for one `place`', () => {
  const DRAG = src(`${L}/rsvp-canvas-drag.ts`);
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  assert.doesNotMatch(DRAG, /draftAction|hubDraftAction|rsvp_ask_config|fetch\(|postMessage/, 'the drag talks to something itself');
  assert.match(STAGE, /if \(before === undefined\) return pick\.current\(subject\.name, undefined, subject\.part\);\s*askRsvpListEdit\(\{ do: 'place', part: subject\.part, name: subject\.name, before \}\);/);
  /* Everything it creates goes on the page's body or head — never in the reply's fieldset. */
  const made = DRAG.match(/[\w.!?)\]]+\.(appendChild|insertBefore|append|prepend|before|after|replaceWith|insertAdjacentElement|insertAdjacentHTML)\(/g) ?? [];
  assert.ok(made.length >= 3, 'anti-vacuity: what the drag puts on the page was not found');
  for (const call of made) assert.match(call, /^(doc\.body|doc\.head|ghost)\.appendChild\($/, `the drag puts something somewhere else: ${call}`);
  /* The ghost is a picture: out of the reader's way, takes no tap, and carries no name, id or control name — so the
     reply's two answers are never on the page twice. */
  assert.match(DRAG, /ghost\.setAttribute\('aria-hidden', 'true'\);/);
  assert.match(DRAG, /ghost\.setAttribute\('inert', ''\);/);
  assert.match(DRAG, /if \(a\.name\.startsWith\('data-'\) \|\| a\.name === 'id' \|\| a\.name === 'name' \|\| a\.name === 'for'\) el\.removeAttribute\(a\.name\);/);
  assert.match(DRAG, /pointerEvents: 'none',/);
  /* Left mid-drag (the screen changes, the stage closes): nothing of it stays on the page. */
  assert.match(DRAG, /return \(\) => \{\s*stop\(\);\s*if \(held\) \{\s*settle\(held\);\s*held\.ghost\.remove\(\);\s*undim\(held\);/);
  /* The tap a drop leaves behind picks nothing. */
  assert.match(DRAG, /win\.addEventListener\('click', eat, true\);\s*win\.setTimeout\(\(\) => win\.removeEventListener\('click', eat, true\), SWALLOW_MS\);/);
});

test('5 · what a press picks up: the line — inside a group the whole group, unless that line is the picked one', () => {
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  const at = STAGE.indexOf('export function rsvpDragSubject(');
  assert.ok(at > 0, 'anti-vacuity: the subject rule was not found');
  const rule = STAGE.slice(at, STAGE.indexOf('\n}\n', at));
  assert.match(rule, /if \(!box \|\| !box\.contains\(target\)\) return null;/, 'a press outside the screen’s lines lifts something');
  assert.match(rule, /if \(\(target as HTMLElement\)\.isContentEditable\) return null;/, 'words being typed can be lifted');
  assert.match(rule, /if \(line && line\.name === pickedLine\) return \{ part, \.\.\.line, beside: inside \};\s*const self = top\.find\(\(r\) => r\.row === wrap\);\s*return self \? \{ part, \.\.\.self, beside: top \} : null;/);
  assert.match(rule, /const line = top\.find\(\(r\) => r\.row\.contains\(target\)\);\s*return line \? \{ part, \.\.\.line, beside: top \} : null;\s*$/);
  /* Only what has a place in the list is a row: the Hint, a question's field and the pass are not (so they cannot
     be held) — read off the page by the same names the list uses. */
  const ARRANGE = src(`${L}/rsvp-canvas-arrange.ts`);
  assert.match(ARRANGE, /if \(!\(RSVP_SCREEN_LINES\[part\] as readonly string\[\]\)\.includes\(name\) && !el\.hasAttribute\('data-rsvp-added'\)\) return;/);
  assert.equal(RSVP_SCREEN_LINES.rsvp.includes('hint' as never), false, 'anti-vacuity: the Hint has a place in the list now');
  /* With one thing on a screen there is nowhere to move it. */
  assert.match(src(`${L}/rsvp-canvas-drag.ts`), /if \(!subject \|\| subject\.beside\.length < 2\) return;/);
});

test('6 · colour tokens only — what the drag draws wears the app’s own, so a dark page is still read', () => {
  const DRAG = src(`${L}/rsvp-canvas-drag.ts`);
  assert.doesNotMatch(DRAG, /#[0-9a-fA-F]{3,8}\b/, 'a hex colour is typed in the drag');
  assert.doesNotMatch(DRAG, /\b(white|black)\b/, 'white or black is typed in the drag');
  assert.doesNotMatch(DRAG, /rgba?\(\s*\d/, 'a colour is typed in numbers in the drag');
  assert.match(DRAG, /const GHOST_PAPER = 'rgb\(var\(--color-cream\)\)';/);
  assert.match(DRAG, /const GHOST_SHADOW = 'var\(--m-shadow-lg\)';/);
  assert.match(DRAG, /const LEFT_MARK = '1\.5px dashed rgb\(var\(--color-ink\) \/ 0\.7\)';/);
  assert.match(DRAG, /const OPENING_INK = 'rgb\(var\(--sn-accent\)\)';/);
  /* …and the app's own corners, never a number of its own (`scripts/lint-radius.mjs` watches the tree). */
  assert.match(DRAG, /const GHOST_ROUND = 'var\(--m-r-md\)';\s*const OPENING_ROUND = 'var\(--m-r-full\)';/);
  assert.doesNotMatch(DRAG, /borderRadius: [^,\n]*'\d/, 'a corner is typed in px in the drag');
  /* 🧷 It is a browser's file and says so: it reads two numbers from the March's own (`'use client'`) file, and a
     file with no directive would be handed a reference there, not the number
     (`a-server-file-never-takes-a-value-from-a-client-module`). */
  assert.match(raw(`${L}/rsvp-canvas-drag.ts`), /^'use client';\n/);
  /* anti-vacuity: each token is defined by the app. */
  const CSS = raw('app/globals.css');
  for (const token of ['--color-cream:', '--color-ink:', '--sn-accent:', '--m-shadow-lg:', '--m-r-md:', '--m-r-full:']) assert.ok(CSS.includes(token), `${token} is not one of the app’s tokens`);
});

test('7 · the frame steps aside while a line is held — and neither the first load nor a guest’s page knows the drag', () => {
  const FRAME = src(`${L}/add-part-sheet.tsx`);
  assert.match(FRAME, /const edges = Boolean\(picked && box\) && !away;/);
  assert.match(src(`${L}/stage-tools.tsx`), /\n\s*away: rsvpList\.away,\n/);
  assert.match(src(`${L}/rsvp-list-stage.tsx`), /onLift: \(\) => setHeld\(true\),/);
  /* Wired again when the page says it is up (a frame that loads later is a new document). */
  assert.match(src(`${L}/rsvp-list-stage.tsx`), /if \(d\?\.source === RSVP_SITE_SOURCE && d\.t === 'rsvpReady'\) setUp\(\(n\) => n \+ 1\);/);
  assert.match(src(`${L}/rsvp-list-stage.tsx`), /\}, \[on, frameSel, up\]\);/);
  /* The Maker's first load (and its libs) and every file a guest's page is made of: not a word of the drag. */
  const first = ['lib/rsvp-ask.ts', 'lib/hub-draft.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts', 'lib/rsvp-stage-shared.ts', `${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, `${L}/details-lazy.tsx`];
  const guest = ['app/[slug]/_components/rsvp-canvas-bridge.tsx', 'app/[slug]/_components/rsvp-canvas-parts.ts', 'app/[slug]/_components/rsvp-lines.tsx', 'app/[slug]/_components/rsvp-widget.tsx', 'app/[slug]/_components/rsvp-note-lines.tsx', 'lib/rsvp-look.ts'];
  for (const file of [...first, ...guest]) assert.doesNotMatch(src(file), /(from|import\()\s*['"][^'"]*(rsvp-canvas-drag|rsvp-list-stage|rsvp-layout-edit|rsvp-line-list|rsvp-canvas-arrange)['"]|attachRsvpDrag/, `${file} loads the drag`);
  assert.match(src(`${L}/rsvp-list-stage.tsx`), /from '\.\/rsvp-canvas-drag';/, 'anti-vacuity: the stage’s hook no longer loads the drag');
});
