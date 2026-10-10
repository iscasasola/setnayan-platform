/**
 * 🧱 THE LINES OF A REPLY SCREEN ARE A LIST — what the one strict reader makes of `rsvp_ask_config.look`'s `added`,
 * `order` and `groups` (owner's ruling 2026-10-09: ＋ adds a line, a held line drags to a new place, several lines
 * share one background; `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` §3).
 *
 * Beside this file: `app/[slug]/_components/the-reply-is-never-lost.test.ts` (whatever is stored, the card has its
 * Yes and its No — thousands of hostile values), `the-reply-card-is-todays-page.test.ts` and
 * `invite/enter/the-note-after-a-reply-is-todays-page.test.ts` (nothing stored = the recorded bytes). Here:
 *
 *   1. the order is a HINT, read exactly so — worked examples;
 *   2. the SIZE LIMITS were measured for the shape THIS reader keeps: the worst-case fixture the database test
 *      measures goes through the reader and comes back whole;
 *   3. the writers keep it: a line's look saved from the panel carries `added` · `order` · `groups`, and a line the
 *      couple added takes a look like any other;
 *   4. the Hint and the pass's Save button have no place in a list;
 *   5. REACH — who is handed a list: the invitation's reply page and the Event Hub's own reply sheet (the form), and
 *      the page after a reply (the two notes). Not The question or The ticket;
 *   6. a guest DOWNLOADS nothing for it, and the Maker's first load learns nothing of it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sanitizeRsvpAskConfig } from './rsvp-ask';
import {
  RSVP_ADDED_MAX,
  RSVP_CONFIG_ROOM,
  RSVP_GROUPS_MAX,
  RSVP_LOOK_CARDS,
  RSVP_SCREEN_LINES,
  readRsvpLook,
  rsvpAddedId,
  rsvpAddedName,
  rsvpConfigBytes,
  rsvpLayoutIsGroup,
  rsvpLookCss,
  rsvpLookWith,
  rsvpScreenLayout,
  rsvpScreenOrder,
} from './rsvp-look';
import { worstRsvpAskConfig } from '../tests/db/rsvp-ask-config-worst';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const order = (look: unknown, part: 'rsvp' | 'yesnote' | 'nonote' = 'rsvp') => rsvpScreenOrder(readRsvpLook({ look }), part);

test('1 · the order is a hint: a line it does not name is put back — the page’s own beside its neighbour, an added one last', () => {
  assert.deepEqual(order({}), ['eyebrow', 'question', 'yes', 'no']);
  assert.deepEqual(order({ order: { rsvp: ['no', 'yes', 'question', 'eyebrow'] } }), ['no', 'yes', 'question', 'eyebrow']);
  /* Half a list: Yes is put back after Question (the nearest of the page's lines before it), Eyebrow first. */
  assert.deepEqual(order({ order: { rsvp: ['no', 'question'] } }), ['eyebrow', 'no', 'question', 'yes']);
  assert.deepEqual(order({ order: { rsvp: ['no'] } }), ['eyebrow', 'question', 'yes', 'no']);
  /* Names it does not have are not there: another screen's, the Hint, a line nobody added, the same name twice. */
  assert.deepEqual(order({ order: { rsvp: ['heading', 'hint', 'a:zz', 'yes', 'yes', 'no', 7, null] } }), ['eyebrow', 'question', 'yes', 'no']);
  const added = { rsvp: [{ id: 'n1', k: 'h', t: 'A note' }, { id: 'n2', k: 'm', t: 'Kindly reply' }] };
  assert.deepEqual(order({ added }), ['eyebrow', 'question', 'yes', 'no', 'a:n1', 'a:n2']);
  assert.deepEqual(order({ added, order: { rsvp: ['a:n2', 'eyebrow', 'question', 'yes', 'no'] } }), ['a:n2', 'eyebrow', 'question', 'yes', 'no', 'a:n1']);
  /* A line added to ONE screen is not in another's order. */
  assert.deepEqual(order({ added, order: { yesnote: ['a:n1', 'message', 'heading'] } }, 'yesnote'), ['message', 'heading']);
  /* Not an array, not an object: the page's own. */
  for (const bad of ['x', 7, null, [], { rsvp: 'no,yes' }, { rsvp: { 0: 'no' } }]) assert.deepEqual(order({ order: bad }), ['eyebrow', 'question', 'yes', 'no']);
});

test('1b · a group stands where its first line stands, holds its lines in the screen’s order, and a line is in one group', () => {
  const look = readRsvpLook({
    look: {
      added: { rsvp: [{ id: 'n1', k: 'm', t: 'Kindly reply' }] },
      order: { rsvp: ['eyebrow', 'yes', 'question', 'a:n1', 'no'] },
      groups: { rsvp: [{ id: 'g1', of: ['a:n1', 'yes'] }, { id: 'g2', of: ['yes', 'no', 'hint'], g: 'none' }, { id: 'g1', of: ['eyebrow'] }, { id: 'g3', of: [] }] },
    },
  });
  /* g2 does not get Yes (g1 named it first) nor the Hint; the second g1 and the empty g3 are not kept. */
  assert.deepEqual(look.groups?.rsvp, [{ id: 'g1', of: ['a:n1', 'yes'] }, { id: 'g2', of: ['no'], g: 'none' }]);
  const list = rsvpScreenLayout(look, 'rsvp')!;
  assert.deepEqual(
    list.map((item) => (rsvpLayoutIsGroup(item) ? `${item.group.id}[${item.lines.map((l) => l.line).join(' ')}]` : item.line)),
    ['eyebrow', 'g1[yes a:n1]', 'question', 'g2[no]'],
  );
  /* A group's `i` / `v` are RESERVED: read by the closed sets (so the shape can take them later), drawn by nothing. */
  const moved = readRsvpLook({ look: { groups: { nonote: [{ id: 'g9', of: ['heading'], g: 'frost', i: { fade: true, move: 'sideways' }, v: 'cinematic' }] } } });
  assert.deepEqual(moved.groups?.nonote, [{ id: 'g9', of: ['heading'], i: { fade: true }, v: 'cinematic', g: 'frost' }]);
  assert.equal(rsvpLookCss(moved, ['nonote'], []), '[data-rsvp-group="g9"]{background:var(--sn-glass-bg)!important;border-color:var(--sn-glass-line)!important;backdrop-filter:var(--sn-glass-blur)!important;-webkit-backdrop-filter:var(--sn-glass-blur)!important;}');
  /* The caps. */
  const many = readRsvpLook({ look: { added: { rsvp: Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, k: 'h', t: 'x' })) }, groups: { rsvp: Array.from({ length: 9 }, (_, i) => ({ id: `g${i}`, of: [`a:n${i}`] })) } } });
  assert.equal(many.added?.rsvp?.length, RSVP_ADDED_MAX);
  assert.equal(many.groups?.rsvp?.length, RSVP_GROUPS_MAX);
});

test('2 · the size limits were measured for the shape this reader keeps: the worst case comes back whole', () => {
  for (const kind of ['m', 'h'] as const) {
    const worst = worstRsvpAskConfig({ kind });
    const kept = readRsvpLook(worst);
    assert.deepEqual(kept, worst.look, `the reader dropped part of the worst case (${kind}) — the database test is measuring a shape the app cannot save`);
    /* …and it is at the caps: one more line or group on a screen is not kept. */
    for (const part of RSVP_LOOK_CARDS) {
      assert.equal(kept.added?.[part]?.length, RSVP_ADDED_MAX);
      assert.equal(kept.groups?.[part]?.length, RSVP_GROUPS_MAX);
      assert.equal(rsvpScreenOrder(kept, part).length, RSVP_SCREEN_LINES[part].length + RSVP_ADDED_MAX);
    }
    assert.ok(rsvpConfigBytes(worst) <= RSVP_CONFIG_ROOM, 'a couple using every control is refused by the app’s own limit');
  }
  /* A typed line longer than its cap is cut to it — so nothing typed can outgrow the measurement. */
  const long = readRsvpLook({ look: { added: { rsvp: [{ id: 'n1', k: 'h', t: '漢'.repeat(500) }, { id: 'n2', k: 'm', t: '漢'.repeat(500) }] } } });
  assert.deepEqual(long.added?.rsvp?.map((a) => a.t?.length), [80, 240]);
});

test('3 · the writers keep it: a look saved from the panel carries the list, and an added line takes a look like any other', () => {
  const look = { added: { rsvp: [{ id: 'n1', k: 'm', t: 'Kindly reply' }] }, order: { rsvp: ['a:n1', 'eyebrow', 'question', 'yes', 'no'] }, groups: { rsvp: [{ id: 'g1', of: ['a:n1', 'eyebrow'] }] } };
  const stored = { look };
  assert.deepEqual(rsvpLookWith(stored, 'rsvp.question', { s: 120 }), { ...look, lines: { 'rsvp.question': { s: 120 } } });
  assert.deepEqual(rsvpLookWith(stored, { card: 'rsvp' }, { g: 'frost' }), { ...look, card: { rsvp: { g: 'frost' } } });
  const name = rsvpAddedName('n1');
  assert.equal(name, 'a:n1');
  const styled = rsvpLookWith(stored, name, { c: '#AA0011', s: 110, f: 'cinzel' });
  assert.deepEqual(styled, { ...look, lines: { 'a:n1': { c: '#aa0011', f: 'cinzel', s: 110 } } });
  assert.equal(rsvpLookCss(readRsvpLook({ look: styled }), ['rsvp'], []).startsWith('[data-rsvp-line="a:n1"][data-rsvp-line]{color:#aa0011;'), true);
  /* A look for a line nobody added is not read (its name would reach a selector). */
  assert.equal(readRsvpLook({ look: { lines: { 'a:zz': { s: 120 }, 'a:"]{}*{': { s: 120 } } } }).lines, undefined);
  assert.equal(rsvpAddedId('a:n1'), 'n1');
  for (const bad of ['n1', 'a:', 'a:TOOLONG', 'a:n 1', 'a:"]', null, undefined]) assert.equal(rsvpAddedId(bad), null);
  /* The card remembers the ground it wore before a group (`w`) — one of three words, nothing else. */
  assert.deepEqual(readRsvpLook({ look: { card: { rsvp: { g: 'none', w: 'frost' }, nonote: { w: 'url(x)' } } } }).card, { rsvp: { g: 'none', w: 'frost' } });
});

test('4 · the Hint and the pass’s Save button have no place in a list', () => {
  assert.deepEqual(RSVP_SCREEN_LINES, { rsvp: ['eyebrow', 'question', 'yes', 'no'], yesnote: ['heading', 'message'], nonote: ['heading', 'message'] });
  const look = readRsvpLook({ look: { order: { rsvp: ['hint', 'no', 'yes', 'question', 'eyebrow'], pass: ['save'] }, groups: { rsvp: [{ id: 'g1', of: ['hint'] }], pass: [{ id: 'g2', of: ['save'] }] }, added: { pass: [{ id: 'n1', k: 'h', t: 'x' }] } } });
  assert.deepEqual(look, { order: { rsvp: ['no', 'yes', 'question', 'eyebrow'] } });
  /* The Hint is drawn where it always was — by the one-question flow, at the card's foot. */
  assert.match(src('app/[slug]/_components/rsvp-one-at-a-time.tsx'), /<p data-rsvp-line="hint"/);
  assert.doesNotMatch(src('app/[slug]/_components/rsvp-widget.tsx'), /data-rsvp-line="hint"/);
});

test('5 · reach: both places a guest replies hand the card its list, the page after a reply hands the note its list — nobody else', () => {
  const REPLY = src('app/[slug]/invite/reply/page.tsx');
  const ENTER = src('app/[slug]/invite/enter/page.tsx');
  assert.match(REPLY, /lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), 'rsvp'\)\}/);
  assert.match(ENTER, /lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), reply === 'no' \? 'nonote' : 'yesnote'\)\}/);
  /* From the config the page already holds: neither page reads anything new for it. */
  for (const page of [REPLY, ENTER]) assert.equal((page.match(/rsvpScreenLayout\(/g) ?? []).length, 1);
  /* The Event Hub's own reply sheet is handed the SAME list (and wears the look) since 5b2 — it was handed neither,
     so a setting made on the stage never reached a guest who replied there
     (`the-rsvp-look-reaches-the-event-hub-sheet.test.ts`). */
  const HUB = src('app/[slug]/_components/site-body.tsx');
  assert.match(HUB, /<RsvpWidget\b[\s\S]*?lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), 'rsvp'\)\}/);
  assert.equal((HUB.match(/rsvpScreenLayout\(/g) ?? []).length, 1);
  /* The question and The ticket do not name their lines, so they are handed no list either: the widget draws the
     list only in the reply card's own arm. */
  const WIDGET = src('app/[slug]/_components/rsvp-widget.tsx');
  assert.equal((WIDGET.match(/<RsvpLines\b/g) ?? []).length, 1);
  assert.match(WIDGET, /<RsvpStyledAnswers[\s\S]*?\/>\s*\) : \(\s*<fieldset data-rsvp-step className="space-y-2" aria-labelledby=/);
  assert.doesNotMatch(src('app/[slug]/_components/rsvp-styles.tsx'), /RsvpLines|data-rsvp-line/);
});

test('6 · a guest downloads nothing for it, and the Maker’s first load learns nothing of it', () => {
  /* The two components that draw a list are server components: no client marker, and nothing they import is one. */
  for (const file of ['app/[slug]/_components/rsvp-lines.tsx', 'app/[slug]/_components/rsvp-note-lines.tsx']) {
    const raw = readFileSync(join(WEB, file), 'utf8');
    assert.doesNotMatch(raw, /^\s*['"]use client['"]/m, `${file} is a client component — a guest would download it`);
    assert.doesNotMatch(raw, /useState|useEffect|useRef|onClick|addEventListener/, `${file} holds state or a listener`);
    const imports = [...raw.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
    for (const from of imports) assert.match(from, /^(react|@\/lib\/(rsvp-look|rsvp-stage-shared|guest-landing)|\.\/rsvp-lines)$/, `${file} imports ${from}`);
  }
  /* The first-load sanitiser still only CARRIES `look` — the new keys ride inside it, unread and unnamed there. */
  const carried = { look: { added: { rsvp: [{ id: 'n1', k: 'm', t: 'x' }] }, order: { rsvp: ['no'] }, groups: { rsvp: [{ id: 'g1', of: ['no'] }] } } };
  assert.deepEqual(sanitizeRsvpAskConfig(carried).look, carried.look);
  for (const file of ['lib/rsvp-ask.ts', 'lib/hub-draft.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts']) {
    assert.doesNotMatch(src(file), /rsvp-look'|rsvpScreenLayout|RSVP_SCREEN_LINES|RSVP_ADDED_|RSVP_GROUP/, `${file} (the Maker’s first load) reads the list`);
  }
});
