/**
 * the-rsvp-card-edit-posts-what-the-list-posted.test.ts — THE FORM'S SETTINGS MOVED FROM STYLE'S SCROLLING LIST TO THE
 * CARD'S EDIT ROWS, AND EVERY PICK STILL POSTS EXACTLY WHAT IT POSTED.
 *
 * Owner, of this panel (2026-10-09, verbatim): *"why is this scrolling? the bottom toolbar is not aligned to our
 * design"* — RSVP › Card › Style was seven rows, 385 px in a 210-px box. They are the form's SETTINGS, not its style:
 * on the new Maker's RSVP stage they are the card's Edit now, in the toolbar's rows 1–3 (`RsvpCardEditRows`,
 * `rsvp-line-look.tsx`), over Edit's own last row.
 *
 * A GOLDEN TEST, EXECUTED — the real panel is drawn for the card's Edit, the writers it hands the toolbar's rows are
 * taken as they are, each is PRESSED, and what reaches the draft door is compared, byte for byte, with what the same
 * pick has always posted (the whole `rsvp_ask_config`, through `intent=save`, held, with the Apply count asked for):
 *
 *   1 · How guests answer → One by one        { oneAtATime: true }                       and the same answer again posts NOTHING
 *   2 · RSVP asks → untick Meal               { meal: false }                            tick Song request → { song_request: true }
 *   3 · How guests get in → each of the five  `guestsGetInPatch(choice)`, the shared writer's own keys; the stored one posts NOTHING
 *   4 · THE ROWS — each control of the three rows is the toolbar's dropdown on the SHARED part's own choices and writer
 *       (executed on the element tree: no second list of the six, no second list of the five), the asks' ticks are
 *       exactly what is on, and its face reads how many.
 *   5 · WIRING — the panel hands the rows the SAME functions the list's controls call, and Reply by is the list's own row.
 *
 * Sabotages seen red (each restored): the answer's dropdown writing `oneAtATime: !next` · the asks' dropdown sending
 * the tick's old value · get-in handed a second writer · the stored answer written again.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { RSVP_ASK_FIELDS, RSVP_ASK_LABEL, type RsvpAskConfig } from './rsvp-ask';
import { GUESTS_GET_IN_CHOICES, GUESTS_GET_IN_LABEL, guestsGetInLabel, guestsGetInOptions, guestsGetInPatch, readGuestsGetIn } from './who-can-reply';
import { HUB_DRAFT_BAR_FIELD } from './maker-refresh';

(globalThis as { React?: typeof React }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── the rows are caught as the panel hands them their writers ─────────────────────────────────────────────────── */
type RowsProps = {
  replyBy: React.ReactNode;
  answer: { label: string; value: string; options: ReadonlyArray<{ key: string; label: string }>; onPick: (key: string) => void };
  getIn: { value: string; onPick: (next: string) => void };
  asks: { config: RsvpAskConfig; onToggle: (field: string, next: boolean) => void };
};
let caught: RowsProps | null = null;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    const real = load.call(this, request, ...rest);
    /* The panel's own import of the toolbar's rows: the SAME module, with the card's rows caught on their way in. */
    if (request === './rsvp-line-look' && !caughtOff) {
      return new Proxy(real, {
        get(target, key) {
          if (key !== 'RsvpCardEditRows') return target[key as keyof typeof target];
          return (props: RowsProps) => {
            caught = props;
            return null;
          };
        },
      });
    }
    return real;
  };
}
let caughtOff = false;
/* The stage's save shows a change on the page first (`RSVP_PREVIEW_EVENT`): a window to say it to. */
(globalThis as { window?: unknown }).window ??= { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {}, setTimeout, clearTimeout, location: { origin: 'http://test' } };

type Post = { eventId: string; intent: unknown; bar: unknown; config: RsvpAskConfig };
/** Draw the card's Edit over `current`, and hand back its writers and everything they post. */
async function cardEdit(current: RsvpAskConfig) {
  const posts: Post[] = [];
  const draftAction = async (eventId: string, fd: FormData) => {
    const patch = JSON.parse(String(fd.get('patch'))) as { events: { rsvp_ask_config: RsvpAskConfig } };
    assert.deepEqual(Object.keys(patch), ['events'], 'the save writes something beside the event');
    assert.deepEqual(Object.keys(patch.events), ['rsvp_ask_config'], 'the save writes another column');
    posts.push({ eventId, intent: fd.get('intent'), bar: fd.get(HUB_DRAFT_BAR_FIELD), config: patch.events.rsvp_ask_config });
    return { ok: true, intent: 'save' };
  };
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${L}/maker-rsvp-ask`);
  caught = null;
  renderToStaticMarkup(
    React.createElement(MakerRsvpSettings as React.FC<Record<string, unknown>>, {
      eventId: 'e-1',
      current,
      drafted: false,
      replyBy: { date: '2026-11-18', isDefault: false },
      replyByOwn: { deadline: '2026-11-18', pricingMode: 'final_only' },
      requests: { count: null, list: null },
      scene: 'form',
      picked: { tool: 'edit', part: 'rsvp', line: null },
      draftAction,
    }),
  );
  assert.ok(caught, 'the card’s Edit did not draw the toolbar’s rows');
  /** Every save waits a beat for a newer change (`makerLatestWrite`) — until it has landed. */
  const landed = async (n: number) => {
    for (let i = 0; i < 80 && posts.length < n; i += 1) await new Promise((r) => setTimeout(r, 25));
    await new Promise((r) => setTimeout(r, 30));
  };
  return { rows: caught as RowsProps, posts, landed };
}
const GOLD = { eventId: 'e-1', intent: 'save', bar: '1' } as const;

test('1 · How guests answer: One by one posts { oneAtATime: true } over the whole config — and the stored answer posts nothing', async () => {
  const had: RsvpAskConfig = { meal: false, words: { attending: 'Count me in' } };
  const a = await cardEdit(had);
  assert.equal(a.rows.answer.value, 'all', 'the dropdown does not read the stored answer');
  assert.deepEqual(a.rows.answer.options.map((o) => [o.key, o.label]), [['all', 'All at once'], ['one', 'One by one']]);
  a.rows.answer.onPick('one');
  await a.landed(1);
  assert.deepEqual(a.posts, [{ ...GOLD, config: { ...had, oneAtATime: true } }], 'the pick posts something other than the whole config with oneAtATime');
  /* The answer already stored writes nothing (a pick of the choice on show is not a change). */
  const same = await cardEdit({ oneAtATime: true });
  assert.equal(same.rows.answer.value, 'one');
  same.rows.answer.onPick('one');
  await new Promise((r) => setTimeout(r, 500));
  assert.deepEqual(same.posts, [], 'the stored answer was written again');
  /* …and back to All at once. */
  same.rows.answer.onPick('all');
  await same.landed(1);
  assert.deepEqual(same.posts, [{ ...GOLD, config: { oneAtATime: false } }]);
});

test('2 · RSVP asks: a tick posts that one question, on or off, over the whole config', async () => {
  /* (Each case starts from a config of its own: the Maker keeps its copy of a draft per server value —
     `maker-draft-store.ts` — and one case must not start from another's.) */
  const had: RsvpAskConfig = { oneAtATime: true, song_request: false };
  const a = await cardEdit(had);
  assert.deepEqual(a.rows.asks.config, had, 'the asks are not read from the one config');
  a.rows.asks.onToggle('meal', false);
  await a.landed(1);
  assert.deepEqual(a.posts, [{ ...GOLD, config: { ...had, meal: false } }]);
  const had2: RsvpAskConfig = { song_request: false, dietary: false };
  const b = await cardEdit(had2);
  b.rows.asks.onToggle('song_request', true);
  await b.landed(1);
  assert.deepEqual(b.posts, [{ ...GOLD, config: { ...had2, song_request: true } }]);
});

test('3 · How guests get in: each choice posts the shared writer’s own keys', async () => {
  for (const c of GUESTS_GET_IN_CHOICES) {
    const had: RsvpAskConfig = { meal: false, words: { attending: `Yes — ${c.value}` } };
    const a = await cardEdit(had);
    assert.equal(a.rows.getIn.value, readGuestsGetIn(had), 'the dropdown does not read the stored choice');
    a.rows.getIn.onPick(c.value);
    await a.landed(1);
    assert.deepEqual(a.posts, [{ ...GOLD, config: { ...had, ...guestsGetInPatch(c.value) } }], `${c.value}: the pick posts something other than guestsGetInPatch`);
  }
});

/* ── 4 · the rows themselves, executed on the element tree (no hooks: they only place the controls) ───────────── */
type El = React.ReactElement<Record<string, unknown>>;
const isEl = (n: unknown): n is El => Boolean(n) && typeof n === 'object' && 'props' in (n as object);
function walk(node: unknown, out: El[] = []): El[] {
  if (Array.isArray(node)) node.forEach((n) => walk(n, out));
  else if (isEl(node)) {
    out.push(node);
    walk(node.props.children, out);
  }
  return out;
}

test('4 · the three rows are the toolbar’s dropdown on the shared parts’ own choices and writers', async () => {
  caughtOff = true;
  const look = await import(`../${L}/rsvp-line-look`);
  const picked: unknown[][] = [];
  const spy = (name: string) => (...args: unknown[]) => void picked.push([name, ...args]);
  const replyBy = React.createElement('i', { 'data-reply-by-row': '' });
  const tree = walk(
    look.RsvpCardEditRows({
      replyBy,
      answer: { label: 'How guests answer', value: 'all', options: [{ key: 'all', label: 'All at once' }, { key: 'one', label: 'One by one' }], onPick: spy('answer') },
      getIn: { value: 'list', onPick: spy('getIn') },
      asks: { config: { meal: false }, onToggle: spy('asks') },
    }),
  );
  const row = (at: string) => tree.find((e) => e.props['data-rsvp-row'] === at);
  const inRow = (at: string) => walk(row(at)?.props.children);
  assert.deepEqual(tree.filter((e) => e.props['data-rsvp-row']).map((e) => [e.props['data-rsvp-row'], e.props['data-rsvp-card-edit']]), [['1', 'reply-by'], ['2', 'answer-and-asks'], ['3', 'get-in']]);
  /* Row 1 is the caller's own Reply by row — nothing drawn in its place. */
  assert.deepEqual(inRow('1'), [replyBy], 'row 1 is not the list’s own Reply by row');
  /* Row 2, first half: the answer, the toolbar's dropdown with its name inside. */
  const [answer, asksPart] = inRow('2');
  assert.equal(answer!.type, (await import(`../${L}/stage-panel/kit`)).Dd, 'the answer is not the toolbar’s dropdown');
  assert.equal(answer!.props.stacked, true);
  assert.equal(answer!.props.small, 'How guests answer');
  (answer!.props.onPick as (k: string) => void)('one');
  assert.deepEqual(picked.pop(), ['answer', 'one']);
  /* Row 2, second half: the SHARED asks part, framed as ONE dropdown with a tick each. */
  const asksFrame = asksPart!.props.frame as (row: Record<string, unknown>) => El;
  assert.equal(typeof asksFrame, 'function', 'the asks are not the shared part');
  assert.equal(asksPart!.props.onToggle !== undefined && asksPart!.props.config !== undefined, true);
  const asks = RSVP_ASK_FIELDS.map((key) => ({ key, label: RSVP_ASK_LABEL[key] }));
  const on = RSVP_ASK_FIELDS.filter((f) => f !== 'meal');
  const toggled: unknown[][] = [];
  const dd = asksFrame({ name: 'RSVP asks', line: '', chips: null, attrs: {}, asks, on, onToggle: (...a: unknown[]) => void toggled.push(a) });
  assert.equal(dd.props.stacked, true);
  assert.equal(dd.props.small, 'RSVP asks');
  assert.equal(dd.props.options, asks, 'the dropdown lists something other than the part’s six');
  assert.equal(dd.props.picked, on, 'the ticks are not exactly what is on');
  assert.equal(dd.props.buttonText, `${on.length} of ${asks.length} on`, 'the face does not read how many are on');
  assert.equal(look.rsvpAsksFace(0, 6), 'None');
  (dd.props.onPick as (k: string) => void)('meal');
  (dd.props.onPick as (k: string) => void)('song_request');
  (dd.props.onPick as (k: string) => void)('not-a-question');
  assert.deepEqual(toggled, [['meal', true], ['song_request', false]], 'a tick does not flip exactly that question');
  /* Row 3: the SHARED get-in part, framed as the toolbar's dropdown — its own five choices, its own writer, its own face. */
  const [getIn] = inRow('3');
  assert.equal(getIn!.props.value, 'list');
  (getIn!.props.onPick as (k: string) => void)('one_qr');
  assert.deepEqual(picked.pop(), ['getIn', 'one_qr']);
  const options = guestsGetInOptions();
  const chosen: string[] = [];
  const gdd = (getIn!.props.frame as (row: Record<string, unknown>) => El)({ name: GUESTS_GET_IN_LABEL, value: 'list', buttonText: guestsGetInLabel('list'), hint: '', options, onPick: (k: string) => void chosen.push(k), dataAttr: '', attrs: {} });
  assert.equal(gdd.props.small, GUESTS_GET_IN_LABEL);
  assert.equal(gdd.props.options, options, 'the dropdown lists something other than the part’s five');
  assert.equal(gdd.props.buttonText, guestsGetInLabel('list'));
  assert.equal(gdd.props.picked, undefined, 'get-in is one choice, never ticks');
  (gdd.props.onPick as (k: string) => void)('requests');
  assert.deepEqual(chosen, ['requests']);
});

test('5 · WIRING: the rows are handed the SAME writers the list’s controls call, and Reply by is the list’s own row', () => {
  const panel = src(`${L}/maker-rsvp-ask.tsx`);
  /* The list's controls… */
  assert.match(panel, /<PillSelector[\s\S]{0,260}?onPick=\{pickAnswer\}/, 'the list’s pill has a writer of its own');
  assert.match(panel, /const getInRow = <GuestsGetIn frame=\{getInFrame\} value=\{getInNow\} onPick=\{pickGetIn\} \/>;/);
  assert.match(panel, /const asksRow = <RsvpAsks frame=\{asksFrame\} config=\{local\} onToggle=\{toggleAsk\} \/>;/);
  /* …and the card's Edit rows: the same four things, word for word. */
  assert.match(
    panel,
    /<RsvpCardEditRows\s+replyBy=\{replyByRow\}\s+answer=\{\{ label: HOW_GUESTS_ANSWER_LABEL, value: oneAtATime \? 'one' : 'all', options: HOW_GUESTS_ANSWER_OPTIONS, onPick: pickAnswer \}\}\s+getIn=\{\{ value: getInNow, onPick: pickGetIn \}\}\s+asks=\{\{ config: local, onToggle: toggleAsk \}\}/,
    'the card’s Edit is handed a writer of its own',
  );
  assert.equal((panel.match(/<RsvpCardEditRows\b/g) ?? []).length, 1);
  /* Only for the FORM's card, on Edit, in the new Maker's stage. */
  assert.match(panel, /if \(picked\.tool === 'edit' && scene === 'form' && picked\.part === 'rsvp' && !picked\.line\) \{/);
  /* The rows mount the shared parts — never a list of the six or of the five of their own. */
  const rows = src(`${L}/rsvp-line-look.tsx`);
  assert.match(rows, /import \{ GuestsGetIn, RsvpAsks \} from '\.\.\/\.\.\/_components\/guest-setup\/guest-setup-lazy';/);
  assert.doesNotMatch(rows, /RSVP_ASK_FIELDS|RSVP_ASK_LABEL|guestsGetInOptions\(|GUESTS_GET_IN_CHOICES|<PickMenu\b|<select\b|type="checkbox"/, 'the toolbar’s rows list the choices themselves, or draw a control of their own');
  /* The toolbar's dropdown takes its ticks from the shipped PickMenu's own mode. */
  assert.match(src(`${L}/stage-panel/kit.tsx`), /<PickMenu label=\{label\} value=\{value\} options=\{options\} onPick=\{onPick\} buttonText=\{buttonText\} picked=\{picked\} /);
});
