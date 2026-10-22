/**
 * GUARD — AN EVENT FOR SOMEBODY YOU HOLD SAYS WHO (owner 22 Oct 2026, "yes to all";
 * prototypes/for_tag_on_event_cards_2026-10-22.html).
 *
 * The properties held here (each sabotaged RED, then restored — see the PR body):
 *   1. THE NAME RESOLVES ONLY FOR THE ACCOUNT THAT HOLDS THE SUBJECT: the dependents read carries
 *      `owner_user_id = viewer` and `handed_over_at IS NULL`; a record that does not come back
 *      gives no tag; the id is read through `events_host`, never `events` (no SELECT there).
 *   2. A FAILED READ NEVER PRINTS A WRONG NAME: a refused events_host / dependents read → no tag
 *      (the stance chip stays); a refused shop read keeps the RECORD's name and drops only the logo.
 *   3. ONLY AN ORGANISER'S CARD SAYS "FOR": a helper's or a guest's card keeps its stance chip.
 *   4. THE CARD STAYS AT TWO CHIPS: the tag is drawn INSIDE the stance slot (StanceChip), never as
 *      a third kicker entry; and only on a POSTER card on the Planning page.
 *   5. HOME: one line under the name, only when there is a subject; the eyebrow is untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { readEventSubjects, cardShowsForTag } from '@/lib/event-subjects';
import { forTagWords } from '@/lib/for-tag';
import { homeCoverWords } from '@/lib/home-cover-words';
import { ForTagMark } from '@/app/_components/for-tag-mark';
import { HomeCoverBand } from '@/app/dashboard/[eventId]/_components/home-cover-band';

(globalThis as unknown as { React: unknown }).React = React;

const VIEWER = '11111111-1111-4111-8111-111111111111';
const SHOP_DEP = '22222222-2222-4222-8222-222222222222';
const LOLA_DEP = '33333333-3333-4333-8333-333333333333';
const OTHERS_DEP = '44444444-4444-4444-8444-444444444444';
const SHOP = '55555555-5555-4555-8555-555555555555';

type Call = { table: string; filters: Array<[string, ...unknown[]]> };
type Tables = Record<string, { data?: unknown[]; error?: { message: string } | null }>;

/** A PostgREST stand-in that records every predicate and answers per table, honouring `.in` / `.eq`. */
function fakeClient(tables: Tables) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, filters: [] };
      calls.push(call);
      const b = {
        select: () => b,
        in: (col: string, vals: unknown[]) => (call.filters.push(['in', col, vals]), b),
        eq: (col: string, val: unknown) => (call.filters.push(['eq', col, val]), b),
        is: (col: string, val: unknown) => (call.filters.push(['is', col, val]), b),
        not: (col: string, op: string, val: unknown) => (call.filters.push(['not', col, op, val]), b),
        then(resolve: (v: unknown) => void) {
          const t = tables[table] ?? { data: [] };
          if (t.error) return resolve({ data: null, error: t.error });
          let rows = (t.data ?? []) as Array<Record<string, unknown>>;
          for (const [op, col, val] of call.filters) {
            if (op === 'in') rows = rows.filter((r) => (val as unknown[]).includes(r[col as string]));
            if (op === 'eq') rows = rows.filter((r) => r[col as string] === val);
          }
          resolve({ data: rows, error: null });
        },
      };
      return b;
    },
  };
  return { client: client as never, calls };
}

const EVENTS_HOST = {
  data: [
    { event_id: 'gala', honoree_dependent_id: SHOP_DEP },
    { event_id: 'lola', honoree_dependent_id: LOLA_DEP },
    { event_id: 'theirs', honoree_dependent_id: OTHERS_DEP },
  ],
};
const DEPENDENTS = {
  data: [
    { dependent_id: SHOP_DEP, owner_user_id: VIEWER, name: 'SetnaProd old', dependent_kind: 'business', vendor_profile_id: SHOP },
    { dependent_id: LOLA_DEP, owner_user_id: VIEWER, name: 'Lola Nena', dependent_kind: 'person', vendor_profile_id: null },
    { dependent_id: OTHERS_DEP, owner_user_id: 'someone-else', name: 'Not Yours', dependent_kind: 'person', vendor_profile_id: null },
  ],
};
const SHOPS = { data: [{ vendor_profile_id: SHOP, business_name: 'SetnaProd', logo_url: 'r2://setnayan-public/logo.png' }] };

test('1 · the name resolves only for the account that holds the subject', async () => {
  const { client, calls } = fakeClient({ events_host: EVENTS_HOST, dependents: DEPENDENTS, vendor_profiles: SHOPS });
  const got = await readEventSubjects(client, { userId: VIEWER, eventIds: ['gala', 'lola', 'theirs', 'plain'] });
  assert.deepEqual(got.get('gala'), { name: 'SetnaProd', kind: 'business', logoRef: 'r2://setnayan-public/logo.png' });
  assert.deepEqual(got.get('lola'), { name: 'Lola Nena', kind: 'person', logoRef: null });
  assert.equal(got.has('theirs'), false, "somebody else's record named a card");
  assert.equal(got.has('plain'), false);
  const dep = calls.find((c) => c.table === 'dependents');
  assert.ok(dep, 'dependents was not read');
  assert.ok(dep.filters.some(([op, col, v]) => op === 'eq' && col === 'owner_user_id' && v === VIEWER), 'the owner predicate is gone');
  assert.ok(dep.filters.some(([op, col, v]) => op === 'is' && col === 'handed_over_at' && v === null), 'a handed-over record would still name the card');
  assert.ok(calls.every((c) => c.table !== 'events'), 'events.honoree_dependent_id has no SELECT for authenticated — read events_host');
});

test('2 · a failed read never prints a wrong name', async () => {
  for (const refused of ['events_host', 'dependents'] as const) {
    const tables: Tables = { events_host: EVENTS_HOST, dependents: DEPENDENTS, vendor_profiles: SHOPS };
    tables[refused] = { error: { message: 'permission denied' } };
    const { client } = fakeClient(tables);
    const got = await readEventSubjects(client, { userId: VIEWER, eventIds: ['gala', 'lola'] });
    assert.equal(got.size, 0, `a refused ${refused} read still drew a tag`);
  }
  const { client } = fakeClient({ events_host: EVENTS_HOST, dependents: DEPENDENTS, vendor_profiles: { error: { message: 'nope' } } });
  const got = await readEventSubjects(client, { userId: VIEWER, eventIds: ['gala'] });
  assert.deepEqual(got.get('gala'), { name: 'SetnaProd old', kind: 'business', logoRef: null }, 'a refused shop read must keep the record name and draw initials');
  const none = await readEventSubjects(fakeClient({}).client, { userId: '', eventIds: ['gala'] });
  assert.equal(none.size, 0);
});

test('3 · only an organiser card says "For"', () => {
  const s = { name: 'SetnaProd' };
  assert.equal(cardShowsForTag('organiser', s), true);
  assert.equal(cardShowsForTag('helper', s), false);
  assert.equal(cardShowsForTag('invited', s), false);
  assert.equal(cardShowsForTag(null, s), false);
  assert.equal(cardShowsForTag('organiser', null), false);
  assert.equal(cardShowsForTag('organiser', { name: '  ' }), false);
  assert.equal(forTagWords(' SetnaProd '), 'For SetnaProd');
});

test('3b · the mark: a shop wears its logo, a loved one their initials', () => {
  const logo = renderToStaticMarkup(React.createElement(ForTagMark, { tag: { name: 'SetnaProd', markUrl: 'https://x/l.png' }, place: 'chip' }));
  assert.match(logo, /data-for-mark="logo"/);
  assert.match(logo, /src="https:\/\/x\/l\.png"/);
  const ini = renderToStaticMarkup(React.createElement(ForTagMark, { tag: { name: 'Lola Nena', markUrl: null }, place: 'band' }));
  assert.match(ini, /data-for-mark="initials"[^>]*>LN</);
});

test('4 · the board card stays at two chips — the tag lives in the stance slot, on a Planning poster', () => {
  const page = stripComments(readFileSync('app/dashboard/(launcher)/page.tsx', 'utf8'));
  const chip = page.slice(page.indexOf('function StanceChip('), page.indexOf('async function GlassEventCard('));
  assert.ok(chip.length > 0 && /<ForTagMark tag=\{forTag\} place="chip" \/>/.test(chip), 'StanceChip no longer draws the For mark');
  assert.equal(page.match(/<ForTagMark\b/g)?.length ?? 0, 1, 'the For mark is drawn outside the stance slot — a third chip');
  const kickers = page.match(/kicker=\{[^\n]*\n?/g) ?? [];
  assert.equal(kickers.length, 1);
  assert.match(kickers[0]!, /^kicker=\{stance \? \[badge, <StanceChip stance=\{stance\} forTag=\{tagged\} key="stance" \/>\] : \[badge\]\}/);
  assert.match(page, /const tagged = poster && forTag && cardShowsForTag\(stance, forTag\) \? forTag : null;/, 'the tag is no longer limited to an organiser poster card');
  assert.equal(page.match(/forTag=\{forTagById\.get\(event\.event_id\) \?\? null\}/g)?.length ?? 0, 1, 'the tag reaches a shelf other than Planning');
  assert.match(page, /upcomingOnPage\.filter\(\(e\) => e\.member_type === 'couple'\)\.map\(\(e\) => e\.event_id\)/);
});

test('5 · Home: one line under the name, only with a subject; the eyebrow untouched', () => {
  const base = { event_type: 'gala_night', event_date: '2027-03-07', display_name: 'Year-End Gala' };
  const plain = homeCoverWords(base);
  assert.equal('forWho' in plain, false, 'an event for nobody grew a for line');
  const tagged = homeCoverWords({ ...base, for_tag: { name: 'SetnaProd', markUrl: null } });
  assert.equal(tagged.eyebrow, plain.eyebrow, 'the eyebrow moved');
  assert.deepEqual(tagged.forWho, { name: 'SetnaProd', markUrl: null });
  assert.equal('forWho' in homeCoverWords({ ...base, for_tag: { name: ' ', markUrl: null } }), false);

  const draw = (cover: ReturnType<typeof homeCoverWords>) =>
    renderToStaticMarkup(React.createElement(HomeCoverBand, { eventId: 'e1', cover }));
  const withLine = draw(tagged);
  assert.match(withLine, /data-home-for=""/);
  assert.match(withLine, />For SetnaProd</);
  assert.ok(withLine.indexOf('data-home-for') > withLine.indexOf('Year-End Gala</p>'), 'the for line is not under the name');
  assert.doesNotMatch(draw(plain), /data-home-for/);
});
