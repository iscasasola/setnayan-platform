/**
 * VIEW AS — SIX OBSERVATIONS, IN REAL EMITTED HTML.
 *
 * `lib/event-hub-roles.test.ts` proves the resolver and the gate. This proves
 * the PIXELS, and the gap between the two is the whole disease this build
 * exists against: a resolver that returns the right answer changes nothing
 * until something renders it differently. A guest error was already bound and
 * already in Sentry while a couple with 180 names was told "No guests yet."
 *
 * So this MOUNTS the stage once per role and reads what a person would see:
 *
 *   You .............. their own page, as themselves
 *   Coordinator ...... writes announcements · advances the running order · no editor
 *   Supplier ......... the desk · cannot advance · refused the gifts page
 *   Guest ............ the seat FINDER, no seat of their own
 *   Stranger ......... nothing, and no hint that anything exists
 *   Seat-holder ...... their seat · photos of them · their bound QR   (flagged)
 *
 * plus the one that matters most: a viewer the gate refused sees NO SWITCHER
 * AT ALL — not a disabled one, not an empty one.
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORTS AND IS NOT A HACK TO
 * BE TIDIED AWAY. tsconfig sets `"jsx": "preserve"`, so `tsx` compiles these to
 * the CLASSIC runtime — bare `React.createElement` with no import of its own.
 * Without the global every component throws before an assertion runs, and the
 * imports must be DYNAMIC because a static one hoists above the assignment.
 * Same reasoning, same shape as `hub-stage-renders.test.ts` beside it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

const MNL = 'Asia/Manila';
const NOW = new Date('2026-11-28T10:00:00+08:00').getTime();

type Mod = typeof import('./hub-stage');
type Control = typeof import('@/lib/event-hub-control');

async function paint(opts: {
  memberType: string | null;
  namedGuestEnabled?: boolean;
  viewas?: string | string[];
  slug?: string | null;
  guestsShared?: boolean;
  guestsMeasured?: boolean;
  /** `?stage=` — the "When" switch's deep link. */
  stage?: string;
}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubStage }: Mod = await import('./hub-stage');
  const control: Control = await import('@/lib/event-hub-control');
  const { PUBLIC_SITE_PAGES } = await import('@/lib/public-site-pages');

  const read = {
    measured: true,
    eventDate: '2026-12-12',
    eventEndDate: null,
    clearedAt: null,
    timezone: MNL,
    slug: opts.slug === undefined ? 'maria-and-jomar' : opts.slug,
  };
  const guests = {
    shared: opts.guestsShared ?? true,
    measured: opts.guestsMeasured ?? true,
    invited: 90,
    replied: 61,
  };
  const standing = control.resolveHubStanding(read, NOW);
  const facts = control.resolveHubFacts(read, guests, NOW);

  const offered = control.hubPreviewRoles({
    memberType: opts.memberType,
    namedGuestEnabled: opts.namedGuestEnabled ?? false,
  });
  const armedRole = control.resolveArmedHubRole({ param: opts.viewas, offered });
  // The page's own shape: every role's read, resolved for EACH of the four
  // stages by the one pure function (see `roleViewsByPhase` in page.tsx).
  const rolesByPhase = Object.fromEntries(
    PUBLIC_SITE_PAGES.map((p) => [
      p.phaseParam,
      offered.map((role) =>
        control.resolveHubRoleView({ role, standing, slug: read.slug, guests, stage: p.phaseParam }),
      ),
    ]),
  );

  return renderToStaticMarkup(
    React.createElement(HubStage, {
      slug: read.slug,
      standing,
      facts,
      livePhase: standing.stage,
      initialPhase: control.resolveHubStageSelection({ param: opts.stage, live: standing.stage }),
      stages: PUBLIC_SITE_PAGES.map((p) => ({ phase: p.phaseParam, blurb: p.blurb })),
      editHref: '/dashboard/E1/website/editor',
      workroomHref: '/dashboard/E1/story',
      rolesByPhase,
      armedRole,
    }),
  );
}

// ── THE GATE, AT THE PIXEL ─────────────────────────────────────────────────

test('a `guest`-typed member row renders NO switcher — not a disabled one, none', async () => {
  const html = await paint({ memberType: 'guest' });
  assert.doesNotMatch(html, /View as/, 'the switcher must not be painted for a guest row');
  assert.doesNotMatch(html, /Coordinator/, 'no chip for a role they may not preview');
  assert.doesNotMatch(html, /viewas=/, 'and no door to one either');
  // The stage itself still paints — the gate refuses the switcher, not the page.
  // 🪤 ANCHORED ON THE ADDRESS, NOT ON THE EYEBROW. This line read
  // `/As your guests see it/` until the stage grew a live frame that carries the
  // owner ribbon and the eyebrow had to stop saying that. The thing being
  // asserted was never the wording — it was "the stage rendered at all" — so it
  // now reads the couple’s own address out of the `<h2>` the section is labelled
  // by, which is structural and cannot be reworded out from under it.
  assert.match(html, /setnayan\.com\//, 'the stage rendered at all');
});

test('a `guest` row cannot arm a role by hand-typing the param', async () => {
  const html = await paint({ memberType: 'guest', viewas: 'host' });
  assert.doesNotMatch(html, /View as/);
  assert.doesNotMatch(html, /Open your page/, 'the host door must not appear');
  // 🪤 A SECOND ANCHOR, BECAUSE THE FIRST ONE IS A STRING ANYONE MAY REUSE.
  // The stage grew a live-page button and it was briefly labelled "Open your
  // page" — the host role's own `previewLabel` — which would have made this
  // assertion fire on chrome that is ALWAYS painted, for every viewer, rather
  // than on a leaked host door. The footnote below belongs to the host ROLE
  // CARD and to nothing else on this page, so it cannot be collided with by a
  // button somebody adds later.
  assert.doesNotMatch(
    html,
    /The only role that may edit the site/,
    'nor the host role card that door sits in',
  );
});

test('a host sees the switcher, and the FIVE generic chips', async () => {
  const html = await paint({ memberType: 'couple' });
  assert.match(html, /View as/);
  for (const chip of ['You', 'Coordinator', 'Supplier', 'Guest', 'Stranger']) {
    assert.match(html, new RegExp(`>${chip}<`), `the "${chip}" chip must be painted`);
  }
  // 🔴 IT SAID "The stage above becomes their page", AND THE FRAME DOES NOT.
  // The frame is always the host's own signed-in page; what becomes theirs is
  // the read under it. The helper now says so, behind its (i).
  assert.match(html, /the read under the frame becomes theirs, at the stage you picked/);
  assert.doesNotMatch(html, /The stage above becomes their page/, 'the old promise the frame never kept');
});

test('⛔ WHO sits beside WHEN — one row of switches, the radios ahead of all they reveal', async () => {
  const html = await paint({ memberType: 'couple' });
  // The two switches are ONE control surface now (owner 2026-09-24: "this 2
  // can integrate to each other"): the When chips and the View-as chips are
  // painted together, above the frame, not at opposite ends of the stage.
  const when = html.indexOf('aria-label="When"');
  const who = html.indexOf('for="sn-viewas-host"');
  const frame = html.indexOf('<iframe');
  assert.ok(when > 0 && who > when && frame > who, 'When, then View as, then the frame');
  // 🔒 `globals.css` reveals a read with `#sn-viewas-X:checked ~ div …`. That
  // only fires if every radio is an EARLIER SIBLING of the divs holding the
  // chips and the cards — wrap the radios in their own group and every rule
  // silently stops matching while the markup still looks right.
  assert.match(
    html,
    /<fieldset[^>]*><legend[^>]*>[^<]*<\/legend>(<input[^>]*name="sn-viewas"[^>]*\/>){5}<div/,
    'the five radios must sit directly in the fieldset, ahead of the switches, frame and reads',
  );
});

/*
  🪤 EVERY READ IS NOW IN THE DOM, SO "THE ARMED ROLE SHOWS X" IS VACUOUS.

  The chips used to be `<Link href=?viewas=…>`, so one read rendered and the
  others did not — and "paint with viewas=coordinator, assert the coordinator's
  words appear" was a real observation. Owner, 2026-09-23: *"clicking here
  refreshes the whole page"*. It does: a chip re-ran the entire server page and
  re-signed every background URL to swap one description, reloading the
  miniature with it.

  So all six cards are rendered and CSS reveals the checked one. Which means
  each assertion below would now pass whatever role was armed — the words are
  always present. Two things keep them honest:

    · `armedCard(html, role)` reads ONLY that role's card, by its
      `data-viewas` attribute, so an assertion cannot be satisfied by a
      neighbour's copy;
    · `checkedRole(html)` asserts the armed role is the one whose radio is
      checked — which is what the CSS acts on, and the only thing that decides
      what a person sees.

  A guard that keeps passing after the mechanism underneath it changed is not a
  guard; it is a sentence about the past.
*/

/** One role's card, alone — never the whole page. */
function armedCard(html: string, role: string): string {
  const open = html.indexOf(`data-viewas="${role}"`);
  assert.ok(open > 0, `no card was rendered for '${role}'`);
  // Ends at the next card, or at the fieldset that closes the reads. 🪤 It
  // used to run to the END OF THE PAGE for the last card, which was harmless
  // while the reads were the last thing painted — and the moment the stage's
  // own "Open the live page" door sat after them, the stranger's card
  // "carried" a signed-in door it does not have.
  const next = html.indexOf('data-viewas="', open + 10);
  const close = html.indexOf('</fieldset>', open);
  assert.ok(close > 0, 'the reads must sit inside the fieldset their radios head');
  return html.slice(open, next > 0 && next < close ? next : close);
}

/** The role whose radio the server marked checked — what CSS reveals. */
function checkedRole(html: string): string | null {
  const m = /id="sn-viewas-([a-z_]+)"[^>]*checked/.exec(html);
  return m ? (m[1] as string) : null;
}

test('⛔ every read the page renders has a CSS rule that can reveal it', async () => {
  // The cards are `display: none` by default. A role added to the switcher with
  // no `:checked` rule beside it is not a broken layout — it is a card that can
  // never appear, on a page that still renders perfectly.
  const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
  const html = await paint({ memberType: 'couple' });
  const rendered = [...html.matchAll(/data-viewas="([a-z_]+)"/g)].map((m) => m[1] as string);
  assert.ok(rendered.length >= 5, `only ${rendered.length} reads rendered`);
  for (const role of new Set(rendered)) {
    assert.ok(
      css.includes(`#sn-viewas-${role}:checked ~ div .sn-viewas-card[data-viewas='${role}']`),
      `'${role}' renders a card that no rule can ever show`,
    );
    assert.ok(
      css.includes(`#sn-viewas-${role}:focus-visible ~ div .sn-viewas-chip[for='sn-viewas-${role}']`),
      `'${role}' gives a keyboard user no visible focus`,
    );
  }
  // 🪤 `+` is the ADJACENT sibling: only the LAST radio touches the chip row,
  // so one written that way rings all six chips, and only from one radio.
  assert.doesNotMatch(
    css,
    /\.sn-viewas input:(checked|focus-visible)\s*\+/,
    'an adjacent-sibling rule here fires for exactly the wrong radio',
  );
});

test('⛔ exactly one read is armed, and it is the one the param asked for', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'coordinator' });
  assert.equal(checkedRole(html), 'coordinator', '?viewas= is still an honest deep link');
  const checked = [...html.matchAll(/id="sn-viewas-[a-z_]+"[^>]*checked/g)];
  assert.equal(checked.length, 1, 'two armed reads would show two cards stacked');
});

test('⛔ pressing a chip navigates nowhere — no read is behind a link', async () => {
  // The whole point of the change: one press must not re-run the server page.
  const html = await paint({ memberType: 'couple' });
  assert.doesNotMatch(html, /href="[^"]*viewas=/, 'a chip that navigates reloads the miniature');
  assert.match(html, /type="radio"[^>]*name="sn-viewas"/, 'they are radios now');
  assert.match(html, /<label[^>]*for="sn-viewas-host"/, 'and the chips are their labels');
});

// ── THE SIX OBSERVATIONS ───────────────────────────────────────────────────

test('OBSERVATION 1 · You — their own page, as themselves', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'host' });
  assert.equal(checkedRole(html), 'host');
  const card = armedCard(html, 'host');
  assert.match(card, /Your own page, as yourself/);
  assert.match(card, /href="\/maria-and-jomar"[^>]*target="_blank"/);
  assert.match(card, /The only role that may edit the site/);
});

test('OBSERVATION 2 · Coordinator — two floor powers, and no site editor', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'coordinator' });
  assert.equal(checkedRole(html), 'coordinator');
  const card = armedCard(html, 'coordinator');
  assert.match(card, /A host key/);
  assert.match(card, /announcements/i);
  assert.match(card, /advance the running order/i);
  assert.match(card, /Cannot edit the site itself/);
  assert.match(card, /hired/i, 'a coordinator you HIRED is a supplier, not this');
});

test('OBSERVATION 3 · Supplier — the desk, never a guest surface, refused pabuya', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'supplier' });
  assert.equal(checkedRole(html), 'supplier');
  const card = armedCard(html, 'supplier');
  assert.match(card, /call sheet/i);
  assert.match(card, /No gifts page\. A supplier is not a guest/);
  assert.match(card, /cannot advance it/i);
  // No fabricated door: a booking cannot be minted for a preview.
  assert.doesNotMatch(card, /target="_blank"/, 'the supplier card offers no door at all');
});

test('OBSERVATION 4 · Guest — the seat FINDER, opening the stage they are on', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'guest' });
  assert.equal(checkedRole(html), 'guest');
  const card = armedCard(html, 'guest');
  assert.match(card, /seat finder/i);
  // 14 days out, the guests are on the invitation — so the door opens there.
  assert.match(card, /href="\/maria-and-jomar\?phase=rsvp"/);
  assert.match(card, /you cannot un-be the host/i, 'the preview is honest about its own limit');
});

test('OBSERVATION 5 · Stranger — nothing, no hint, and NO signed-in door', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'stranger' });
  assert.equal(checkedRole(html), 'stranger');
  const card = armedCard(html, 'stranger');
  assert.match(card, /What somebody who found the link sees/);
  assert.match(card, /not a hint/i);
  assert.match(card, /private window/i);
  assert.doesNotMatch(
    card,
    /target="_blank"/,
    'a stranger preview must never carry the host session — so it offers no door',
  );
});

test('OBSERVATION 6 · Seat-holder — four cells that are theirs, behind the flag', async () => {
  // Flag OFF (production): the chip does not exist, and the param cannot summon it.
  const dark = await paint({ memberType: 'couple', viewas: 'named_guest' });
  assert.doesNotMatch(dark, />Seat-holder</, 'the named read ships dark');
  assert.doesNotMatch(dark, /as=replied/, 'and no door to it');
  // It falls back to the first offered read rather than painting nothing.
  assert.match(dark, /Your own page, as yourself/);

  const lit = await paint({ memberType: 'couple', namedGuestEnabled: true, viewas: 'named_guest' });
  assert.match(lit, /their seat, and the walk to it/i);
  assert.match(lit, /Photos of them/i);
  assert.match(lit, /bound to their name/i);
  assert.match(lit, /href="\/maria-and-jomar\?phase=rsvp&amp;as=replied"/);
  assert.match(lit, /SAMPLE seat-holder, not one of your guests/i);
});

// ── UNREAD ≠ EMPTY, AT THE PIXEL ───────────────────────────────────────────

test('a guest list the host never shared paints NOT_SHARED — never a zero', async () => {
  const html = await paint({
    memberType: 'coordinator',
    viewas: 'guest',
    guestsShared: false,
    guestsMeasured: false,
  });
  const { NOT_SHARED }: Control = await import('@/lib/event-hub-control');
  assert.match(html, new RegExp(NOT_SHARED));
  assert.doesNotMatch(html, /0 of them have not replied/);
});

test('a refused guest read says only that — not shared, and not zero', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'guest', guestsMeasured: false });
  assert.match(html, /We could not read this/);
  assert.doesNotMatch(html, /Not shared with you/, 'refused is a different fact from withheld');
});

test('no slug ⇒ the read still paints, the door does not', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'guest', slug: null });
  assert.match(html, /seat finder/i, 'the description survives');
  assert.doesNotMatch(html, /href="\/null/, 'never a link to `/null`');
  assert.doesNotMatch(html, /Open the stage they are on/, 'and no door label without a door');
});

// ── EVERY MARK CARRIES A WORD ──────────────────────────────────────────────

test('every ●/◐/○ is spoken — a glyph alone tells a screen-reader user nothing', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'supplier' });
  assert.match(html, /Yes:/);
  assert.match(html, /Partly:/);
  assert.match(html, /No:/);
});

// ── WHO × WHEN — both choices reach the read ───────────────────────────────

test('⭐ WHO × WHEN · a guest on the day is sent to the day, and the read says both', async () => {
  const html = await paint({ memberType: 'couple', viewas: 'guest', stage: 'event' });
  assert.equal(checkedRole(html), 'guest', 'WHO reached the render');
  const card = armedCard(html, 'guest');
  const { PUBLIC_STAGE_LABELS } = await import('@/lib/public-site-stage-labels');
  assert.ok(card.includes(`Scanned a QR · ${PUBLIC_STAGE_LABELS.event}`), 'the eyebrow names who AND when');
  assert.match(card, /href="\/maria-and-jomar\?phase=event"/, 'the door opens the stage PICKED, not today\u2019s');
  assert.doesNotMatch(card, /phase=rsvp/, 'today\u2019s stage must not leak into an on-the-day read');
});

test('⭐ WHO × WHEN · the host picking a stage that is not today gets that stage, not the bare page', async () => {
  const later = await paint({ memberType: 'couple', viewas: 'host', stage: 'editorial' });
  assert.match(armedCard(later, 'host'), /href="\/maria-and-jomar\?phase=editorial"/);
  const { PUBLIC_STAGE_LABELS } = await import('@/lib/public-site-stage-labels');
  assert.ok(armedCard(later, 'host').includes(`Host · ${PUBLIC_STAGE_LABELS.editorial}`));
  // Today's stage is the bare address — the page the QR opens, pin and all.
  const today = await paint({ memberType: 'couple', viewas: 'host' });
  assert.match(armedCard(today, 'host'), /href="\/maria-and-jomar"[^>]*target="_blank"/);
});

test('⛔ WHO × WHEN · the stranger still has no door at ANY stage', async () => {
  for (const stage of ['save_the_date', 'rsvp', 'event', 'editorial']) {
    const html = await paint({ memberType: 'couple', viewas: 'stranger', stage });
    assert.doesNotMatch(armedCard(html, 'stranger'), /target="_blank"/, `a signed-in door leaked at ${stage}`);
  }
});

