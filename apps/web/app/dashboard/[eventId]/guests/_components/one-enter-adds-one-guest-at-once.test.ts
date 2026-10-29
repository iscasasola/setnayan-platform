/**
 * one-enter-adds-one-guest-at-once.test.ts — ONE ENTER ADDS ONE GUEST, AND THE NAME IS ON THE LIST BEFORE THE SERVER
 * ANSWERS (owner 2026-10-19, adding guests on his phone and laptop: *"why does it take a lot of seconds before the name.
 * and need to enter button twice to add … adding multiple person needs to be fast and easy"*, *"we want to see added name
 * realtime and fast"*, *"i type a name and it is not found there. when i press enter that should add that person there
 * already"*).
 *
 * ── The defects (measured in the lab, `/dev/guests-lab?part=screen&addMs=1200`, Chromium 375 · WebKit iPhone 13 · 1280) ──
 *   · Enter in "Search or add" on a name nobody has opened the add SHEET with the name in it — a second Enter was needed;
 *   · the name was drawn only when the server answered, and that answer carried a redraw of the whole Guests page;
 *   · the sheet's box refused an Enter while the previous add was out: of ten names typed in a row, ONE was written,
 *     eight were dropped without a word, one came back cut ("un Yap").
 *
 * ── What is proven, and how ─────────────────────────────────────────────────────────────────────────────────────────
 * BEHAVIOUR (the real queue, driven with real promises — `createAddQueue`):
 *   1 · a queued name is in the snapshot, "saving", BEFORE its write answers;
 *   2 · ten queued names: ten writes, started in the order typed, never two in flight, none lost, none twice;
 *   3 · a refused write STAYS ("failed", the plain sentence) and the next name is still written; a throw is a refusal
 *       in the fallback sentence; Retry sends it again; Remove takes only a refused name;
 *   4 · the list re-reads ONCE for ten names, after the last — never once per add;
 *   5 · a re-read that holds the saved guest lets the waiting row step aside (`landed`);
 *   6 · `queueTypedGuest`: one Enter = one queued write, sent with `{ refresh: false }`; a line without both names is
 *       never queued and says so;
 *   7 · a filter word that finds nobody ("best man", "no reply", "ninongs", a group's name) is not a name.
 * THE PROPERTY (read from the source, comments stripped):
 *   8 · the search box's Enter adds through the queue and never opens the add sheet;
 *   9 · no add path waits for its write before taking the next name: the name box and Quick add hold no `await`, no
 *       transition and no in-flight refusal on their add;
 *  10 · the two add actions skip the page redraw exactly when asked (`refresh: false`).
 *
 * ── Caveats — read before trusting a green run ───────────────────────────────────────────────────────────────────────
 *   · No browser runs here; that the row is PAINTED within a frame is the lab trace's claim (the PR body's numbers),
 *     not this file's. § 8–10 read source, so a rewrite that keeps the shape but changes the meaning can pass.
 *   · A write whose request dropped AFTER the server had it is "failed" here; Retry can then add the name twice until
 *     the list re-reads (the same caveat as a-failed-press-keeps-the-sheet.test.ts).
 *
 * Sabotage (2026-10-19, each on the real file, restored with git checkout): see the PR body's table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { createAddQueue, NEEDS_BOTH_NAMES, picksForAdd, queueTypedGuest, withPicks } from './guest-add-queue';
import { runAddSingleGuest } from '@/lib/add-single-guest-core';
import type { ParsedGuestDraft } from '@/lib/guest-parse';
import { typedLineIsAFilter } from '@/lib/guest-roster-view';
import type { QuickAddResult } from '../quick-add-actions';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const tick = () => new Promise((r) => setTimeout(r, 0));

type Deferred = { name: string; resolve: (r: QuickAddResult) => void; reject: (e: unknown) => void };
function harness() {
  const calls: Deferred[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let refreshes = 0;
  const q = createAddQueue();
  q.setRefresher(() => (refreshes += 1));
  const run = (name: string) => () =>
    new Promise<QuickAddResult>((resolve, reject) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      calls.push({
        name,
        resolve: (r) => {
          inFlight -= 1;
          resolve(r);
        },
        reject: (e) => {
          inFlight -= 1;
          reject(e);
        },
      });
    });
  const ok = (name: string, id: string): QuickAddResult => ({ ok: true, guest: { guest_id: id, first_name: name, last_name: 'X', side: 'both', role: 'guest' } });
  return { q, calls, run, ok, stats: () => ({ inFlight, maxInFlight, refreshes }) };
}

test('1 · a queued name is on screen, saving, before its write answers', async () => {
  const h = harness();
  h.q.enqueue({ eventId: 'e', name: 'Rosa Magbanua', run: h.run('Rosa Magbanua') });
  const now = h.q.snapshot();
  assert.equal(now.length, 1, 'the name is not drawn until the server answers');
  assert.equal(now[0]!.name, 'Rosa Magbanua');
  assert.equal(now[0]!.status, 'saving');
  await tick();
  assert.equal(h.calls.length, 1, 'the write did not start');
  assert.equal(h.q.snapshot()[0]!.status, 'saving', 'a write still out reads as done');
  h.calls[0]!.resolve(h.ok('Rosa', 'g-1'));
  await tick();
  assert.equal(h.q.snapshot()[0]!.status, 'saved');
  assert.equal(h.q.snapshot()[0]!.guestId, 'g-1');
});

test('2 · ten names typed in a row: ten writes, in order, one at a time, none lost, none twice', async () => {
  const h = harness();
  const names = Array.from({ length: 10 }, (_, i) => `Guest ${i + 1} Cruz`);
  for (const n of names) h.q.enqueue({ eventId: 'e', name: n, run: h.run(n) });
  assert.equal(h.q.snapshot().length, 10, 'a name typed while another was saving was not drawn');
  for (let i = 0; i < 10; i++) {
    await tick();
    assert.equal(h.calls.length, i + 1, `write ${i + 1} did not start once the one before it answered`);
    h.calls[i]!.resolve(h.ok(names[i]!, `g-${i}`));
  }
  await tick();
  assert.deepEqual(h.calls.map((c) => c.name), names, 'the writes were not in the order typed');
  assert.equal(h.stats().maxInFlight, 1, 'two writes were out at once');
  assert.equal(new Set(h.calls.map((c) => c.name)).size, 10, 'a name was written twice');
  assert.ok(h.q.snapshot().every((a) => a.status === 'saved'));
});

test('3 · a refused write stays and says why; the next name is still written; Retry · Remove', async () => {
  const h = harness();
  const [a, b, c] = ['Refuse Santos', 'Ben Reyes', 'Throw Lim'];
  const ka = h.q.enqueue({ eventId: 'e', name: a, run: h.run(a) });
  h.q.enqueue({ eventId: 'e', name: b, run: h.run(b) });
  const kc = h.q.enqueue({ eventId: 'e', name: c, run: h.run(c) });
  await tick();
  h.calls[0]!.resolve({ ok: false, error: 'Your guest list is finalized — the guest count is locked.' });
  await tick();
  h.calls[1]!.resolve(h.ok(b, 'g-b'));
  await tick();
  h.calls[2]!.reject(new Error('network'));
  await tick();
  await tick();
  const byName = new Map(h.q.snapshot().map((x) => [x.name, x] as const));
  assert.equal(byName.get(a)?.status, 'failed', 'a refused name vanished or read as saved');
  assert.equal(byName.get(a)?.error, 'Your guest list is finalized — the guest count is locked.');
  assert.equal(byName.get(b)?.status, 'saved', 'a refusal stopped the next name');
  assert.equal(byName.get(c)?.status, 'failed', 'a failed request read as saved');
  assert.equal(byName.get(c)?.error, 'Couldn’t add Throw Lim — no connection.', 'a request that never answered does not say so by name');
  h.q.retry(ka);
  await tick();
  assert.equal(h.calls.length, 4, 'Retry did not send it again');
  assert.equal(h.calls[3]!.name, a);
  h.calls[3]!.resolve(h.ok(a, 'g-a'));
  await tick();
  h.q.remove(byName.get(b)!.key);
  assert.ok(h.q.snapshot().some((x) => x.name === b), 'Remove dropped a SAVED name');
  h.q.remove(kc);
  assert.ok(!h.q.snapshot().some((x) => x.name === c), 'Remove did not let a refused name go');
});

test('4 · the list re-reads ONCE for ten names, after the last — never once per add', async () => {
  const h = harness();
  for (let i = 0; i < 10; i++) h.q.enqueue({ eventId: 'e', name: `N${i} X`, run: h.run(`N${i}`) });
  for (let i = 0; i < 10; i++) {
    await tick();
    assert.equal(h.stats().refreshes, 0, `the list re-read while name ${i + 1} was still to be written`);
    h.calls[i]!.resolve(h.ok(`N${i}`, `g-${i}`));
  }
  await tick();
  await tick();
  assert.equal(h.stats().refreshes, 1, 'ten names did not cost exactly one re-read');
});

test('5 · a re-read list that holds the saved guest lets the waiting row step aside', async () => {
  const h = harness();
  h.q.enqueue({ eventId: 'e', name: 'Ana Cruz', run: h.run('Ana') });
  await tick();
  h.calls[0]!.resolve(h.ok('Ana', 'g-ana'));
  await tick();
  h.q.reconcile(['g-other']);
  assert.equal(h.q.snapshot()[0]!.landed, false, 'a row stepped aside before the list held the guest');
  h.q.reconcile(['g-other', 'g-ana']);
  assert.equal(h.q.snapshot()[0]!.landed, true);
});

test('6 · queueTypedGuest: one Enter = one write, sent asking for no redraw; a lone name is told and never sent', async () => {
  const q = createAddQueue();
  const sent: Array<{ first: string; last: string; refresh: unknown }> = [];
  const add = async (_e: string, d: { firstName: string; lastName: string }, opts?: { refresh?: boolean }): Promise<QuickAddResult> => {
    sent.push({ first: d.firstName, last: d.lastName, refresh: opts?.refresh });
    return { ok: true, guest: { guest_id: `g-${sent.length}`, first_name: d.firstName, last_name: d.lastName, side: 'both', role: 'guest' } };
  };
  const one = queueTypedGuest('e', 'Lolita', 'both', add as never, q);
  assert.deepEqual(one, { ok: false, error: NEEDS_BOTH_NAMES });
  for (let i = 0; i < 3; i++) assert.ok(queueTypedGuest('e', ['Ana Cruz', 'Ben Reyes', 'Atty. (Woman) Eufemia Dela Cruz'][i]!, 'both', add as never, q).ok);
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(sent.length, 3, 'three Enters did not make exactly three writes');
  assert.deepEqual(sent.map((s) => s.refresh), [false, false, false], 'a queued add asked the server to redraw the page');
  assert.equal(q.snapshot()[2]!.name.includes('(Woman)'), false, 'the title mark was drawn as part of the name');
});

test('7 · a filter word that found nobody is not a name', () => {
  const facts = { roleNames: null, hasSides: true };
  for (const w of ['best man', 'Flower Girl', 'no reply', 'not coming', 'ninongs', 'VIP', 'to invite', 'brides side', 'Barkada', 'Table 9']) {
    assert.ok(typedLineIsAFilter(w, facts, ['Barkada', 'Table 9']), `"${w}" would be added as a guest`);
  }
  for (const n of ['Rosa Magbanua', 'Nora Santos', 'Juan Dela Cruz', 'Maria Bestman']) {
    assert.equal(typedLineIsAFilter(n, facts, ['Barkada']), false, `"${n}" would never be added`);
  }
});

/** The body of the arrow handed to `onKeyDown` on the element carrying `attr`. */
function keyHandler(src: string, attr: string): string {
  const at = src.indexOf(attr);
  assert.ok(at > 0, `${attr} not found`);
  // A JSX prop (`onKeyDown={…}`) or — since the field is the ONE thumb row's seat (2026-10-22) — an input prop handed
  // to it (`onKeyDown: (e) => {…}`). Either way the handler's body is read whole.
  const jsx = src.indexOf('onKeyDown={', at);
  const prop = src.indexOf('onKeyDown: ', at);
  const k = jsx > 0 && (prop < 0 || jsx < prop) ? jsx : prop;
  assert.ok(k > 0 && k - at < 1200, `no onKeyDown near ${attr}`);
  let depth = 0;
  const from = k === jsx ? k + 'onKeyDown='.length : src.indexOf('{', k);
  for (let i = from; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(k, i + 1);
    }
  }
  throw new Error('unbalanced onKeyDown');
}

/** `const name = useCallback(` → the whole call; `const name = (` → the arrow's `{ … }` body. Balanced, comments stripped. */
function fnBody(src: string, head: string): string {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} not found`);
  const arrow = !head.includes('useCallback');
  const from = arrow ? src.indexOf('{', src.indexOf('=>', at)) : at + head.length - 1;
  const [open, close] = arrow ? ['{', '}'] : ['(', ')'];
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === open) depth += 1;
    else if (src[i] === close) {
      depth -= 1;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error(`unbalanced ${head}`);
}

test('8 · the search box: Enter on a name nobody has adds it through the queue — never the add sheet', () => {
  const src = read('guests-screen.tsx');
  const h = keyHandler(src, "'data-guests-search': ''");
  assert.match(h, /\baddTyped\(/, 'Enter on an unmatched name does not add it');
  assert.doesNotMatch(h, /\bopenAddGuest\(/, 'Enter opens the add sheet — the second Enter is back');
  const add = fnBody(src, 'const addTyped = (');
  assert.match(add, /\bqueueTypedGuest\(/, 'the search box adds outside the ordered queue');
  assert.doesNotMatch(add, /\bawait\b/, 'the search box waits for the write before taking the next name');
});

test('9 · no add path waits for its write, or refuses an Enter while one is out', () => {
  const bar = read('capture-bar.tsx');
  const submit = fnBody(bar, 'const submitAdd = (');
  assert.match(submit, /\bqueueTypedGuest\(/, 'the + sheet box adds outside the ordered queue');
  assert.doesNotMatch(submit, /\bawait\b|\bpending\b|startTransition/, 'the + sheet box waits on, or refuses during, an add in flight');
  assert.match(keyHandler(bar, 'ref={inputRef}'), /submitAdd\(\)/);

  const quick = read('quick-add-sheet.tsx');
  const save = fnBody(quick, 'const doSave = useCallback(');
  assert.match(save, /guestAdds\.enqueue\(/, 'Quick add writes outside the ordered queue');
  assert.match(save, /quickAddGuest\([^)]*\{\s*refresh:\s*false\s*\}\)/, 'Quick add asks for a whole-page redraw per add');
  assert.doesNotMatch(save, /\bawait\b|startTransition/, 'Quick add waits for its write before taking the next name');
  // First name's Enter adds a whole name in ONE press; only a lone first name moves on to Last.
  const first = keyHandler(quick, 'ref={fnRef}');
  assert.match(first, /parts\.firstName && parts\.lastName\) primary\(true\)/, 'a whole name in First needs a second Enter');
});

test('10 · the add actions skip the page redraw exactly when asked', () => {
  const actions = stripComments(readFileSync(join(HERE, '..', 'quick-add-actions.ts'), 'utf8'));
  const quick = actions.slice(actions.indexOf('export async function quickAddGuest('));
  const body = quick.slice(0, quick.indexOf('\nexport '));
  const revals = [...body.matchAll(/revalidatePath\(/g)].length;
  assert.equal(revals, 1, 'quickAddGuest redraws the page on more than one path');
  assert.match(body, /if \(opts\.refresh !== false\) revalidatePath\(/, 'quickAddGuest redraws the page even when asked not to');
  const inline = stripComments(readFileSync(join(HERE, '..', 'inline-actions.ts'), 'utf8'));
  const single = inline.slice(inline.indexOf('export async function addSingleGuest('));
  assert.match(single, /quickAddGuest\(eid, opts\.email \? \{ \.\.\.input, email: opts\.email \} : input, opts\)/, 'addSingleGuest drops the caller’s redraw choice');
  assert.match(single, /if \(opts\.refresh !== false\) revalidatePath\(/, 'addSingleGuest redraws the page even when asked not to');
});

// ── THE ADD CARD (owner 2026-10-20: "they can set the Role, Group, Side, and Plus" · "search also searches the people
// connected to them. From People.") — DECISION_LOG 2026-10-20, prototype frames B2 · B2b. ──────────────────────────────

test('11 · the four picks ride with a typed name; what was TYPED wins, picked groups join typed ones', async () => {
  const q = createAddQueue();
  const drafts: ParsedGuestDraft[] = [];
  const add = async (_e: string, d: ParsedGuestDraft): Promise<QuickAddResult> => {
    drafts.push(d);
    return { ok: true, guest: { guest_id: 'g', first_name: d.firstName, last_name: d.lastName, side: d.side, role: 'guest' } };
  };
  const picks = { role: 'principal_sponsor' as const, groupCategory: 'friends' as const, groupLabels: ['Out of town'], plusOnes: 1, detail: 'Principal Sponsor · Friends · Out of town · +1' };
  assert.ok(queueTypedGuest('e', 'Tita Cora', 'bride', add as never, q, picks).ok);
  assert.ok(queueTypedGuest('e', 'Ana Cruz vip +2 #Choir', 'groom', add as never, q, picks).ok);
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(drafts[0]!.roleHint, 'principal_sponsor', 'the picked Role was not sent');
  assert.equal(drafts[0]!.groupCategory, 'friends', 'the picked standard Group was not sent');
  assert.deepEqual(drafts[0]!.groups, ['Out of town'], 'the picked own group was not sent');
  assert.equal(drafts[0]!.plusOnes, 1, 'the picked Plus was not sent');
  assert.equal(drafts[0]!.side, 'bride', 'the picked Side was not sent');
  assert.equal(drafts[1]!.roleHint, 'vip', 'a typed role lost to the pick');
  assert.equal(drafts[1]!.plusOnes, 2, 'a typed +2 lost to the pick');
  assert.deepEqual(drafts[1]!.groups, ['Choir', 'Out of town']);
  assert.equal(q.snapshot()[0]!.detail, picks.detail, 'the row does not say what it is being added with');
  assert.equal(withPicks({ ...drafts[0]!, roleHint: null }, { role: 'guest' }).roleHint, null, 'a plain Guest pick became a role hint');
});

test('12 · the card\'s words: Plus is the card\'s "Extra seats" (None · +1 … +4); Group is one multi list with ＋ New group…', () => {
  const card = read('search-add-card.tsx');
  assert.match(card, /PLUS_ONE_CHOICES\.map\(\(n\) => \(\{ key: String\(n\), label: n === 0 \? 'None' : `\+\$\{n\}` \}\)\)/, 'Plus does not offer the card’s None · +1 … +4');
  assert.match(card, /label="Group"[\s\S]{0,200}picked=\{/, 'Group is not a ticked (multi) list');
  /* ⤷ 2026-10-20 (#6698): the card's Group IS the guest card's one Group picker — its ＋ New group… is the picker's. */
  assert.match(card, /<GuestGroupPicker\b/, 'the add card does not draw THE one Group picker');
  assert.match(read('guest-group-picker.tsx'), /New group…/, 'Group cannot make a new group in place');
  for (const w of ['Side', 'Role', 'Group', 'Plus']) assert.match(card, new RegExp(`>${w}</span>`), `the card has no ${w}`);
  assert.match(card, /All four stay as picked for the next names\./);
  const roleNames = null;
  const said = picksForAdd({ side: 'bride', role: 'guest', category: 'friends', groupIds: ['g1'], plus: 1 }, [{ group_id: 'g1', label: 'Out of town' }], roleNames);
  assert.equal(said.detail, 'Guest · Friends · Out of town · +1', 'the row’s words differ from the prototype’s');
  assert.deepEqual([said.groupCategory, said.groupLabels, said.plusOnes], ['friends', ['Out of town'], 1]);
});

test('13 · a People match not on the list: Enter adds the FIRST one, through the queue, asking for no redraw', () => {
  const src = read('guests-screen.tsx');
  const h = keyHandler(src, "'data-guests-search': ''");
  const people = h.indexOf('peopleFor(v)');
  assert.ok(people > 0 && people < h.indexOf('addTyped(v)'), 'Enter does not look in People before adding a new name');
  assert.ok(h.indexOf('hits.length === 1') < people, 'a list match no longer wins over People (a duplicate)');
  assert.match(h, /addPerson\(known\[0\]!\)/, 'Enter does not add the first People match');
  const add = fnBody(src, 'const addPerson = (');
  assert.match(add, /guestAdds\.enqueue\(/, 'a People add skips the ordered queue');
  assert.match(add, /addGuestsFromPeople\(eventId, \[\{ key: p\.key \}\], addPicks\.side, \{[\s\S]*refresh: false/, 'a People add is not the shipped add, with the picks and no redraw');
  assert.match(src, /listPeopleYouCanInvite\(eventId\)/, 'the box does not read the SAME People the sheet reads');
  assert.match(read('search-add-card.tsx'), /From your People · not on this list yet/);
  assert.match(src, /`Not them\? Add “\$\{q\}” as new`/);
});

test('14 · the People add with picks goes through the typed-name orchestration, with the address People holds', () => {
  const acts = stripComments(readFileSync(join(HERE, '..', 'people-add-actions.ts'), 'utf8'));
  const branch = acts.slice(acts.indexOf('if (withPicks) {'), acts.indexOf('const res = await quickAddGuest(eventId, {'));
  assert.match(branch, /addSingleGuest\(/, 'the People add with picks does not reuse addSingleGuest (groups · role · +1 seats)');
  assert.match(branch, /\{ refresh: withPicks\.refresh, email: person\.email \}/, 'the People add drops the address or the redraw choice');
  assert.match(acts, /if \(added > 0 && withPicks\?\.refresh !== false\) revalidatePath\(/, 'the People add redraws the page when asked not to');
  const q = stripComments(readFileSync(join(HERE, '..', 'quick-add-actions.ts'), 'utf8'));
  assert.match(q, /Object\.hasOwn\(GROUP_CATEGORY_LABELS, input\.group_category\)/, 'a standard group is written unchecked');
});

test('15 · the standard group reaches the insert only when picked — every earlier caller sends what it sent', async () => {
  const seen: Array<Record<string, unknown>> = [];
  const deps = {
    createGroup: async () => ({ ok: false as const, error: 'x' }),
    addGuest: async (_e: string, input: Record<string, unknown>) => {
      seen.push(input);
      return { ok: true as const, guest: { guest_id: 'g', first_name: 'A', last_name: 'B', side: 'both' as const, role: 'guest' as const } };
    },
    resolveOfferedRoles: async () => [],
    attachMembership: async () => undefined,
    setPlusOne: async () => undefined,
    deleteEmptyGroup: async () => undefined,
    revalidate: () => undefined,
  };
  const base = { prefix: '', firstName: 'Ana', middleName: '', lastName: 'Cruz', suffix: '', side: 'both' as const, plusOnes: 0, groups: [], roleHint: null };
  await runAddSingleGuest('e', base, deps as never);
  await runAddSingleGuest('e', { ...base, groupCategory: 'family' }, deps as never);
  assert.equal('group_category' in seen[0]!, false, 'an add with no pick now sends a standard group');
  assert.equal(seen[1]!.group_category, 'family', 'the picked standard group never reaches the insert');
});

test('16 · "Ninang Rose" is added as a name (B4), and the row says what was really sent', async () => {
  const q = createAddQueue();
  const drafts: ParsedGuestDraft[] = [];
  const add = async (_e: string, d: ParsedGuestDraft): Promise<QuickAddResult> => {
    drafts.push(d);
    return { ok: true, guest: { guest_id: 'g', first_name: d.firstName, last_name: d.lastName, side: d.side, role: 'guest' } };
  };
  const p = picksForAdd({ side: 'bride', role: 'guest', category: 'friends', groupIds: [], plus: 0 }, [], null);
  assert.ok(queueTypedGuest('e', 'Ninang Rose', 'bride', add as never, q, p).ok, '"Ninang Rose" is refused as half a name');
  assert.ok(queueTypedGuest('e', 'Ana Cruz vip +2', 'bride', add as never, q, p).ok);
  for (let i = 0; i < 6; i++) await tick();
  assert.deepEqual([drafts[0]!.firstName, drafts[0]!.lastName, drafts[0]!.roleHint], ['Ninang', 'Rose', null]);
  assert.equal(q.snapshot()[0]!.name, 'Ninang Rose');
  assert.equal(q.snapshot()[1]!.detail, 'VIP · Friends · +2', 'the row says the picks, not what was sent');
  assert.deepEqual(queueTypedGuest('e', 'Rose', 'bride', add as never, q, p), { ok: false, error: NEEDS_BOTH_NAMES });
});
