/**
 * ＋ ↕ 🫧 EVERY EDIT OF A REPLY SCREEN'S LIST LEAVES THE LIST WHOLE — `rsvpLayoutEdit` (`lib/rsvp-layout-edit.ts`),
 * the one function the Maker's RSVP stage changes a list through (owner's ruling 2026-10-09; the approved prototype's
 * `add` · `remove` · Earlier / Later · the drop · `group` · `ungroup`).
 *
 *   1. ＋ adds an EMPTY line where it was asked — inside the anchor's group when the anchor is in one; four a screen;
 *   2. only a line the couple added can be removed (its look goes with it; a group it emptied goes with it);
 *   3. Earlier / Later and a drop move a line among what stands beside it — a group moves as one, a line in a group
 *      moves inside it, and a line never leaves its group that way;
 *   4. Group: two or more lines that are in no group; the card stands aside (None) and remembers its ground; the last
 *      Ungroup puts it back; a ground the couple picked for the card in between stands;
 *   5. 🔒 THREE THOUSAND RANDOM EDITS IN A ROW (most are refused — a name that is not there, an edge, a full screen): after every one, the form's order still holds Yes and No (and every other
 *      line of the page's own) exactly once, and what was stored reads back to the same list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RSVP_ADDED_MAX, RSVP_GROUPS_MAX, RSVP_LOOK_CARDS, RSVP_SCREEN_LINES, readRsvpLook, rsvpLayoutIsGroup, rsvpLookWith, rsvpScreenLayout, rsvpScreenOrder, type RsvpLookCard } from './rsvp-look';
import { rsvpGroupName, rsvpLayoutEdit, type RsvpLayoutEdit } from './rsvp-layout-edit';

/** Apply edits in a row; each must be taken. Returns the config and what each asked to be picked. */
function after(config: Record<string, unknown>, ...edits: RsvpLayoutEdit[]): { config: Record<string, unknown>; picks: (string | null)[] } {
  const picks: (string | null)[] = [];
  for (const edit of edits) {
    const res = rsvpLayoutEdit(config, edit);
    assert.ok(res.ok, `${JSON.stringify(edit)} was refused: ${res.ok ? '' : res.why}`);
    config = { ...config, look: res.look };
    if (res.look === undefined) delete config.look;
    picks.push(res.pick);
  }
  return { config, picks };
}
const shape = (config: unknown, part: RsvpLookCard = 'rsvp') =>
  (rsvpScreenLayout(readRsvpLook(config), part) ?? RSVP_SCREEN_LINES[part].map((line) => ({ line, added: null }))).map((item) => (rsvpLayoutIsGroup(item) ? `${rsvpGroupName(item.group.id)}[${item.lines.map((l) => l.line).join(' ')}]` : item.line)).join(' ');
const why = (config: unknown, edit: RsvpLayoutEdit) => {
  const res = rsvpLayoutEdit(config, edit);
  return res.ok ? 'taken' : res.why;
};

test('1 · ＋ adds an empty line where it was asked, picked — four a screen', () => {
  const a = after({}, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'question', where: 'below' });
  assert.equal(shape(a.config), 'eyebrow question a:1 yes no');
  assert.deepEqual(a.picks, ['a:1']);
  /* It arrives EMPTY: no words are made up for it (no made-up word or date may ever print to a guest). */
  assert.deepEqual(readRsvpLook(a.config).added, { rsvp: [{ id: '1', k: 'm' }] });
  const b = after(a.config, { do: 'add', part: 'rsvp', kind: 'h', anchor: 'eyebrow', where: 'above' }, { do: 'add', part: 'yesnote', kind: 'h', anchor: 'message', where: 'below' });
  assert.equal(shape(b.config), 'a:2 eyebrow question a:1 yes no');
  assert.equal(shape(b.config, 'yesnote'), 'heading message a:3');
  /* Above the Hint (which has no place in the list): the list's last. */
  assert.equal(shape(after({}, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'hint', where: 'above' }).config), 'eyebrow question yes no a:1');
  /* Its words, typed: cleaned and capped as every typed line is. */
  const c = after(a.config, { do: 'words', part: 'rsvp', line: 'a:1', text: '  Kindly\nreply by the 12th  ' });
  assert.deepEqual(readRsvpLook(c.config).added?.rsvp, [{ id: '1', k: 'm', t: 'Kindly reply by the 12th' }]);
  assert.deepEqual(readRsvpLook(after(c.config, { do: 'words', part: 'rsvp', line: 'a:1', text: '   ' }).config).added?.rsvp, [{ id: '1', k: 'm' }]);
  /* Four a screen. */
  let full: Record<string, unknown> = {};
  for (let i = 0; i < RSVP_ADDED_MAX; i++) full = after(full, { do: 'add', part: 'nonote', kind: 'm', anchor: 'heading', where: 'below' }).config;
  assert.equal(why(full, { do: 'add', part: 'nonote', kind: 'm', anchor: 'heading', where: 'below' }), 'full');
  assert.equal(why(full, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'yes', where: 'below' }), 'taken', 'one screen being full stops another');
});

test('2 · only a line the couple added can be removed — its look goes with it, and a group it emptied', () => {
  for (const line of ['eyebrow', 'question', 'yes', 'no', 'hint', 'a:9', 'g:1']) assert.equal(why({}, { do: 'remove', part: 'rsvp', line }), 'own-line', line);
  let { config } = after({}, { do: 'add', part: 'rsvp', kind: 'h', anchor: 'yes', where: 'above' }, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'a:1', where: 'below' });
  config = { ...config, look: rsvpLookWith(config, 'a:1', { s: 120 }) };
  assert.deepEqual(readRsvpLook(config).lines, { 'a:1': { s: 120 } });
  ({ config } = after(config, { do: 'group', part: 'rsvp', lines: ['a:1', 'a:2'] }));
  assert.equal(shape(config), 'eyebrow question g:1[a:1 a:2] yes no');
  ({ config } = after(config, { do: 'remove', part: 'rsvp', line: 'a:1' }));
  assert.equal(shape(config), 'eyebrow question g:1[a:2] yes no');
  assert.equal(readRsvpLook(config).lines, undefined, 'the removed line’s look is still stored');
  ({ config } = after(config, { do: 'remove', part: 'rsvp', line: 'a:2' }));
  /* The last added line gone, its group gone with it, the card back to its own ground: nothing is stored at all. */
  assert.equal(shape(config), 'eyebrow question yes no');
  assert.equal(config.look, undefined);
});

test('3 · Earlier · Later and a drop: among what stands beside it — a group as one, a line in a group inside it', () => {
  let { config } = after({}, { do: 'step', part: 'rsvp', name: 'eyebrow', dir: 1 });
  assert.equal(shape(config), 'question eyebrow yes no');
  assert.equal(why(config, { do: 'step', part: 'rsvp', name: 'question', dir: -1 }), 'edge');
  assert.equal(why(config, { do: 'step', part: 'rsvp', name: 'no', dir: 1 }), 'edge');
  assert.equal(why(config, { do: 'step', part: 'rsvp', name: 'hint', dir: -1 }), 'not-there', 'the Hint has no place to move from');
  /* Back to the page's own order: no order is stored. */
  assert.equal(after(config, { do: 'step', part: 'rsvp', name: 'eyebrow', dir: -1 }).config.look, undefined);
  ({ config } = after(config, { do: 'place', part: 'rsvp', name: 'no', before: 'question' }));
  assert.equal(shape(config), 'no question eyebrow yes');
  ({ config } = after(config, { do: 'place', part: 'rsvp', name: 'no', before: null }));
  assert.equal(shape(config), 'question eyebrow yes no');
  ({ config } = after(config, { do: 'group', part: 'rsvp', lines: ['question', 'eyebrow'] }));
  assert.equal(shape(config), 'g:1[question eyebrow] yes no');
  /* The group moves as one… */
  ({ config } = after(config, { do: 'step', part: 'rsvp', name: 'g:1', dir: 1 }));
  assert.equal(shape(config), 'yes g:1[question eyebrow] no');
  ({ config } = after(config, { do: 'place', part: 'rsvp', name: 'g:1', before: null }));
  assert.equal(shape(config), 'yes no g:1[question eyebrow]');
  /* …a line in it moves inside it, and its edges are the group's. */
  ({ config } = after(config, { do: 'step', part: 'rsvp', name: 'eyebrow', dir: -1 }));
  assert.equal(shape(config), 'yes no g:1[eyebrow question]');
  assert.equal(why(config, { do: 'step', part: 'rsvp', name: 'eyebrow', dir: -1 }), 'edge');
  assert.equal(why(config, { do: 'step', part: 'rsvp', name: 'question', dir: 1 }), 'edge');
  /* A drop "before" something that does not stand beside it lands it last among what does — never outside. */
  ({ config } = after(config, { do: 'place', part: 'rsvp', name: 'eyebrow', before: 'yes' }));
  assert.equal(shape(config), 'yes no g:1[question eyebrow]');
  /* ＋ on a line in a group adds INTO that group; ＋ on the group adds beside it. */
  ({ config } = after(config, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'question', where: 'below' }, { do: 'add', part: 'rsvp', kind: 'h', anchor: 'g:1', where: 'above' }));
  assert.equal(shape(config), 'yes no a:2 g:1[question a:1 eyebrow]');
});

test('4 · Group: two or more loose lines; the card stands aside and remembers; the last Ungroup puts it back', () => {
  assert.equal(why({}, { do: 'group', part: 'rsvp', lines: ['yes'] }), 'too-few');
  assert.equal(why({}, { do: 'group', part: 'rsvp', lines: ['yes', 'hint'] }), 'too-few', 'the Hint cannot be grouped');
  const frosted = { look: { card: { rsvp: { g: 'frost', i: { fade: true } } } } };
  let { config, picks } = after(frosted, { do: 'group', part: 'rsvp', lines: ['no', 'yes'] });
  /* In the screen's order, where the first of them stood; picked, so its background is the next thing chosen. */
  assert.equal(shape(config), 'eyebrow question g:1[yes no]');
  assert.deepEqual(picks, ['g:1']);
  assert.deepEqual(readRsvpLook(config).card, { rsvp: { i: { fade: true }, g: 'none', w: 'frost' } });
  assert.equal(why(config, { do: 'group', part: 'rsvp', lines: ['yes', 'eyebrow'] }), 'in-group');
  assert.equal(why(config, { do: 'group', part: 'rsvp', lines: ['g:1', 'eyebrow'] }), 'is-group');
  /* Its background: None · Plain (nothing stored) · Frosted. */
  ({ config } = after(config, { do: 'ground', part: 'rsvp', group: 'g:1', ground: 'frost' }));
  assert.equal(readRsvpLook(config).groups?.rsvp?.[0]?.g, 'frost');
  ({ config } = after(config, { do: 'ground', part: 'rsvp', group: 'g:1', ground: null }));
  assert.equal(readRsvpLook(config).groups?.rsvp?.[0]?.g, undefined);
  /* A second group does not touch the card again; ungrouping one of two leaves it aside. */
  ({ config } = after(config, { do: 'group', part: 'rsvp', lines: ['eyebrow', 'question'] }));
  assert.equal(shape(config), 'g:2[eyebrow question] g:1[yes no]');
  ({ config, picks } = after(config, { do: 'ungroup', part: 'rsvp', group: 'g:1' }));
  assert.equal(shape(config), 'g:2[eyebrow question] yes no');
  assert.deepEqual(picks, ['yes']);
  assert.equal(readRsvpLook(config).card?.rsvp?.g, 'none');
  ({ config } = after(config, { do: 'ungroup', part: 'rsvp', group: 'g:2' }));
  assert.deepEqual(config.look, frosted.look, 'the last Ungroup did not put the card back as it was');
  /* A plain card comes back plain (nothing stored)… */
  const plain = after({}, { do: 'group', part: 'nonote', lines: ['heading', 'message'] });
  assert.deepEqual(readRsvpLook(plain.config).card, { nonote: { g: 'none', w: 'plain' } });
  assert.equal(after(plain.config, { do: 'ungroup', part: 'nonote', group: 'g:1' }).config.look, undefined);
  /* …and a ground the couple picks for the card while a group stands is theirs: Ungroup leaves it. */
  const picked = { ...plain.config, look: rsvpLookWith(plain.config, { card: 'nonote' }, { g: 'frost' }) };
  assert.deepEqual(readRsvpLook(picked).card, { nonote: { g: 'frost' } });
  assert.deepEqual(readRsvpLook(after(picked, { do: 'ungroup', part: 'nonote', group: 'g:1' }).config).card, { nonote: { g: 'frost' } });
  /* Four groups a screen. */
  let many: Record<string, unknown> = {};
  for (let i = 0; i < RSVP_ADDED_MAX; i++) many = after(many, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'no', where: 'below' }).config;
  for (const pair of [['eyebrow', 'question'], ['yes', 'no'], ['a:1', 'a:2']]) many = after(many, { do: 'group', part: 'rsvp', lines: pair }).config;
  assert.equal(readRsvpLook(many).groups?.rsvp?.length, 3);
  assert.equal(RSVP_GROUPS_MAX, 4);
});

test('5 · 🔒 three thousand random edits in a row: Yes and No are in the form after every one, and what is stored reads back the same', () => {
  let a = 20261010;
  const rnd = (n: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
  const pick = <T,>(list: readonly T[]): T => list[rnd(list.length)]!;
  let config: Record<string, unknown> = {};
  let taken = 0;
  for (let i = 0; i < 3000; i++) {
    const part = pick(RSVP_LOOK_CARDS);
    const look = readRsvpLook(config);
    const names = [...rsvpScreenOrder(look, part), ...(look.groups?.[part] ?? []).map((g) => rsvpGroupName(g.id)), 'hint', 'save', 'a:zz', 'g:zz'];
    const edit = pick<RsvpLayoutEdit>([
      { do: 'add', part, kind: pick(['h', 'm'] as const), anchor: pick(names), where: pick(['above', 'below'] as const) },
      { do: 'remove', part, line: pick(names) },
      { do: 'words', part, line: pick(names), text: pick(['', 'x', '<b>y</b>', '漢'.repeat(400)]) },
      { do: 'step', part, name: pick(names), dir: pick([-1, 1] as const) },
      { do: 'place', part, name: pick(names), before: pick([...names, null]) },
      { do: 'group', part, lines: [pick(names), pick(names), pick(names)] },
      { do: 'ungroup', part, group: pick(names) },
      { do: 'ground', part, group: pick(names), ground: pick(['none', 'frost', null] as const) },
    ]);
    const res = rsvpLayoutEdit(config, edit);
    if (res.ok) {
      taken += 1;
      config = res.look === undefined ? {} : { look: res.look };
    }
    const now = readRsvpLook(config);
    /* What was stored IS the strict reading of itself — nothing the reader would drop was written. */
    assert.deepEqual(now, config.look ?? {}, `edit ${i} (${JSON.stringify(edit)}) stored something the reader does not keep`);
    for (const p of RSVP_LOOK_CARDS) {
      const order = rsvpScreenOrder(now, p);
      for (const own of RSVP_SCREEN_LINES[p]) assert.equal(order.filter((n) => n === own).length, 1, `edit ${i} (${JSON.stringify(edit)}): ${own} is not on ${p} once`);
      assert.equal(new Set(order).size, order.length);
      assert.ok((now.added?.[p]?.length ?? 0) <= RSVP_ADDED_MAX && (now.groups?.[p]?.length ?? 0) <= RSVP_GROUPS_MAX);
      /* The card is aside exactly while a group stands (unless the couple gave it a ground themselves — not done here). */
      assert.equal(Boolean(now.card?.[p]?.w), (now.groups?.[p]?.length ?? 0) > 0, `edit ${i}: the card of ${p} remembers a ground with no group, or the other way round`);
    }
  }
  assert.ok(taken > 600, `only ${taken} of 3,000 edits were taken — the walk is not testing the edits`);
});
