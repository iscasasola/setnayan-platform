/**
 * 🔒 A REPLY IS NEVER MADE IMPOSSIBLE BY AN EDIT.
 *
 * On the Maker's RSVP stage a couple adds lines to the reply card, drags its lines into their own order and groups
 * them (owner's ruling 2026-10-09). All of it is kept in `events.rsvp_ask_config.look` — a JSON column a browser
 * writes. So the rule is not "the Maker never writes a bad order"; it is: **whatever that column holds, a guest's
 * card has its Yes and its No, both in the reply's one fieldset, neither hidden, and the fieldset still has a name.**
 *
 * Held two ways, over thousands of HOSTILE stored values (a seeded generator — the run is the same every time):
 *
 *   1. THE READER (`lib/rsvp-look.ts`): the screen's order always holds each of its lines exactly once; added lines
 *      and groups never pass their caps; a line is in at most one group; no group is in a group.
 *   2. THE PAGE (`RsvpWidget`, rendered): exactly one "attending" and one "declined" radio, in the reply's one
 *      fieldset with nothing hidden around them, still required when a reply is; the fieldset named by its legend or
 *      by `aria-labelledby` (both ids present, once); nothing typed is markup; nothing stored reaches the look's CSS
 *      but a checked value; a guest is never served an added line with no words, nor its placeholder.
 *
 * And NOTHING STORED = TODAY'S PAGE: a config with words and looks only — or with an order that IS the page's own —
 * gives the card no list at all (`null`), which `the-reply-card-is-todays-page.test.ts` holds to the recorded bytes.
 *
 * SABOTAGE (run 2026-10-10, each file restored to the same hash after — `scratchpad/rsvp-adg/sabotage-5b.sh`):
 *   a. `rsvpScreenOrder` trusts the stored order (the "put back what it does not name" step removed) → § 1 · 2 · 3 red;
 *   b. the card's own lines lose No (`own` without `no`) → § 2 · 4 red;
 *   c. an added line's words are set with `dangerouslySetInnerHTML` → § 2 · 4 red;
 *   d. the reader lets a line into two groups → § 1 red;
 *   e. `RsvpLines` draws an unwritten line for a guest (the Maker's placeholder word) → § 3 red;
 *   f. the fieldset loses `aria-labelledby` when its legend goes → § 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE, doorAction, renderReplyCard } from './reply-card-fixture';
import {
  RSVP_ADDED_MAX,
  RSVP_GROUPS_MAX,
  RSVP_LOOK_CARDS,
  RSVP_SCREEN_LINES,
  readRsvpLook,
  rsvpLayoutIsGroup,
  rsvpLookCss,
  rsvpLookRules,
  rsvpScreenLayout,
  rsvpScreenOrder,
  type RsvpLayoutItem,
} from '@/lib/rsvp-look';

/** A small seeded generator (mulberry32) — the same hostile values on every run. */
function seeded(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T,>(list: readonly T[]): T => list[int(list.length)]!;
  return { next, int, pick };
}

const IDS = ['a1', 'b2', 'zz9', 'q', 'abcd', 'ABCD', 'toolong', 'a b', '', '../x', '"><b', 'a1'];
const HOSTILE_TEXT = [
  'Kindly reply by the 12th',
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  '</fieldset><fieldset hidden>',
  'line one\nline two\u0000\u0007',
  '漢'.repeat(400),
  '',
  '   ',
  '}*{display:none}',
];
const NAMES = ['eyebrow', 'question', 'yes', 'no', 'hint', 'heading', 'message', 'save', 'YES', 'yes ', '__proto__', 'constructor', 'a:a1', 'a:b2', 'a:zz9', 'a:q', 'a:abcd', 'a:ABCD', 'a:', 'a:../x', 'g1'];
const GROUNDS = ['none', 'frost', 'plain', 'url(javascript:alert(1))', '}*{display:none}', 7, null];

function hostileLook(seed: number): Record<string, unknown> {
  const r = seeded(seed);
  const junk = () => r.pick<unknown>([null, 7, 'x', [], {}, true, [[]], { length: 3 }]);
  const names = (max: number) => Array.from({ length: r.int(max) }, () => (r.next() < 0.9 ? r.pick(NAMES) : junk()));
  /* The form twice as often as each other screen: it is the one that holds the answers. */
  const part = () => r.pick(['rsvp', ...RSVP_LOOK_CARDS, 'pass', 'x']);
  const added: Record<string, unknown> = {};
  const order: Record<string, unknown> = {};
  const groups: Record<string, unknown> = {};
  const lines: Record<string, unknown> = {};
  for (let i = r.int(5); i > 0; i--) {
    added[part()] =
      r.next() < 0.1
        ? junk()
        : Array.from({ length: r.int(9) }, () => (r.next() < 0.1 ? junk() : { id: r.pick(IDS), k: r.pick(['h', 'm', 'p', 'x', 1]), t: r.pick(HOSTILE_TEXT), p: 'r2://setnayan-thread-files/secret.png' }));
  }
  for (let i = r.int(5); i > 0; i--) order[part()] = r.next() < 0.1 ? junk() : names(14);
  for (let i = r.int(5); i > 0; i--) {
    groups[part()] =
      r.next() < 0.1 ? junk() : Array.from({ length: r.int(9) }, () => (r.next() < 0.1 ? junk() : { id: r.pick(IDS), of: r.next() < 0.1 ? junk() : names(8), g: r.pick(GROUNDS), i: { fade: true, move: 'sideways' }, v: 'warp' }));
  }
  for (let i = r.int(6); i > 0; i--) lines[r.pick(['a:a1', 'a:b2', 'a:"]{}', 'rsvp.yes', 'rsvp.no'])] = { c: r.pick(['#aabbcc', 'red;}*{display:none', 3]), f: r.pick(['cormorant', 'x;}']), s: r.pick([85, 132, '1;display:none']), i: { fade: true } };
  return { lines, added, order, groups, card: { rsvp: { g: r.pick(GROUNDS), w: r.pick(GROUNDS) } } };
}

const flat = (items: readonly RsvpLayoutItem[]) => items.flatMap((item) => (rsvpLayoutIsGroup(item) ? item.lines : [item])).map((l) => l.line);
const count = (s: string, needle: string) => s.split(needle).length - 1;
const RUNS = 3000;

test('1 · the reader: whatever is stored, every screen’s order holds each of its lines exactly once — Yes and No among them', () => {
  let arranged = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const look = readRsvpLook({ look: hostileLook(seed) });
    const ids = new Set<string>();
    for (const part of RSVP_LOOK_CARDS) {
      const added = look.added?.[part] ?? [];
      const groups = look.groups?.[part] ?? [];
      assert.ok(added.length <= RSVP_ADDED_MAX, `seed ${seed}: ${added.length} added lines on ${part}`);
      assert.ok(groups.length <= RSVP_GROUPS_MAX, `seed ${seed}: ${groups.length} groups on ${part}`);
      for (const a of added) {
        assert.match(a.id, /^[a-z0-9]{1,4}$/, `seed ${seed}: an id the app could not have made`);
        assert.ok(!ids.has(a.id), `seed ${seed}: the id ${a.id} is used twice`);
        ids.add(a.id);
        assert.ok(a.k === 'h' || a.k === 'm');
        // eslint-disable-next-line no-control-regex
        assert.doesNotMatch(a.t ?? '', /[\u0000-\u001f\u007f]/, `seed ${seed}: a control character is kept`);
        assert.ok((a.t ?? 'x').length > 0 && (a.t ?? '').length <= 240);
      }
      const order = rsvpScreenOrder(look, part);
      const want = [...RSVP_SCREEN_LINES[part], ...added.map((a) => `a:${a.id}`)];
      assert.deepEqual([...order].sort(), [...want].sort(), `seed ${seed}: ${part}’s order is not each of its lines once`);
      const inGroup = groups.flatMap((g) => g.of);
      assert.equal(new Set(inGroup).size, inGroup.length, `seed ${seed}: a line is in two groups`);
      for (const g of groups) {
        assert.ok(g.of.length > 0, `seed ${seed}: an empty group is kept`);
        for (const name of g.of) assert.ok(want.includes(name), `seed ${seed}: a group holds ${name}, which ${part} does not have`);
        assert.ok(g.g === undefined || g.g === 'none' || g.g === 'frost');
      }
      const layout = rsvpScreenLayout(look, part);
      if (layout) {
        arranged += 1;
        assert.deepEqual(flat(layout).sort(), [...want].sort(), `seed ${seed}: ${part}’s list is not each of its lines once`);
      } else assert.deepEqual(order, RSVP_SCREEN_LINES[part], `seed ${seed}: no list, but the order is not the page’s own`);
    }
    for (const name of ['yes', 'no']) assert.equal(rsvpScreenOrder(look, 'rsvp').filter((n) => n === name).length, 1, `seed ${seed}: ${name} is not in the form’s order once`);
  }
  assert.ok(arranged > RUNS / 2, `the generator arranged only ${arranged} screens — it is not testing the list`);
});

test('2 · the page: whatever is stored, a guest’s card has its Yes and its No — one fieldset, nothing hidden, still named, nothing typed is markup', async () => {
  const board = ['#111111', '#222222', '#333333', '#444444', '#555555'];
  let drawn = 0;
  let unled = 0;
  for (let seed = 1; seed <= RUNS; seed += 4) {
    const look = readRsvpLook({ look: hostileLook(seed) });
    const lines = rsvpScreenLayout(look, 'rsvp');
    if (!lines) continue;
    drawn += 1;
    for (const canvas of [false, true]) {
      const html = await renderReplyCard({ ...BASE, doorAction, lines, previewEveryQuestion: canvas });
      const at = `seed ${seed}${canvas ? ' (the Maker’s sample)' : ''}`;
      assert.equal(count(html, 'name="rsvp_status" value="attending"'), 1, `${at}: not exactly one Yes`);
      assert.equal(count(html, 'name="rsvp_status" value="declined"'), 1, `${at}: not exactly one No`);
      /* (As an INPUT's attribute — the card's own reveal rule names the field too, in its <style>.) */
      assert.equal(count(html, ' name="rsvp_status" value="'), 2, `${at}: a third answer`);
      /* The reply's fieldset: the one that holds the answers. Fieldsets never nest here, so it ends at the first close. */
      const open = html.lastIndexOf('<fieldset', html.indexOf(' name="rsvp_status" value="'));
      const reply = html.slice(open, html.indexOf('</fieldset>', open));
      assert.equal(count(reply, ' name="rsvp_status" value="'), 2, `${at}: the two answers are not in one fieldset`);
      assert.equal(count(reply, '<fieldset'), 1);
      /* Asked of the TAGS — typed words are text (escaped), and may say anything. */
      const tags = [...reply.matchAll(/<[^>]+>/g)].map((m) => m[0]).join('');
      assert.doesNotMatch(tags, / hidden=""| style="|aria-hidden| inert/, `${at}: something in the reply’s fieldset is hidden`);
      assert.equal(count(reply, 'required=""'), 2, `${at}: an answer is no longer required`);
      for (const line of ['yes', 'no', 'eyebrow', 'question']) assert.equal(count(reply, `data-rsvp-line="${line}"`), 1, `${at}: the ${line} line is not on the card once`);
      /* ♿ Named: by its legend while Eyebrow then Question lead it, else by the same two lines. */
      const head = reply.slice(0, reply.indexOf('>') + 1);
      if (reply.startsWith(`${head}<legend class="mb-3"><span data-rsvp-line="eyebrow"`)) assert.doesNotMatch(head, /aria-labelledby/);
      else {
        if (!canvas) unled += 1;
        assert.doesNotMatch(reply, /<legend/, `${at}: a legend that is not the fieldset’s first child`);
        assert.match(head, /aria-labelledby="rsvp-line-eyebrow rsvp-line-question"/, `${at}: the answers’ group has no name`);
        assert.equal(count(reply, 'id="rsvp-line-eyebrow"'), 1);
        assert.equal(count(reply, 'id="rsvp-line-question"'), 1);
      }
      /* Nothing typed is markup: the only tags a card's lines hold are the card's own. */
      assert.doesNotMatch(reply, /<script|<img|<b>|onerror=(?!alert)|<\/fieldset>\s*<fieldset hidden/i, `${at}: typed words became markup`);
      assert.deepEqual([...new Set([...reply.matchAll(/<([a-z]+)/g)].map((m) => m[1]))].sort(), [...new Set(['fieldset', 'input', 'label', 'span', ...(reply.includes('<legend') ? ['legend'] : []), ...(reply.includes('<p ') ? ['p'] : []), ...(reply.includes('<div ') ? ['div'] : [])])].sort(), `${at}: a tag the card does not draw`);
      /* 👻 A guest is never served an added line with no words, nor a word of the Maker's for one. */
      if (!canvas) {
        assert.doesNotMatch(reply, /data-rsvp-empty|data-rsvp-added/, `${at}: a guest is served the Maker’s marks`);
        for (const m of reply.matchAll(/<p data-rsvp-line="a:[a-z0-9]{1,4}"[^>]*>([^<]*)<\/p>/g)) assert.notEqual(m[1], '', `${at}: an added line with no words is drawn for a guest`);
        assert.doesNotMatch(reply, /<div data-rsvp-group="[a-z0-9]{1,4}"[^>]*><\/div>/, `${at}: an empty group is drawn for a guest`);
      }
      for (const m of reply.matchAll(/data-rsvp-(?:line|group)="([^"]*)"/g)) assert.match(m[1]!, /^(?:eyebrow|question|yes|no|a:[a-z0-9]{1,4}|[a-z0-9]{1,4})$/, `${at}: a name the app could not have made`);
    }
    /* 🎨 The look's CSS: every selector is one the page can be asked for, every value from a fixed list or a checked colour. */
    for (const rule of rsvpLookRules(look, ['rsvp'], board)) {
      assert.match(rule.selector, /^(?:\[data-rsvp-line="(?:[a-z]+|a:[a-z0-9]{1,4})"\]\[data-rsvp-line\]|\[data-rsvp-group="[a-z0-9]{1,4}"\]|div:has\(>\[data-door-header\]\))$/, `seed ${seed}: ${rule.selector}`);
      assert.doesNotMatch(rule.rules, /javascript|url\(|display:none|[{}<>]/, `seed ${seed}: ${rule.rules}`);
    }
    assert.doesNotMatch(rsvpLookCss(look, ['rsvp'], board), /javascript|url\(|display:none|</);
  }
  assert.ok(drawn > 200, `only ${drawn} arranged cards were drawn — the page is not being tested`);
  assert.ok(unled > 50, `only ${unled} cards lost their legend — the named-by-two-lines arm is not being tested`);
});

test('3 · nothing stored = no list: words and looks alone, and the page’s own order, hand the card nothing', async () => {
  const plain: unknown[] = [
    null,
    {},
    { words: { question: 'Coming?', attending: 'Yes!' }, oneAtATime: true },
    { look: { lines: { 'rsvp.question': { c: '#aabbcc', s: 120 }, 'rsvp.yes': { f: 'cormorant' } }, card: { rsvp: { g: 'frost' }, nonote: { g: 'none' } } } },
    { look: { order: { rsvp: ['eyebrow', 'question', 'yes', 'no'], yesnote: ['heading', 'message'] } } },
    { look: { order: { rsvp: ['eyebrow', 'question'], nonote: [] }, added: { rsvp: [] }, groups: { rsvp: [] } } },
    { look: { order: { rsvp: ['hint', 'nope', 7] }, added: { rsvp: [{ id: 'TOO-LONG', k: 'h', t: 'x' }] }, groups: { rsvp: [{ id: 'g1', of: ['hint', 'a:zz'] }] } } },
    { look: { later: { anything: true } } },
  ];
  const today = await renderReplyCard({ ...BASE, doorAction });
  for (const config of plain) {
    for (const part of RSVP_LOOK_CARDS) assert.equal(rsvpScreenLayout(readRsvpLook(config), part), null, JSON.stringify(config));
    assert.equal(await renderReplyCard({ ...BASE, doorAction, lines: rsvpScreenLayout(readRsvpLook(config), 'rsvp') }), today);
  }
  /* 👻 …and a line the couple added but has not written is not there for a guest: the card is today's, to the byte. */
  const unwritten = readRsvpLook({ look: { added: { rsvp: [{ id: 'a1', k: 'm' }, { id: 'b2', k: 'h', t: '   ' }] }, groups: { rsvp: [{ id: 'g1', of: ['a:a1', 'a:b2'] }] } } });
  const lines = rsvpScreenLayout(unwritten, 'rsvp');
  assert.ok(lines, 'the fixture arranged nothing');
  assert.equal(await renderReplyCard({ ...BASE, doorAction, lines }), today, 'unwritten lines changed a guest’s card');
  /* On the Maker's sample they ARE there — as their names, marked empty, never as words for a guest. */
  const sample = await renderReplyCard({ ...BASE, doorAction, lines, previewEveryQuestion: true });
  assert.match(sample, /<p data-rsvp-line="a:a1" data-rsvp-added="m" data-rsvp-empty=""[^>]*>Message<\/p>/);
  assert.match(sample, /<p data-rsvp-line="a:b2" data-rsvp-added="h" data-rsvp-empty=""[^>]*>Heading<\/p>/);
});

test('4 · the list is drawn as the list says: an order, an added line, a group — and the answers stay one radio group of one fieldset', async () => {
  const look = readRsvpLook({
    look: {
      added: { rsvp: [{ id: 'n1', k: 'h', t: 'A note from us' }, { id: 'n2', k: 'm', t: 'Kindly reply by 12 November & bring a jacket <3' }] },
      order: { rsvp: ['a:n1', 'question', 'eyebrow', 'yes', 'a:n2', 'no'] },
      groups: { rsvp: [{ id: 'g1', of: ['yes', 'a:n2'], g: 'frost' }] },
    },
  });
  const html = await renderReplyCard({ ...BASE, doorAction, lines: rsvpScreenLayout(look, 'rsvp') });
  const open = html.lastIndexOf('<fieldset', html.indexOf(' name="rsvp_status" value="'));
  const reply = html.slice(open, html.indexOf('</fieldset>', open));
  /* In the couple's order, top to bottom. */
  const seen = [...reply.matchAll(/data-rsvp-(line|group)="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(seen, ['line:a:n1', 'line:question', 'line:eyebrow', 'group:g1', 'line:yes', 'line:a:n2', 'line:no']);
  /* The group is one plain div INSIDE the fieldset, round its two lines — and No is outside it, in the same fieldset. */
  const group = /<div data-rsvp-group="g1" class="[^"]*">([\s\S]*?)<\/div>/.exec(reply)![1]!;
  assert.match(group, /^<label data-rsvp-line="yes"[\s\S]*<\/label><p data-rsvp-line="a:n2"[^>]*>Kindly reply by 12 November &amp; bring a jacket &lt;3<\/p>$/);
  assert.ok(reply.indexOf('data-rsvp-line="no"') > reply.indexOf('</div>'));
  assert.match(reply, /<p data-rsvp-line="a:n1" class="font-serif[^"]*">A note from us<\/p>/);
  /* Its background is a rule of the look's one <style>, from the fixed list. */
  assert.match(rsvpLookCss(look, ['rsvp'], []), /\[data-rsvp-group="g1"\]\{background:var\(--sn-glass-bg\)!important;/);
});
