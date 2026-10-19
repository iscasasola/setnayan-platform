/**
 * 🫵 THE GUEST SEES THEIR PLACE — on every entourage style, a recognised guest's own name carries the mark and
 * nobody else's does; a stranger's page carries none.
 *
 * ⚖ Owner 2026-10-17, verbatim: *"if they are at the wedding march, we want to highlight them on the wedding march so
 * they can see where they are."* The March marked the viewer's line; On the axis (the default, the owner's own event)
 * and Lines marked nobody. The mark is `app/[slug]/_components/entourage-you.tsx`.
 *
 * THE PROPERTY, for EVERY style the registry lists for the entourage (`sceneStylesOn` — the Invitation's and the
 * Day's drawn by `EntourageSection`, Post Event's by `EntourageScene`), so a style added later is held without anyone
 * remembering to add it here — on the owner's real cast in shape (`the-entourage-second-column-is-the-partner.cast.json`,
 * names are stand-ins), for a Ninang, a lone Ninong, the Best Man, the Maid of Honor, a parent, a grandparent, a
 * candle sponsor, a flower girl, and a bridesmaid who is ALSO a candle sponsor:
 *   1. a stranger (no id) and an id that is nobody's: no mark, no "You", no "Your place is marked.", no anchor;
 *   2. the viewer: every mark holds THEIR name and only theirs, one per place they print (two roles → two marks),
 *      one "You" per mark, "Your place is marked." once, the anchor once — and, on a look before the day, where they
 *      walk in the SAME words Me reads (`marchPlaceLine`);
 *   3. take the mark away and the page is the stranger's page, character for character — so nobody else (the partner
 *      beside them included) was marked, and nothing else moved.
 * Plus the two places the mark must not reach: the Maker's canvas (See as · View as a role — a stand-in), and a
 * link to a place that is not on the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { buildEntourage, type EntourageGroup, type EntourageGuestRow } from './entourage';
import { marchPlaceLine, marchPlaceOf } from './march-place';
import { sceneStylesOn } from './scene-styles';
import { stripComments } from './strip-comments';

/* 🪤 The components are `"jsx": "preserve"` — React must be global before their dynamic import. */
(globalThis as unknown as { React: unknown }).React = React;

const RAW = JSON.parse(
  readFileSync(join(__dirname, 'the-entourage-second-column-is-the-partner.cast.json'), 'utf8'),
) as EntourageGuestRow[];
/* The stand-in cast carries no ids; give each row one. One bridesmaid is ALSO a candle sponsor (`extra_roles`). */
const CAST: EntourageGuestRow[] = RAW.map((r, i) => ({ ...r, guest_id: `g${i}` }));
const TWICE = CAST.find((r) => r.role === 'bridesmaid')!;
TWICE.extra_roles = ['candle_sponsor'];

const GROUPS = buildEntourage(CAST);

const decode = (s: string) =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html: string) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

type Kind = 'page' | 'post-event';
const STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;
/** Every registered entourage style, with the renderer that draws it. */
const STYLES: Array<{ kind: Kind; id: string }> = (() => {
  const out = new Map<string, { kind: Kind; id: string }>();
  for (const stage of STAGES) {
    for (const s of sceneStylesOn('entourage', stage, 'wedding')) {
      const kind: Kind = stage === 'editorial' ? 'post-event' : 'page';
      out.set(`${kind}:${s.id}`, { kind, id: s.id });
    }
  }
  return [...out.values()];
})();

async function render(kind: Kind, style: string, myGuestId: string | null, groups: readonly EntourageGroup[] = GROUPS) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  if (kind === 'page') {
    const { EntourageSection } = await import('../app/[slug]/_components/entourage-section');
    return renderToStaticMarkup(
      React.createElement(EntourageSection as never, { groups, sceneStyle: style, id: 'site-entourage', myGuestId }),
    );
  }
  const { EntourageScene } = await import('../app/[slug]/_components/editorial/post-event-scene-views-3');
  return renderToStaticMarkup(
    React.createElement(EntourageScene as never, { style, groups, names: 'Ana & Ben', words: {}, myGuestId }),
  );
}
const anchorOf = (kind: Kind) => (kind === 'page' ? 'site-entourage-me' : 'entourage-me');

/** The name inside each mark: from the mark's opening tag to its "You". */
const marks = (html: string) =>
  [...html.matchAll(/data-entourage-me=""[^>]*>([\s\S]*?)<span[^>]*data-you-tag=""/g)].map((m) => text(m[1]!));
/** The page with the mark taken away: the "You"s and the heading's line out, the wrapper tags gone with every tag. */
const unmarked = (html: string) =>
  text(html.replace(/<span[^>]*data-you-tag=""[^>]*>You<\/span>/g, '').replace(/<p[^>]*data-entourage-you=""[^>]*>[\s\S]*?<\/p>/g, ''));
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

const byRole = (role: string, pick: (rows: EntourageGuestRow[]) => EntourageGuestRow = (r) => r[0]!) =>
  pick(CAST.filter((r) => r.role === role && r !== TWICE));
const loneNinong = (() => {
  const ps = GROUPS.find((g) => g.key === 'principal_sponsors')!;
  const id = ps.rows.find(([l, r]) => l && !r)![0]!.id;
  return CAST.find((r) => r.guest_id === id)!;
})();
const VIEWERS: Array<[string, EntourageGuestRow]> = [
  ['a Ninang', byRole('principal_sponsor_ninang')],
  ['a Ninong walking alone', loneNinong],
  ['the Best Man', byRole('best_man')],
  ['the Maid of Honor', byRole('maid_of_honor')],
  ['a parent', byRole('bride_parents')],
  ['a grandparent', byRole('groom_immediate_family')],
  ['a candle sponsor', byRole('candle_sponsor')],
  ['a flower girl', byRole('flower_girl')],
  ['a bridesmaid who is also a candle sponsor', TWICE],
];

test('the registry lists the styles this guard draws — the page’s three and Post Event’s three', () => {
  assert.deepEqual(
    STYLES.map((s) => `${s.kind}:${s.id}`).sort(),
    ['page:lines', 'page:march', 'page:roll-call', 'post-event:family-tree', 'post-event:portrait-grid', 'post-event:roll-call'],
  );
});

for (const { kind, id: style } of STYLES) {
  test(`${kind} · ${style}: a stranger, and an id that is nobody's, see no mark`, async () => {
    for (const who of [null, 'nobody-at-all']) {
      const html = await render(kind, style, who);
      assert.ok(text(html).length > 0, 'the entourage drew');
      assert.doesNotMatch(html, /data-entourage-me=/, `${who}: a mark`);
      assert.doesNotMatch(html, /data-you-tag=/, `${who}: a "You"`);
      assert.doesNotMatch(html, /Your place is marked/, `${who}: the heading's line`);
      assert.doesNotMatch(html, new RegExp(`id="${anchorOf(kind)}"`), `${who}: the anchor`);
    }
  });

  test(`${kind} · ${style}: each recognised guest's own name — and only theirs — is marked, every place it prints`, async () => {
    const stranger = await render(kind, style, null);
    const strangerText = text(stranger);
    let drawnSomewhere = 0;
    for (const [who, row] of VIEWERS) {
      const name = GROUPS.flatMap((g) => g.rows.flat()).find((p) => p?.id === row.guest_id)?.name ?? '';
      assert.ok(name, `${who}: in the cast`);
      /* The count below reads the name in the page's text — it must not be a piece of anybody else's name. */
      const others = GROUPS.flatMap((g) => g.rows.flat()).filter((p) => p && p.id !== row.guest_id && p.name.includes(name));
      assert.deepEqual(others.map((p) => p!.name), [], `${who}: "${name}" is inside another name`);
      const places = count(strangerText, name);
      const html = await render(kind, style, row.guest_id!);
      const got = marks(html);
      if (places === 0) {
        // A style that draws a cut (Post Event's grid and tree) may not draw them at all: then nothing is said.
        assert.deepEqual(got, [], `${who}: marked where they are not drawn`);
        assert.doesNotMatch(html, /Your place is marked/, `${who}: told of a place that is not on the page`);
        continue;
      }
      drawnSomewhere += 1;
      assert.deepEqual(got, Array(places).fill(name), `${who}: the marks are not exactly their ${places} place(s)`);
      assert.equal(count(html, 'data-you-tag=""'), places, `${who}: one "You" per mark`);
      assert.equal(count(html, 'Your place is marked.'), 1, `${who}: the heading's line`);
      assert.equal(count(html, `id="${anchorOf(kind)}"`), 1, `${who}: the anchor, once`);
      assert.equal(unmarked(html), strangerText, `${who}: something besides their own name changed — somebody else marked?`);
      if (kind === 'page') {
        const place = marchPlaceOf(GROUPS, row.guest_id);
        assert.ok(place, `${who}: walks`);
        assert.ok(text(html).includes(marchPlaceLine(place)), `${who}: where they walk, in Me's words`);
      }
    }
    assert.ok(drawnSomewhere >= 2, 'the style drew almost nobody — the property was not exercised');
  });
}

test('a bridesmaid who is also a candle sponsor is marked under both, on every page look', async () => {
  for (const { kind, id: style } of STYLES.filter((s) => s.kind === 'page')) {
    assert.equal(marks(await render(kind, style, TWICE.guest_id!)).length, 2, style);
  }
});

test('the couple are the masthead, not a line — a bride reading her own page is marked nowhere', async () => {
  const bride = CAST.find((r) => r.role === 'bride')!;
  for (const { kind, id: style } of STYLES) {
    assert.doesNotMatch(await render(kind, style, bride.guest_id!), /data-entourage-me=/, `${kind}:${style}`);
  }
});

/*
  🔒 THE MAKER'S CANVAS MARKS NOBODY. See as and View as a role (#6603) draw a stand-in seat-holder; no real name may
  be marked there. The guest tree is the only caller that hands the section an id, and it hands none on the canvas.
*/
test('the event page hands the entourage the guest’s id only off the Maker’s canvas, and only in the guest tree', () => {
  const src = stripComments(readFileSync(join(__dirname, '../app/[slug]/_components/site-body.tsx'), 'utf8'));
  const mounts = [...src.matchAll(/<EntourageSection\b[^>]*\/>/g)].map((m) => m[0]);
  assert.ok(mounts.length >= 2, `found ${mounts.length} entourage mounts`);
  const withId = mounts.filter((m) => /myGuestId=/.test(m));
  // 🪪 Two mounts name a viewer since 2026-10-19 (owner ruling (a), lib/pass-account-rule.ts): the guest tree its own
  // signed guest, and the HOST's page the host's OWN row — each off the canvas, and the host's never for a sample.
  assert.equal(withId.length, 2, 'the guest tree and the host page name a viewer — nothing else');
  assert.ok(
    withId.some((m) => /myGuestId=\{isMakerCanvas \? null : guest\.guest_id\}/.test(m)),
    'the guest tree: the canvas must pass no viewer',
  );
  assert.ok(
    withId.some((m) =>
      /myGuestId=\{viewerIsHost && !isEditorCanvas && sampleViewer === null \? hostOwnGuestId : null\}/.test(m),
    ),
    'the host page: only the host’s own row, never on the canvas or a sample',
  );
});

/* 🔗 "See where you are ↓" is drawn under BOTH "You are …" blocks (Welcome and Me), and only when its place exists. */
test('See where you are ↓ — under both "You are" blocks, and only when the marked place is on the page', async () => {
  const src = stripComments(readFileSync(join(__dirname, '../app/[slug]/_components/dress-code-widget.tsx'), 'utf8'));
  const role = src.slice(src.indexOf("if (part === 'role')"), src.indexOf("if (part === 'arrive')"));
  assert.match(role, /<SeeWhereYouAre \/>/, 'Me › Your role');
  const you = src.slice(src.indexOf('data-dress-code="you"'));
  assert.match(you.slice(0, you.indexOf('{mine ? (')), /<SeeWhereYouAre \/>/, 'the "You are" panel');
  const { placeIsOnThePage } = await import('../app/[slug]/_components/see-where-you-are');
  const { SITE_ENTOURAGE_ME } = await import('../app/[slug]/_components/entourage-me-anchor');
  assert.equal(SITE_ENTOURAGE_ME, 'site-entourage-me');
  const ninang = byRole('principal_sponsor_ninang');
  for (const { id: style } of STYLES.filter((s) => s.kind === 'page')) {
    const as = (html: string) => ({ getElementById: (id: string) => (html.includes(`id="${id}"`) ? {} : null) });
    assert.equal(placeIsOnThePage(as(await render('page', style, ninang.guest_id!))), true, `${style}: a Ninang's link`);
    assert.equal(placeIsOnThePage(as(await render('page', style, null))), false, `${style}: a stranger's link`);
  }
});
