/**
 * 🪪 THE INVITATION PRINTS A GUEST'S FULL NAME — "SHOWN AS" NEVER REPLACES IT.
 *
 * Owner, verbatim, 2026-10-20, on the live cale-ice entourage reading
 * "Frocie · MOTHER OF THE GROOM" instead of "Atty. Eufrocina M.
 * Sacdalan-Casasola": *"why the nickname replaced on the invitation. do not
 * change the invitation. used the full name."* (DECISION_LOG 2026-10-20 "THE
 * INVITATION PRINTS A GUEST'S FULL NAME — SHOWN AS NEVER REPLACES IT").
 *
 * 🔴 THE CAUSE: `guestFullName` (lib/guests.ts) — the one resolver every formal
 * surface prints through — returned the couple's `display_name` FIRST whenever
 * it was set, by design since the entourage shipped (#5487 / #5492,
 * 2026-09-14: "The couple's own display_name still WINS"). The guest card's
 * "Shown as (optional)" box (#6192, 2026-09-30, placeholder "e.g. Tito Boy &
 * Tita Cora") invites exactly a nickname, so a label typed for the couple's
 * own list was printed on the invitation.
 *
 * The property held here, two ways:
 *   1. BEHAVIOUR — a guest whose row carries a "Shown as" renders their FULL
 *      name on every formal surface the guest sees: the resolver in every Name
 *      style, the entourage in every look (default · Roll call · Lines ·
 *      Wedding March, and with the reader marked), a walking pair's line, the
 *      Me / Dress-with-us line "You walk first, with …", the name list
 *      (/everyone), the printed Entourage card, the printed card, the ticket,
 *      the place card. And the couple's own list keeps the nickname.
 *   2. SOURCE — "Shown as" reaches a screen only through the reviewed doors:
 *      `guestNameAsGiven` is called only from the files listed below (the
 *      couple's list and words addressed to the guest), and no guest-facing
 *      file reads a guest's `.display_name` outside the reviewed list. A new
 *      reader fails here until somebody decides it is not a formal surface.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { stripComments } from '@/lib/strip-comments';
import { guestDisplayName, guestFullName, guestNameAsGiven, printedCardName } from '@/lib/guests';
import { ticketName, type NameStyle } from '@/lib/name-style';
import { placeCardName } from '@/lib/formal-name';
import { buildEntourage, lineNames, personName, plainGuestNames, type EntourageGuestRow } from '@/lib/entourage';
import { marchPlaceLine, marchPlaceOf } from '@/lib/march-place';
import { printedEntourageLines } from '@/lib/print-layout';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');

/** The owner's own row, in its exact shape (2026-10-20). */
const FROCIE = {
  guest_id: 'frocie',
  name_prefix: 'Atty.',
  first_name: 'Eufrocina',
  middle_name: 'M.',
  last_name: 'Sacdalan-Casasola',
  name_suffix: null,
  display_name: 'Frocie',
  role: 'groom_parents',
  gender: 'woman',
  extra_roles: [],
  march: { walk_no: 0, place_in_walk: 1 },
} satisfies EntourageGuestRow;
const MANUEL = {
  guest_id: 'manuel',
  name_prefix: 'Mr.',
  first_name: 'Manuel',
  middle_name: 'C.',
  last_name: 'Casasola',
  name_suffix: null,
  display_name: 'Tito Manny',
  role: 'groom_parents',
  gender: 'man',
  extra_roles: [],
  march: { walk_no: 0, place_in_walk: 0 },
} satisfies EntourageGuestRow;
/** A plain guest (not entourage) with a nickname — the name list on /everyone. */
const ANA = {
  guest_id: 'ana',
  name_prefix: 'Ms.',
  first_name: 'Ana',
  middle_name: 'Bautista',
  last_name: 'Cruz',
  name_suffix: null,
  display_name: 'Anang',
  role: 'guest',
  extra_roles: [],
} satisfies EntourageGuestRow;
const ROWS: EntourageGuestRow[] = [FROCIE, MANUEL, ANA];

const FULL = 'Atty. Eufrocina M. Sacdalan-Casasola';
const NICKNAMES = /Frocie|Tito Manny|Anang/;
const STYLES: NameStyle[] = ['full', 'middle-initial', 'surname-first'];
const STYLED: Record<NameStyle, string> = {
  full: FULL,
  'middle-initial': 'Atty. Eufrocina M. Sacdalan-Casasola',
  'surname-first': 'Atty. Sacdalan-Casasola, Eufrocina M.',
};

// ── 1 · BEHAVIOUR ──────────────────────────────────────────────────────────

test('the resolver prints the full name in every Name style — never the Shown as', () => {
  for (const style of STYLES) {
    assert.equal(guestFullName(FROCIE, style), STYLED[style], style);
    assert.equal(personName(FROCIE, style), STYLED[style], style);
    assert.equal(ticketName(FROCIE, style), STYLED[style], `ticket · ${style}`);
    assert.equal(placeCardName(FROCIE, style), STYLED[style], `place card · ${style}`);
    assert.equal(printedCardName(FROCIE as never, style), STYLED[style], `printed card · ${style}`);
  }
  assert.equal(guestFullName(FROCIE), FULL, 'no style is Full');
  // Only a row with no name parts at all falls back to what the couple typed — never a dropped person.
  assert.equal(guestFullName({ display_name: 'Frocie', first_name: '', last_name: '' }), 'Frocie');
});

test('the entourage, its pair line and the name list print full names — every style', () => {
  for (const style of STYLES) {
    const groups = buildEntourage(ROWS, null, null, style);
    const names = groups.flatMap((g) => g.rows.flatMap((r) => r.filter(Boolean).map((p) => p!.name)));
    assert.ok(names.includes(STYLED[style]), `${style}: ${names.join(' | ')}`);
    assert.ok(!names.some((n) => NICKNAMES.test(n)), `${style}: a Shown as printed — ${names.join(' | ')}`);
    for (const g of groups) for (const line of g.rows) assert.doesNotMatch(lineNames(line), NICKNAMES, `${style}: a pair line`);
    const listed = plainGuestNames(ROWS, style);
    assert.equal(listed.length, 1, 'the name list lost its guest');
    assert.doesNotMatch(listed[0]!, NICKNAMES, `${style}: /everyone`);
  }
  assert.deepEqual(plainGuestNames(ROWS), ['Ms. Ana Bautista Cruz']);
});

test('Me / Dress with us: "You walk first, with …" names the full name', () => {
  const groups = buildEntourage(ROWS, null, null, 'full');
  const place = marchPlaceOf(groups, 'manuel');
  assert.ok(place, 'Manuel does not walk — the fixture is wrong');
  assert.equal(marchPlaceLine(place), `You walk first, with ${FULL}.`);
  const hers = marchPlaceOf(groups, 'frocie')!;
  assert.equal(marchPlaceLine(hers), 'You walk first, with Mr. Manuel C. Casasola.');
});

test('the printed Entourage card prints the full name', () => {
  const lines = buildEntourage(ROWS, null, null, 'full').flatMap((g) => printedEntourageLines(g, false));
  const text = JSON.stringify(lines);
  assert.ok(text.includes(FULL), text);
  assert.doesNotMatch(text, NICKNAMES);
});

test('every entourage look on the invitation draws the full name — and the reader marked', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('@/app/[slug]/_components/entourage-section');
  const groups = buildEntourage(ROWS, null, null, 'full');
  for (const sceneStyle of [null, 'roll-call', 'lines', 'march'] as const) {
    for (const myGuestId of [null, 'frocie', 'manuel']) {
      const html = renderToStaticMarkup(
        React.createElement(EntourageSection as never, { groups, id: 'site-entourage', sceneStyle, myGuestId }),
      );
      const where = `${sceneStyle ?? 'default'} · me=${myGuestId ?? 'nobody'}`;
      assert.ok(html.includes('Eufrocina M. Sacdalan-Casasola'), `${where}: the full name is not drawn`);
      assert.doesNotMatch(html, NICKNAMES, `${where}: a Shown as is drawn`);
    }
  }
});

test('the couple keeps "Shown as" on their own list, search and greeting', () => {
  assert.equal(guestNameAsGiven(FROCIE), 'Frocie');
  assert.equal(guestDisplayName(FROCIE), 'Frocie');
  assert.equal(guestNameAsGiven({ ...FROCIE, display_name: null }), FULL);
});

// ── 2 · SOURCE ─────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const rel = (f: string) => relative(WEB, f).split('\\').join('/');

/** The ONLY files that may print the couple's "Shown as" through `guestNameAsGiven`, each with its reason. */
const AS_GIVEN_DOORS: Record<string, string> = {
  'lib/guests.ts': 'its definition',
  'app/dashboard/[eventId]/guests/_components/guests-screen.tsx': 'the couple’s own Guest list rows and the delete warning',
  'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx': 'the couple’s invite message to the guest — addressed to them',
  'app/dashboard/[eventId]/guests/send/page.tsx': 'the couple’s invite message to each guest — addressed to them',
  'app/dashboard/[eventId]/guests/claims/page.tsx': 'the couple’s invite message to an accepted request — addressed to them',
  'app/dashboard/[eventId]/invitation/page.tsx': 'the couple’s invite message to the guest — addressed to them',
  'app/[slug]/invite/enter/page.tsx': 'the greeting on the invitation the guest opens — addressed to them',
};

test('"Shown as" is printed through guestNameAsGiven only where the ruling keeps it', () => {
  const found = new Set<string>();
  const stray: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'components'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (!/\bguestNameAsGiven\s*\(/.test(src)) continue;
    const r = rel(file);
    found.add(r);
    if (!(r in AS_GIVEN_DOORS)) stray.push(r);
  }
  for (const door of Object.keys(AS_GIVEN_DOORS)) assert.ok(found.has(door), `${door} no longer calls guestNameAsGiven — the scan is not looking, or the door moved`);
  assert.deepEqual(stray, [], 'a new surface prints the couple’s Shown as — if it is a formal surface, print guestFullName');
});

/**
 * Every guest-facing file that reads a GUEST row's `display_name`, by file and object, each reviewed. The guest's own
 * name addressed to them (greeting, sign-out line, "for <name>" on their own reply) and bylines under their own words
 * are not formal surfaces (DECISION_LOG 2026-10-20). Reads off the EVENT (`event.display_name`, the couple's names)
 * are not a guest's name and are not counted.
 */
const GUEST_DISPLAY_NAME_READS: Record<string, string> = {
  'app/[slug]/_lib/held-pass-name.ts · data': 'the held-pass line’s first name — falls back only with no first name',
  'app/[slug]/_lib/loaders.ts · guest': 'the reader’s own greeting (`guestHubData.displayName`)',
  'app/[slug]/welcome/page.tsx · primary': 'the welcome greeting to the reader',
  'app/[slug]/invite/enter/page.tsx · guest': 'the reader’s own greeting and the landing message to them',
  'app/[slug]/invite/reply/page.tsx · guest': '"for <name>" on the reader’s own reply',
  'app/[slug]/invite/reply/page.tsx · me': 'the reader’s own saved contact details',
  'app/[slug]/rotate-qr-actions.ts · guest': 'a notice to the couple, not a guest surface',
  'app/[slug]/actions.ts · guest': 'the reader’s own reply notice to the couple',
  'app/[slug]/_components/rsvp-widget.tsx · guest': 'the reader’s own name box and "you" on their own reply',
  'app/[slug]/_components/guest-column-card.tsx · g': 'a byline under a guest’s own words',
  'app/[slug]/page.tsx · guest': 'the reader’s own Me (sign-out line) and their ticket’s image alt text',
  'app/[slug]/page.tsx · sampleIdentity.guest': 'the Maker sample reader’s own greeting',
  'app/[slug]/page.tsx · me': 'the reader’s own ACCOUNT name, offered in their own reply box',
  'app/[slug]/_components/editorial/data.ts · g': 'a byline under a guest’s own words; and a row handed whole to guestFullName (Shown as only with no parts)',
  'app/[slug]/_lib/guest-details-changed.ts · before': 'detects that the reader changed their own name — never drawn',
  'app/[slug]/_lib/icon-source.ts · row': 'the EVENT row (the couple’s names on the home-screen icon)',
  'app/[slug]/pabuya/_lib/gift-page.server.ts · reader': 'the reader’s own name as the giver of their own gift',
  'app/[slug]/welcome/actions.ts · patch': 'a write that clears a placeholder — never drawn',
  'lib/entourage.ts · guest': 'kinWordOfReader — "Tita"/"Tito" tells the reader’s kin word, never printed as a name',
};
/** Objects that are an EVENT row (the couple's names), never a guest — by the name each file gives it. */
const EVENT_ROW = /^(event|ev|e|shell|prev|r|kit\.set\.event|resolved\.user)$/;

test('no guest-facing file reads a guest’s display_name outside the reviewed list', () => {
  const roots = [join(WEB, 'app', '[slug]')];
  const formalLibs = ['lib/entourage.ts', 'lib/march-place.ts', 'lib/print-layout.ts', 'lib/formal-name.ts'].map((f) => join(WEB, f));
  const seen = new Set<string>();
  const stray: string[] = [];
  for (const file of [...roots.flatMap((d) => walk(d)), ...formalLibs]) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('display_name')) continue;
    const r = rel(file);
    const sf = ts.createSourceFile(r, src, ts.ScriptTarget.Latest, true, r.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n: ts.Node) => {
      if ((ts.isPropertyAccessExpression(n) || ts.isPropertyAccessChain?.(n)) && (n as ts.PropertyAccessExpression).name.text === 'display_name') {
        const obj = (n as ts.PropertyAccessExpression).expression.getText(sf).replace(/^\(+|\)+$/g, '').replace(/\s+as\s+.*$/, '').replace(/\?$/, '');
        const key = `${r} · ${obj}`;
        if (!EVENT_ROW.test(obj)) {
          if (key in GUEST_DISPLAY_NAME_READS) seen.add(key);
          else stray.push(`${key} (line ${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1})`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.ok(seen.size >= 8, `found only ${seen.size} reviewed reads — the scan is not looking`);
  assert.deepEqual(stray, [], 'a guest-facing file reads a guest’s Shown as — a formal surface prints guestFullName');
});
