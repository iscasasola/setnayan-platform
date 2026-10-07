/**
 * 👤 EACH FOR-EACH-GUEST PART IS FOR A LISTED GUEST WHOSE ROW CARRIES THE FACT.
 *
 * Owner, 2026-10-06, verbatim: *"they will have their own elements per custom
 * part for each guest"* · *"these personalization will not be available of they
 * are not actual guests with roles and personalization."* DECISION_LOG
 * "'YOUR DETAILS' LIVES ON INVITATION › ME" and "PERSONAL PARTS ARE FOR REAL
 * LISTED GUESTS ONLY"; plan §3 PR 6 ("one test per part").
 *
 * One test per part — Your role · What to wear · Arrive by · Coming with you —
 * each RENDERED (the gate `guestMePartsShown` → `GuestMeParts`):
 *   ✔ a guest on the list, How guests get in = Only my list · They reply, whose
 *     row carries the fact → the part is drawn, under its own heading;
 *   ✘ a visitor on the plain address (no guest row), a request still waiting,
 *     an approved request (My list + requests · They reply), an open-QR guest (Open · One
 *     QR for everyone), the switch off, and a listed guest WITHOUT the fact →
 *     not drawn.
 *
 * 🪤 `globalThis.React` before the dynamic imports, `server-only` stubbed — the
 * two traps `each-guest-page-has-one-main-action.test.ts` names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WORDS = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
const BOARD = { principal_sponsors: ['#C9A24B', '#F4E9DC'], touched_roles: ['principal_sponsors'] };
/** A ninang the couple dressed and gave a call time. */
const DRESSED = { roles: { principal_sponsor_ninang: { style: 'long_gown', callTime: '14:00' } } };

type Reader = { label: string; getIn: 'list' | 'requests' | 'personal' | 'one_qr' | 'one_qr_approve'; reader: { kind: 'guest'; entrySource?: string | null } | { kind: 'visitor' }; on?: boolean };
const LISTED: Reader = { label: 'a listed guest', getIn: 'list', reader: { kind: 'guest', entrySource: 'host_seeded' } };
const NOT_FOR_THEM: Reader[] = [
  { label: 'a visitor on the plain address', getIn: 'list', reader: { kind: 'visitor' } },
  { label: 'a request still waiting', getIn: 'list', reader: { kind: 'guest', entrySource: 'self_added_unlisted' } },
  { label: 'an approved request (My list + requests · They reply)', getIn: 'requests', reader: { kind: 'guest', entrySource: 'host_seeded' } },
  { label: 'an open-QR guest (Open · Anyone with the link)', getIn: 'one_qr', reader: { kind: 'guest', entrySource: 'host_seeded' } },
  { label: 'a guest let in by one QR, approved', getIn: 'one_qr_approve', reader: { kind: 'guest', entrySource: 'host_seeded' } },
  { label: 'a guest with their own QR, no reply', getIn: 'personal', reader: { kind: 'guest', entrySource: 'host_seeded' } },
  { ...LISTED, label: 'the switch off', on: false },
];

type Row = { role: string; dress: unknown; comingWith: string[] };
const WITH_FACTS: Row = { role: 'principal_sponsor_ninang', dress: DRESSED, comingWith: ['Lola Nena'] };

async function draw(who: Reader, row: Row): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { guestMeFacts, guestMePartsShown, readerIsListed } = await import('@/lib/guest-me-parts');
  const { GuestMeParts } = await import('./_components/guest-me-parts');
  const parts = guestMePartsShown({
    on: who.on ?? true,
    getIn: who.getIn,
    listed: readerIsListed(who.reader),
    facts: guestMeFacts({ role: row.role as never, dressCodeConfig: row.dress, rolePalette: BOARD, comingWith: row.comingWith }),
  });
  return renderToStaticMarkup(
    React.createElement(GuestMeParts, {
      parts,
      words: WORDS,
      look: {
        config: row.dress as never,
        ceremonyType: null,
        genderSeparation: null,
        guestRole: row.role as never,
        march: null,
        rolePalette: BOARD,
      },
      comingWith: row.comingWith,
    }),
  );
}

/** One part's block: drawn under its heading, or absent. */
const partOf = (html: string, key: string) => {
  const at = html.indexOf(`data-me-part="${key}"`);
  return at < 0 ? '' : html.slice(at, html.indexOf('</section>', at));
};

async function holds(key: 'role' | 'wear' | 'arrive' | 'guests', heading: string, fact: RegExp, without: Row) {
  const drawn = partOf(await draw(LISTED, WITH_FACTS), key);
  assert.ok(drawn, `${heading}: a listed guest whose row carries it is not shown the part`);
  assert.match(drawn, new RegExp(`<span>${heading}</span>`), `${heading}: drawn without its own heading`);
  assert.match(drawn, fact, `${heading}: the fact itself is not drawn`);
  for (const who of NOT_FOR_THEM) {
    assert.equal(partOf(await draw(who, WITH_FACTS), key), '', `${heading}: shown to ${who.label}`);
  }
  assert.equal(partOf(await draw(LISTED, without), key), '', `${heading}: drawn for a listed guest whose row does not carry it`);
}

test('Your role — a listed guest with a role; never a plain "guest"', async () => {
  await holds('role', 'Your role', /Ninang|Principal Sponsor/, { ...WITH_FACTS, role: 'guest' });
});

test('What to wear — the outfit the couple set for that role; never a default style', async () => {
  // Dressed nothing, coloured nothing: no part — not "Outfit to be confirmed".
  await holds('wear', 'What to wear', /Long gown|long gown/i, { ...WITH_FACTS, dress: { roles: {} }, role: 'groomsman' });
  const drawn = partOf(await draw(LISTED, WITH_FACTS), 'wear');
  assert.doesNotMatch(drawn, /to be confirmed/i, 'What to wear invents a placeholder');
});

test('Arrive by — the call time the couple set for that role', async () => {
  await holds('arrive', 'Arrive by', /2:00 PM/, { ...WITH_FACTS, dress: { roles: { principal_sponsor_ninang: { style: 'long_gown' } } } });
});

test('Coming with you — the named companions on their seats', async () => {
  await holds('guests', 'Coming with you', /Lola Nena/, { ...WITH_FACTS, comingWith: [] });
  // An unnamed (TBA) seat has no name to say.
  const { guestMeFacts } = await import('@/lib/guest-me-parts');
  assert.deepEqual(guestMeFacts({ role: 'guest', dressCodeConfig: null, rolePalette: null, comingWith: [null, '  ', 'Ben'] }).comingWith, ['Ben']);
});

test('the four keep the Maker’s order and words (`lib/maker-parts.ts` my parts)', async () => {
  const { GUEST_ME_PARTS, GUEST_ME_PART_LABEL } = await import('@/lib/guest-me-parts');
  const { MAKER_PARTS, MAKER_STAGE_PAGES } = await import('@/lib/maker-parts');
  const makerMine = MAKER_STAGE_PAGES.rsvp.me!.filter((k) => MAKER_PARTS[k].my);
  assert.deepEqual(makerMine.map((k) => MAKER_PARTS[k].my), [...GUEST_ME_PARTS]);
  assert.deepEqual(makerMine.map((k) => MAKER_PARTS[k].label), GUEST_ME_PARTS.map((p) => GUEST_ME_PART_LABEL[p]));
});
