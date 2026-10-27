/**
 * 👤 ME READS THEIR GENDER — owner 2026-10-19, on cale-ice's Invitation › Me for the groom's mother (her row:
 * `name_prefix 'Atty.'`, `gender 'woman'`, `role 'groom_parents'`, `attire 'neutral'`):
 *   *"shouldn't it identify that she is the female mother of the groom"* · *"not both gender to show?"*
 * and, on the same page, "Arrive by 8:00 AM" above a ticket that said "ARRIVE 2:30 PM".
 *
 * Three properties, each EXECUTED through the guest page's own components where it can be:
 *   1. Me › Your role — a parent's word is the per-person word (`womanOrManOf`: gender → title → attire).
 *   2. Me › What to wear — a reader whose woman / man is known sees ONE column (no "For men" / "For women" label, one
 *      figure, one colour set); unknown still sees both.
 *   3. One arrive-by — the ticket and the checklist say what Me › Arrive by says (`guestArriveBy`), else the doors' time.
 * …and the wiring that carries the gender from the database row to all three (the read, the one builder, the ticket).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { PICK_LABEL, guestAttireOf, guestNamePartsOf } from './attire-rows';
import { guestArriveBy } from './role-group-dress-code';
import { guestMeFacts, guestMePartsShown } from './guest-me-parts';
import { womanOrManOf } from './guest-title';
import { roleWordOfGuest } from './entourage';
import { guestChecklistItems } from '../app/[slug]/_lib/guest-checklist-facts';
import { LAB_DOORS, labMeDressConfig, labMeRolePalette } from '../app/dev/me-lab/lab-people';
import type { GuestRole } from './guests';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
const CONFIG = labMeDressConfig();
const BOARD = labMeRolePalette();
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

type Row = { role: GuestRole; name_prefix: string | null; display_name: string; gender: 'woman' | 'man' | null; attire: 'gown' | 'suit' | 'neutral' | null };

/** Invitation › Me for one row, exactly as `site-body.tsx` hands it over (`guestNamePartsOf` · `guestAttireOf`). */
async function me(row: Row, part: 'role' | 'wear' | 'arrive'): Promise<string> {
  /* 🔁 2026-10-24 (owner, the Me redraw): the role is said ONCE on Me — under the name at Me's top (`MeGreeting`), from
     the same word site-body hands it (`roleWord: roleWordOfGuest(guest, roleNames)`, asserted below). */
  if (part === 'role') {
    const { MeGreeting } = await import('../app/[slug]/_components/guest-greeting');
    const { guestGreetingOf } = await import('./guest-greeting');
    return renderToStaticMarkup(
      React.createElement(MeGreeting, {
        greeting: guestGreetingOf({ name: row.display_name, roleCode: row.role, roleWord: roleWordOfGuest(row), sideLabel: null, date: null, venues: null, venueName: null }),
      }),
    );
  }
  const { GuestMeParts } = await import('../app/[slug]/_components/guest-me-parts');
  return renderToStaticMarkup(
    React.createElement(GuestMeParts, {
      parts: [part],
      words,
      comingWith: [],
      look: {
        config: CONFIG as never,
        ceremonyType: null,
        genderSeparation: null,
        guestRole: row.role,
        guestAttire: guestAttireOf(row),
        guestNameParts: guestNamePartsOf(row),
        march: null,
        rolePalette: BOARD,
      },
    }),
  );
}

const KIN: Array<[GuestRole, string, string]> = [
  ['bride_parents', 'Parent', 'Bride'],
  ['groom_parents', 'Parent', 'Groom'],
  ['bride_grandparents', 'Grandparent', 'Bride'],
  ['groom_grandparents', 'Grandparent', 'Groom'],
];
const kinWord = (base: string, said: 'woman' | 'man' | null) =>
  said === null ? base : base === 'Parent' ? (said === 'woman' ? 'Mother' : 'Father') : said === 'woman' ? 'Grandmother' : 'Grandfather';

test('1 · Me › Your role — the owner\'s row: an "Atty. (Woman)" groom\'s parent is "Mother of the Groom"', async () => {
  // (`guestAsRole` — the reader's own row, wearing the role they stand in for when they are a proxy, 2026-10-27.)
  assert.match(read('app/[slug]/_components/site-body.tsx'), /const meGreeting = guestGreetingOf\(\{[\s\S]{0,200}?roleWord: roleWordOfGuest\((?:guest|guestAsRole), roleNames\),/, 'Me’s role line is not the one role word');
  const her: Row = { role: 'groom_parents', name_prefix: 'Atty.', display_name: 'Eufrocina M. Sacdalan-Casasola', gender: 'woman', attire: 'neutral' };
  const said = text(await me(her, 'role'));
  assert.match(said, /Mother of the Groom/, `her Me page said: ${said}`);
  assert.doesNotMatch(said, /Parents? of the Groom/);
});

test('1 · Me › Your role — every kin role × woman · man · unknown, by gender FIRST (a neutral title, a neutral attire)', async () => {
  let checked = 0;
  for (const [role, base, side] of KIN) {
    for (const gender of ['woman', 'man', null] as const) {
      const row: Row = { role, name_prefix: 'Atty.', display_name: 'Lee Cruz', gender, attire: 'neutral' };
      const want = `${kinWord(base, gender)} of the ${side}`;
      assert.match(text(await me(row, 'role')), new RegExp(want), `${role} · ${gender ?? 'unknown'}: Me`);
      // …and the same word on every other "you" line (Me's greeting role line, Event details' "Your role").
      assert.equal(roleWordOfGuest(row), want, `${role} · ${gender ?? 'unknown'}: the other "you" lines`);
      checked += 1;
    }
  }
  assert.equal(checked, 12, 'anti-vacuity');
  // The gender outranks a title and an attire that say the other thing — the couple's own pick is the answer.
  assert.equal(womanOrManOf({ gender: 'woman', name_prefix: 'Mr.', display_name: 'X', attire: 'suit' }), 'woman');
  assert.equal(womanOrManOf({ gender: null, name_prefix: 'Mr.', display_name: 'X', attire: 'gown' }), 'man', 'title before attire');
  assert.equal(womanOrManOf({ gender: null, name_prefix: 'Atty.', display_name: 'X', attire: 'gown' }), 'woman', 'attire last');
  assert.equal(womanOrManOf({ gender: null, name_prefix: 'Atty.', display_name: 'X', attire: 'neutral' }), null);
});

test('2 · Me › What to wear — gender known ⇒ ONE column (no "For men" / "For women", one Wear); unknown ⇒ both', async () => {
  const labels = [PICK_LABEL.m, PICK_LABEL.f];
  const count = (html: string) => labels.reduce((n, l) => n + (text(html).match(new RegExp(l, 'g'))?.length ?? 0), 0);
  let checked = 0;
  for (const role of ['bride_parents', 'groom_parents', 'bride_grandparents', 'groom_grandparents', 'principal_sponsor'] as GuestRole[]) {
    const woman = await me({ role, name_prefix: 'Atty.', display_name: 'A', gender: 'woman', attire: 'neutral' }, 'wear');
    const man = await me({ role, name_prefix: 'Atty.', display_name: 'B', gender: 'man', attire: 'neutral' }, 'wear');
    const unknown = await me({ role, name_prefix: 'Atty.', display_name: 'C', gender: null, attire: 'neutral' }, 'wear');
    assert.ok(unknown.includes('data-me-part="wear"'), `${role}: the row is not dressed in the fixture (vacuous)`);
    assert.ok(count(unknown) >= 2, `${role}: an unknown reader no longer sees both columns`);
    assert.equal(count(woman), 0, `${role}: a woman is shown a column label (${text(woman)})`);
    assert.equal(count(man), 0, `${role}: a man is shown a column label (${text(man)})`);
    assert.notEqual(text(woman), text(man), `${role}: the woman and the man read the same Wear`);
    // Her Wear is the women's half of what the unknown reader is shown, never the men's.
    const unknownLine = text(unknown);
    const stop = `(?= ${PICK_LABEL.m}| ${PICK_LABEL.f}| ·|$)`;
    const womanWear = unknownLine.match(new RegExp(`${PICK_LABEL.f}: (.+?)${stop}`))?.[1]?.trim();
    const manWear = unknownLine.match(new RegExp(`${PICK_LABEL.m}: (.+?)${stop}`))?.[1]?.trim();
    assert.ok(womanWear && manWear, `${role}: the unknown reader's line names no columns: ${unknownLine}`);
    assert.ok(text(woman).includes(womanWear!) && !text(woman).includes(manWear!), `${role}: the woman reads ${text(woman)}`);
    assert.ok(text(man).includes(manWear!) && !text(man).includes(womanWear!), `${role}: the man reads ${text(man)}`);
    checked += 1;
  }
  assert.equal(checked, 5, 'anti-vacuity');
});

test('2 · the checklist\'s "What to wear" is the reader\'s own column too', () => {
  const wear = (gender: 'woman' | 'man' | null) =>
    guestChecklistItems({
      role: 'groom_parents',
      person: { ...guestNamePartsOf({ name_prefix: 'Atty.', display_name: 'A', gender }), attire: 'neutral' },
      dressCodeConfig: CONFIG,
      rolePalette: BOARD,
      arriveBy: LAB_DOORS,
      venueName: null,
      venueAddress: null,
      venueLatitude: null,
      venueLongitude: null,
      tableLabel: null,
    })
      .filter((i) => i.key === 'wear')
      .map((i) => `${i.title} ${i.sub ?? ''}`)
      .join('');
  assert.match(wear(null), new RegExp(PICK_LABEL.f), 'anti-vacuity: an unknown reader is shown both');
  assert.doesNotMatch(wear('woman'), new RegExp(`${PICK_LABEL.m}|${PICK_LABEL.f}`));
  assert.doesNotMatch(wear('man'), new RegExp(`${PICK_LABEL.m}|${PICK_LABEL.f}`));
  assert.notEqual(wear('woman'), wear('man'));
});

test('3 · ONE ARRIVE-BY — the ticket and the checklist say what Me › Arrive by says, else the doors\' time', async () => {
  let called = 0;
  for (const role of ['groom_parents', 'bride_parents', 'groom_grandparents', 'bridesmaid', 'groomsman', 'principal_sponsor', 'guest'] as GuestRole[]) {
    const row: Row = { role, name_prefix: 'Ms.', display_name: 'A', gender: 'woman', attire: null };
    const meSays = text(await me(row, 'arrive')).replace(/^Arrive by\s*/, '') || null;
    const ticket = guestArriveBy({ role, config: CONFIG, general: LAB_DOORS });
    assert.equal(ticket, meSays ?? LAB_DOORS, `${role}: the ticket says ${ticket}, Me says ${meSays}`);
    const facts = guestMeFacts({ role, dressCodeConfig: CONFIG, rolePalette: BOARD });
    assert.equal(facts.arriveBy, meSays, `${role}: the Me tile decides differently from the part`);
    const checklist = guestChecklistItems({ role, dressCodeConfig: CONFIG, rolePalette: BOARD, arriveBy: LAB_DOORS, venueName: null, venueAddress: null, venueLatitude: null, venueLongitude: null, tableLabel: null });
    assert.equal(checklist.find((i) => i.key === 'arrive')?.title, `Arrive by ${ticket}`, `${role}: the checklist`);
    if (meSays) called += 1;
  }
  assert.ok(called >= 1, 'anti-vacuity: no role in the fixture has a call time');
  assert.equal(guestArriveBy({ role: 'groom_parents', config: CONFIG, general: LAB_DOORS }), '8:00 AM', "the owner's case");
  assert.equal(guestArriveBy({ role: 'guest', config: CONFIG, general: LAB_DOORS }), LAB_DOORS, 'a plain guest keeps the doors');
});

test('3 · the TICKET reads it — every ticket (the Me picture, "Save my ticket", the zip, the host\'s card) is `passCardPass`', () => {
  const server = read('lib/pass-card.server.ts');
  const body = server.slice(server.indexOf('export function passCardPass'), server.indexOf('export function passCardDesignFor'));
  assert.match(body, /arrive:\s*guestArriveBy\(\{\s*role:\s*g\.role\b[^}]*config:\s*kit\.set\.event\.dress_code_config[^}]*general:\s*kit\.arrive/, 'the ticket prints the doors\' time over a role\'s own call time');
  const cols = server.match(/const PASS_CARD_GUEST_COLUMNS =([\s\S]*?);/)?.[1] ?? '';
  assert.ok(/\brole\b/.test(cols), 'the ticket does not read the guest\'s role');
  // Every ticket picture is drawn through `passCardPass`, never its own facts.
  for (const route of ['app/api/guest/pass-card/route.ts', 'app/api/guest/pass-card/all/route.ts', 'app/api/guest/request-ticket/route.ts']) {
    assert.doesNotMatch(read(route), /\barrive\s*:/, `${route} sets its own Arrive`);
  }
});

/* ── THE WIRING: the gender reaches the page ─────────────────────────────── */

const columnsOf = (src: string, from: number) => {
  const m = /select\(\s*['`]([^'`]+)['`]/.exec(src.slice(from));
  return new Set((m?.[1] ?? '').split(',').map((c) => c.trim()));
};

test("WIRING · the guest's own row is read WITH gender, title and attire — the page cannot hand over what it never read", () => {
  const loaders = read('app/[slug]/_lib/loaders.ts');
  const own = columnsOf(loaders, loaders.indexOf('export const loadGuestOwnRow'));
  for (const c of ['gender', 'name_prefix', 'display_name', 'attire', 'role']) assert.ok(own.has(c), `loadGuestOwnRow does not read ${c}`);
  const reminder = read('lib/guest-reminder-emails.ts');
  const rem = columnsOf(reminder, reminder.indexOf(".from('guests')"));
  for (const c of ['gender', 'name_prefix', 'attire', 'role']) assert.ok(rem.has(c), `the reminder's guest read does not read ${c}`);
});

test('WIRING · every "you" panel is handed the reader through ONE builder (`guestNamePartsOf`), never a literal that drops the gender', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(join(WEB, dir))) {
      const p = `${dir}/${f}`;
      if (statSync(join(WEB, p)).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk('app/[slug]');
  let handed = 0;
  for (const f of files) {
    for (const line of read(f).split('\n')) {
      /* A hand-over is `guestNameParts: <value>` or `guestNameParts={<value>}` — not a type (`guestNameParts?:`), not
         the widget's own default (`guestNameParts = null`), not a pass-through of a value already built. */
      const m = /\bguestNameParts(?::\s|=\{)(.+)$/.exec(line);
      if (!m || /guestNameParts\?:/.test(line) || /look\.guestNameParts|guestNameParts \?\?/.test(m[1]!)) continue;
      handed += 1;
      assert.match(m[1]!, /guestNamePartsOf\(/, `${f}: guestNameParts is built by hand — the gender can be dropped again: ${line.trim()}`);
    }
  }
  assert.ok(handed >= 3, `anti-vacuity: only ${handed} hand-overs found (site-body ×2, Event details)`);
});
