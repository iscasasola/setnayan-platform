/**
 * a-fixed-block-has-its-own-background.test.ts — BACKGROUND FOR THE FOUR FIXED BLOCKS A GUEST REALLY SEES.
 *
 * Owner's rule (2026-10-09, verbatim): "there should always be animate and background?" → "yes that is what we are
 * doing. giving the freedom to fix their event hub." Controller's rulings (2026-10-10): the RSVP card's own three
 * tiles — None · Plain · Frosted; kept as one more key beside `motion` in `events.style_preferences.block_looks`;
 * nothing kept = today's look and today's tile shown picked; a guest's page byte-identical unless a ground is kept;
 * no new wrapper; a fixed list through the one strict reader; one card (or none), never two; the six samples grey.
 *
 * Held here:
 *   1 · THE READER IS STRICT — `g` from the fixed three; never the one a block wears anyway; nothing typed kept.
 *   2 · THE SAVE — today's tile (or none) takes the key away; the block's motion and every other block are carried.
 *   3 · THE RULES — fixed strings on fixed selectors; the RSVP card's own grounds; outside the motion's gates.
 *   4 · ONE CARD, NEVER TWO — the ground lands on the block's one card; the markup the selectors lean on is there.
 *   5 · A GUEST'S PAGE — no mark and no style unless a ground (or a motion) is kept; the page files did not change.
 *   6 · THE DRAFT CARRIES IT AND COUNTS IT — one change toward Apply, free; put back, none.
 *   7 · THE TOOLBAR — Background live on the four (E-Gifts only when real); the RSVP card's tiles and ring.
 *   8 · FIRST LOAD — nothing of it is reached by a file the Maker loads first.
 *
 * Sabotages seen red, 2026-10-10 (16, each restored and the suite green again): the reader keeping a typed value ·
 * the reader keeping today's ground (a mark served for no change) · the save keeping today's tile · a ground written
 * inside the motion's gate · E-Gifts given a second card round its door · the plate keeping its printed frame under a
 * ground · the details' bare rule reaching the plate drawing too · the draft's cleaner dropping the key · Background
 * live on a block with nothing drawn · the rows out of the four-row frame · today's tile kept when picked · the rows
 * imported by the first-load door file · the paper's ink naming itself · a frosted card with no edge · a mark served
 * to every guest · the gifts door no longer the root's child.
 *
 * 🪑 2026-10-10 — A SAMPLE MADE REAL: YOUR SEAT. Its real block is one root in one place in the page, in three
 * drawings: the Map IS a plate (the root is the card), the Place card HOLDS a card, the Table number is bare. The
 * ground lands on that one card or, where there is none, on the root — never both — and the canvas's sample wears
 * the same ground (a plate for the Map, paper for the place card), so the same rules dress it. Held in §1 · §3 · §4
 * · §5 · §6. Sabotages seen red: the sample's Map left bare · the sample's place card left without its paper · the
 * bare rule reaching the plate · the Table number grown a card · the Map's sample shapes drawn with the plate's ink.
 *
 * 🎫 2026-10-10 — …AND THE DIGITAL PASS. Bare today (the ticket's picture is a PNG drawn on the server, with no card
 * round it), so the block's own root takes the paper or the glass — BEHIND the picture, never re-drawing it — in a
 * guest's ticket and in the canvas's sample alike. Held in §1 · §3 · §4 · §5 · §6. Sabotages seen red: the pass
 * taken as a card · the ticket grown a card of its own.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  BLOCK_GATE_OPEN,
  BLOCK_GROUNDS,
  BLOCK_GROUND_LINE,
  BLOCK_GROUND_NAME,
  BLOCK_GROUND_TODAY,
  BLOCK_LOOKS_PREF_KEY,
  BLOCK_LOOK_BLOCKS,
  blockGroundToday,
  blockLooksCss,
  blockLooksWith,
  blockLooksWithGround,
  blockSelector,
  readBlockLooks,
  type BlockGround,
  type BlockLookBlock,
} from './block-looks';
import { hubDraftCountedChanges, mergeHubDraft, planHubDraftApply, sanitizeHubDraft, type HubLiveState } from './hub-draft';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));
const L = 'app/dashboard/[eventId]/launch/_components';
const G = 'app/[slug]/_components';
const css = (looks: unknown) => blockLooksCss(readBlockLooks({ [BLOCK_LOOKS_PREF_KEY]: looks }));

const NONE = 'background:transparent!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;';
/** A card that turns to glass is given its one-pixel edge outright (the plate has none of its own to recolour). */
const EDGE = 'border-width:1px!important;border-style:solid!important;';
const FROST = 'background:var(--sn-glass-bg)!important;border-color:var(--sn-glass-line)!important;backdrop-filter:var(--sn-glass-blur)!important;-webkit-backdrop-filter:var(--sn-glass-blur)!important;';

test('1 · the reader is strict: a ground from the fixed three, never the one the block wears anyway', () => {
  assert.deepEqual([...BLOCK_GROUNDS], ['none', 'plain', 'frost']);
  assert.deepEqual(BLOCK_GROUND_TODAY, { entourage: 'none', details: null, gifts: 'plain', spotlight: 'plain', find_your_seat: null, pass: 'none' });
  assert.deepEqual(
    readBlockLooks({
      block_looks: {
        entourage: { g: 'frost', motion: { in: { fade: true } } },
        details: { g: 'none' },
        gifts: { g: 'red; } body{display:none' },
        spotlight: { g: ['frost'] },
        announcements: { g: 'frost' } /* a sample: not kept */,
      },
    }),
    { entourage: { motion: { in: { fade: true } }, g: 'frost' }, details: { g: 'none' } },
  );
  /* Today's own ground would change nothing — kept, it would serve every guest a mark for no reason. */
  for (const block of BLOCK_LOOK_BLOCKS) {
    const today: BlockGround | null = BLOCK_GROUND_TODAY[block];
    if (today) assert.deepEqual(readBlockLooks({ block_looks: { [block]: { g: today } } }), {}, `${block}: today’s ground is kept as a look`);
    for (const g of BLOCK_GROUNDS) if (g !== today) assert.deepEqual(readBlockLooks({ block_looks: { [block]: { g } } }), { [block]: { g } });
  }
  for (const bad of [null, 1, true, '', 'Frost', 'FROST', 'glass', 'transparent', {}, []]) assert.deepEqual(readBlockLooks({ block_looks: { details: { g: bad } } }), {});
  /* The details has no one answer: asked of the block as it is drawn (its plate is a card; its other drawings bare). */
  const drawn = (plate: boolean) => ({ querySelector: (sel: string) => (sel === ':scope > .pahina-plate' && plate ? {} : null) }) as unknown as Element;
  assert.equal(blockGroundToday('details', drawn(true)), 'plain');
  assert.equal(blockGroundToday('details', drawn(false)), 'none');
  assert.equal(blockGroundToday('details', null), 'plain', 'a block that cannot be asked is taken as its default drawing');
  assert.equal(blockGroundToday('entourage', drawn(true)), 'none');
  assert.equal(blockGroundToday('gifts', drawn(false)), 'plain');
  assert.equal(blockGroundToday('spotlight', null), 'plain');
  /* 🪑 Nor has Your seat: asked of the block as it is drawn — the Map is a plate (the root itself), the Place card
     holds a card (a guest's own, or the canvas's sample one level down), the Table number has none. */
  const seat = (rootIs: string[], holds: string[]) =>
    ({ matches: (sel: string) => rootIs.includes(sel), querySelector: (sel: string) => (holds.includes(sel) ? {} : null) }) as unknown as Element;
  assert.equal(blockGroundToday('find_your_seat', seat(['.pahina-plate'], [])), 'plain');
  assert.equal(blockGroundToday('find_your_seat', seat([], [':scope > .bg-paper-deep'])), 'plain');
  assert.equal(blockGroundToday('find_your_seat', seat([], [':scope > [data-maker-sample] > .bg-paper-deep'])), 'plain');
  assert.equal(blockGroundToday('find_your_seat', seat([], [])), 'none');
  assert.equal(blockGroundToday('find_your_seat', null), 'plain', 'a block that cannot be asked is taken as its default drawing (the Map)');
});

test('2 · the save: today’s tile (or none) takes the key away; the motion and every other block are carried', () => {
  const prefs = { qr: { shape: 'dots' }, [BLOCK_LOOKS_PREF_KEY]: { entourage: { motion: { in: { fade: true } } }, later: { x: 1 } } };
  assert.deepEqual(blockLooksWithGround(prefs, 'entourage', 'frost'), { entourage: { motion: { in: { fade: true } }, g: 'frost' }, later: { x: 1 } });
  assert.deepEqual(blockLooksWithGround(prefs, 'details', 'none'), { ...prefs[BLOCK_LOOKS_PREF_KEY], details: { g: 'none' } });
  /* Back to today: nothing is kept for the block — and a block with nothing left is gone from the value. */
  const dressed = { [BLOCK_LOOKS_PREF_KEY]: { spotlight: { g: 'frost' }, entourage: { g: 'plain', motion: { in: { blur: true } } } } };
  assert.deepEqual(blockLooksWithGround(dressed, 'spotlight', null), { entourage: { g: 'plain', motion: { in: { blur: true } } } });
  assert.deepEqual(blockLooksWithGround(dressed, 'spotlight', 'plain'), { entourage: { g: 'plain', motion: { in: { blur: true } } } }, 'today’s tile is kept');
  assert.deepEqual(blockLooksWithGround(dressed, 'entourage', 'none'), { spotlight: { g: 'frost' }, entourage: { motion: { in: { blur: true } } } }, 'today’s tile is kept');
  assert.deepEqual(blockLooksWithGround({}, 'gifts', 'plain'), {});
  assert.deepEqual(blockLooksWithGround({}, 'gifts', 'glass' as BlockGround), {}, 'a value off the list is written');
  /* …and Animate's save leaves the ground where it is (the two keys never tread on each other). */
  assert.deepEqual(blockLooksWith(dressed, 'entourage', null), { spotlight: { g: 'frost' }, entourage: { g: 'plain' } });
});

test('3 · the rules: fixed strings on fixed selectors, the RSVP card’s own grounds, outside the motion’s gates', () => {
  assert.equal(css({}), '');
  assert.equal(css({ entourage: { g: 'none' }, gifts: { g: 'plain' }, spotlight: { g: 'plain' } }), '');
  /* The two grounds are the RSVP card's, word for word (`lib/rsvp-look.ts` `CARD_GROUND`). */
  const RSVP = raw('lib/rsvp-look.ts');
  assert.ok(RSVP.includes(`none: '${NONE}',`) && RSVP.includes(`'${FROST}',`), 'the RSVP card’s grounds changed — a block’s must follow');

  const at = (b: BlockLookBlock) => blockSelector(b);
  /* Happening now IS a card: it goes bare, or to glass. Nothing is put round it. */
  assert.equal(css({ spotlight: { g: 'none' } }), `${at('spotlight')}{${NONE}--color-ink:inherit!important;color:inherit!important;--pahina-frame-opacity:0!important;}`);
  assert.equal(css({ spotlight: { g: 'frost' } }), `${at('spotlight')}{${FROST}${EDGE}--pahina-frame-opacity:0!important;}`);
  /* E-Gifts: its one card is the door INSIDE it. */
  assert.equal(css({ gifts: { g: 'none' } }), `${at('gifts')} > a{${NONE}--color-ink:inherit!important;color:inherit!important;--pahina-frame-opacity:0!important;}`);
  assert.equal(css({ gifts: { g: 'frost' } }), `${at('gifts')} > a{${FROST}${EDGE}--pahina-frame-opacity:0!important;}`);
  /* The Wedding March stands bare: the block itself takes the hub's paper (the plate's own) or the glass. */
  const PAPER = '--block-ink:var(--color-ink-on-plate, var(--color-ink));color:rgb(var(--block-ink));background:rgb(var(--color-paper-deep))!important;border:1px solid rgb(var(--block-ink) / 0.1)!important;padding:1.25rem!important;';
  /* The paper's ink is handed to what is INSIDE the block (a variable that names itself is thrown away whole, and the
     edge with it — measured: no border at all). */
  const INSIDE = '--color-ink:var(--block-ink);';
  const GLASS = `border:1px solid var(--sn-glass-line)!important;padding:1.25rem!important;${FROST}`;
  assert.equal(css({ entourage: { g: 'plain' } }), `${at('entourage')}{${PAPER}}\n${at('entourage')} > *{${INSIDE}}`);
  assert.doesNotMatch(css({ entourage: { g: 'plain' }, details: { g: 'plain' } }), /--color-ink:[^;}]*var\(--color-ink\)/, 'a variable that names itself: the engine drops it, and the edge beside it');
  assert.equal(css({ entourage: { g: 'frost' } }), `${at('entourage')}{${GLASS}}`);
  /* The details: its plate where it has one, the block itself where it has none — never both at once. */
  const plate = `${at('details')} > .pahina-plate`;
  const bare = `${at('details')}:not(:has(> .pahina-plate))`;
  assert.equal(css({ details: { g: 'none' } }), `${plate}{${NONE}--color-ink:inherit!important;color:inherit!important;--pahina-frame-opacity:0!important;}`);
  assert.equal(css({ details: { g: 'plain' } }), `${bare}{${PAPER}}\n${bare} > *{${INSIDE}}`);
  assert.equal(css({ details: { g: 'frost' } }), `${plate}{${FROST}${EDGE}--pahina-frame-opacity:0!important;}\n${bare}{${GLASS}}`);

  /* 🪑 Your seat: its one card wherever the drawing keeps it — the root when it is a plate, the place card inside (a
     guest's, or the sample's) — and the block itself where it has none (the Table number). Never both at once. */
  const seatCards = `${at('find_your_seat')}.pahina-plate,${at('find_your_seat')} > .bg-paper-deep,${at('find_your_seat')} > [data-maker-sample] > .bg-paper-deep`;
  const seatBare = `${at('find_your_seat')}:not(.pahina-plate):not(:has(> .bg-paper-deep, > [data-maker-sample] > .bg-paper-deep))`;
  assert.equal(css({ find_your_seat: { g: 'none' } }), `${seatCards}{${NONE}--color-ink:inherit!important;color:inherit!important;--pahina-frame-opacity:0!important;}`);
  assert.equal(css({ find_your_seat: { g: 'plain' } }), `${seatBare}{${PAPER}}\n${seatBare} > *{${INSIDE}}`);
  assert.equal(css({ find_your_seat: { g: 'frost' } }), `${seatCards}{${FROST}${EDGE}--pahina-frame-opacity:0!important;}\n${seatBare}{${GLASS}}`);

  /* 🎫 The pass stands bare, like the March: the block itself takes the paper or the glass — behind the ticket. */
  assert.equal(css({ pass: { g: 'none' } }), '');
  assert.equal(css({ pass: { g: 'plain' } }), `${at('pass')}{${PAPER}}\n${at('pass')} > *{${INSIDE}}`);
  assert.equal(css({ pass: { g: 'frost' } }), `${at('pass')}{${GLASS}}`);

  /* NOT A MOVEMENT: a ground is written outside both gates (it shows on every engine, and for a guest who asked for
     less motion); the motion stays inside them, after it. */
  const both = css({ entourage: { g: 'frost', motion: { in: { fade: true } } } });
  assert.ok(both.startsWith(`${at('entourage')}{${GLASS}}\n${BLOCK_GATE_OPEN}\n`) && both.endsWith('\n}}'), both.slice(0, 200));
  assert.equal(both.split(BLOCK_GATE_OPEN).length, 2);
  assert.doesNotMatch(both.slice(both.indexOf(BLOCK_GATE_OPEN)), /sn-glass|padding/, 'a ground is written inside the motion’s gates');
  /* Nothing a person typed can be in it. */
  assert.equal(css({ gifts: { g: 'none; } body{display:none} .x{' }, details: { g: 'url(x)' } }), '');
});

test('4 · one card, never two: the markup each ground leans on is there', () => {
  /* The plate — the hub's paper, whose paper · edge · room · ink a bare block borrows, and whose printed inner frame
     a ground switches off through the plate's own variable. */
  const CSS = raw('app/globals.css');
  const plate = CSS.slice(CSS.indexOf('.sn-editorial .pahina-plate {'), CSS.indexOf('.sn-editorial .pahina-rule {'));
  for (const line of [
    'var(--color-ink-on-plate, var(--color-ink))',
    'background: rgb(var(--color-paper-deep));',
    'border: 1px solid rgb(var(--color-ink) / 0.1);',
    'padding: 1.25rem;',
    'opacity: var(--pahina-frame-opacity, 1);',
  ]) assert.ok(plate.includes(line), `the plate no longer says “${line}” — a block’s paper must follow it`);
  for (const token of ['--sn-glass-bg:', '--sn-glass-line:', '--sn-glass-blur:']) assert.ok(CSS.includes(token), `${token} is gone`);

  /* THE DETAILS: the plate is a direct child of the block's root in its default drawing; the other two have none. */
  const DETAILS = src(`${G}/empty-states.tsx`);
  assert.match(DETAILS, /<section className="space-y-4">\s*<p className="pahina-eyebrow">\s*<span>The details<\/span>\s*<\/p>\s*<div className="pahina-plate space-y-5">/);
  assert.doesNotMatch(src(`${G}/event-details-styles.tsx`), /pahina-plate/, 'Big date or Card grew a plate: the block would wear two grounds');
  /* E-GIFTS: an eyebrow, then its one door — a link, the root's direct child. */
  const GIFTS = src(`${G}/guest-doorway-strip.tsx`);
  assert.match(GIFTS, /<section className="space-y-3" data-welcome-gifts=""[^>]*>\s*<p className="pahina-eyebrow">\s*<span>E-Gifts<\/span>\s*<\/p>\s*<GiftDoorCard href=\{href\} words=\{words\} \/>\s*<\/section>/);
  assert.match(GIFTS, /function GiftDoorCard\([^)]*\) \{\s*return \(\s*<DoorCard/);
  assert.match(GIFTS, /return \(\s*<Link\s+href=\{href\}\s+className="group flex items-center gap-3 rounded-2xl border border-ink\/10 bg-cream /);
  /* HAPPENING NOW: the block's root is the card itself. */
  assert.match(src(`${G}/spotlight-card.tsx`), /return \(\s*<Link\s+href=\{content\.href\}\s+className="group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-ink\/10 bg-cream\/70 /);
  /* THE WEDDING MARCH: bare in all three drawings — no card of its own for a ground to double. */
  for (const file of [`${G}/entourage-section.tsx`, `${G}/entourage-styles.tsx`]) assert.doesNotMatch(src(file), /pahina-plate|rounded-2xl border/, `${file}: the March grew a card of its own`);
  assert.match(src(`${G}/entourage-section.tsx`), /<section id=\{id\} className="scroll-mt-6 space-y-6">/);

  /* 🪑 YOUR SEAT, each guest's own (`your-seat-block.tsx` · `your-seat-styles.tsx`): the Map's root is the plate; the
     Place card holds ONE paper card, the root's direct child; the Table number has neither. */
  const SEAT = src(`${G}/your-seat-block.tsx`);
  const SEATS = src(`${G}/your-seat-styles.tsx`);
  assert.match(SEAT, /return \(\s*<section\s+className=\{`pahina-plate sm:p-6 \$\{/);
  assert.equal((SEAT.match(/<section/g) ?? []).length, 1, 'the Map grew a second root');
  assert.match(SEATS, /<section className="space-y-5" data-scene-style="place-card">[\s\S]{0,200}?<div className="mx-auto max-w-xs border border-ink\/15 bg-paper-deep /);
  assert.equal((SEATS.match(/bg-paper-deep/g) ?? []).length, 1, 'a second paper card in the seat’s drawings: a ground would land on both');
  assert.doesNotMatch(SEATS, /pahina-plate/, 'a seat drawing other than the Map grew a plate');
  const tableNumber = SEATS.slice(SEATS.indexOf('export function SeatTableNumber'), SEATS.indexOf('export function SeatPlaceCard'));
  assert.match(tableNumber, /<section className="space-y-4 text-center" data-scene-style="table-number">/);
  assert.doesNotMatch(tableNumber, /bg-paper-deep|rounded-2xl border|shadow-sm/, 'the Table number grew a card: it is taken as bare');
  /* …and THE CANVAS'S SAMPLE wears the same ground, so the same rules dress it: the Map's sample on the plate, the
     place card's sample on paper — one level down, in the sample's own box, where the rule looks for it. */
  const SAMPLE = src(`${G}/maker-fixed-parts.tsx`);
  assert.match(SAMPLE, /const SAMPLE_ROOT_GROUND: Readonly<Record<string, string>> = \{ 'find_your_seat:map': ' pahina-plate sm:p-6' \};/);
  assert.match(SAMPLE, /<section className=\{`space-y-3 text-center\$\{SAMPLE_ROOT_GROUND\[key\] \?\? ''\}`\} data-maker-day-part=\{part\} data-maker-day-sample=\{key\}>/);
  assert.match(SAMPLE, /'find_your_seat:place-card': \(\) => \(\s*<span className="[^"]*\bbg-paper-deep\b[^"]*">/);
  assert.match(SAMPLE, /<div aria-hidden data-maker-sample=\{key\}>\s*\{DAY_SAMPLE\[key\]!\(\)\}\s*<\/div>/);
  const seatSamples = SAMPLE.slice(SAMPLE.indexOf("'find_your_seat:map'"), SAMPLE.indexOf("'photos_of_you:grid'"));
  /* ON THE PLATE THE `ink` UTILITIES DRAW NOTHING (the plate's `--color-ink` names itself — the same trap §3 holds
     for the paper's ink), so the Map's sample shapes are tinted from the words' own colour: with `bg-ink/…` the six
     tables vanished and the plate stood empty (seen in the Maker lab, 2026-10-10). */
  const mapSample = seatSamples.slice(0, seatSamples.indexOf("'find_your_seat:table-number'"));
  assert.doesNotMatch(mapSample, /\b(?:bg|border|text)-ink\b/, 'a shape of the Map’s sample is drawn with the plate’s own ink: it will not show');
  assert.equal((mapSample.match(/bg-\[color:color-mix\(in_srgb,currentColor_\d+%,transparent\)\]/g) ?? []).length, 3);
  assert.ok(CSS.includes('--color-ink: var(--color-ink-on-plate, var(--color-ink));'), 'the plate’s ink no longer names itself — the Map’s sample may use the ink utilities again');
  assert.equal((seatSamples.match(/bg-paper-deep/g) ?? []).length, 1, 'a seat sample other than the place card is on paper');
  /* For every tile, a seat rule reaches the card or the bare root — never a drawing of both kinds. */
  for (const g of BLOCK_GROUNDS) {
    for (const rule of css({ find_your_seat: { g } }).split('\n').filter(Boolean)) {
      assert.notEqual(rule.includes(':not(.pahina-plate):not(:has('), /\.pahina-plate,/.test(rule), `Your seat › ${g}: a rule that reaches both drawings`);
    }
  }

  /* 🎫 THE DIGITAL PASS: the ticket's root is bare (its picture is the server's PNG; the code's white tile is the
     fall-back when the picture cannot be drawn, never a card round the block) — and so is the canvas's sample. */
  const TICKET = src(`${G}/guest-ticket.tsx`);
  assert.match(TICKET, /<section\s+id=\{PASS_ANCHOR\}\s+data-motion="pass"\s+data-guest-ticket=\{state\}\s+aria-label=\{`Your \$\{PASS_CARD_WORDS\.digitalTicket\}`\}\s+className="scroll-mt-6 text-center"\s*>/);
  assert.doesNotMatch(TICKET, /pahina-plate|bg-paper-deep|rounded-2xl border|bg-cream/, 'the ticket grew a card of its own: a ground would draw a second one round it');
  const passSample = src(`${G}/maker-guest-scenes.tsx`);
  assert.match(passSample, /<section className="flex flex-col items-center gap-2 text-center" data-maker-guest-scene="pass">/);
  assert.doesNotMatch(passSample.slice(passSample.indexOf('data-maker-guest-scene="pass"'), passSample.indexOf('data-maker-guest-scene="rsvp"')), /pahina-plate|bg-paper-deep|rounded-2xl border|bg-cream/);

  /* So, for every block and every tile, at most ONE thing is given paper or glass — and where a block has a card of
     its own, nothing is ever put round it. */
  for (const g of BLOCK_GROUNDS) {
    for (const block of ['gifts', 'spotlight'] as const) {
      const rules = css({ [block]: { g } }).split('\n').filter(Boolean);
      assert.ok(rules.length <= 1, `${block} › ${g}: two rules`);
      assert.doesNotMatch(rules.join(''), /block-ink/);
      assert.doesNotMatch(rules.join(''), /padding|paper-deep/, `${block} › ${g}: a second card is drawn round the block’s own`);
    }
    const details = css({ details: { g } }).split('\n').filter(Boolean);
    assert.equal(details.filter((r) => r.includes(':not(:has(> .pahina-plate))')).length + details.filter((r) => r.includes(' > .pahina-plate{')).length, details.length, 'a details rule that reaches both drawings');
    /* …and only ONE rule of a block ever gives paper or glass (the others hand the ink on, nothing more). */
    for (const block of BLOCK_LOOK_BLOCKS) {
      const grounds = css({ [block]: { g } }).split('\n').filter((r) => /background:(?!transparent)/.test(r));
      assert.ok(block === 'details' || block === 'find_your_seat' ? grounds.length <= 2 : grounds.length <= 1, `${block} › ${g}: ${grounds.length} grounds`);
    }
  }
  /* A plate given a ground gives up its printed inner frame (a second frame inside the first). */
  for (const g of ['none', 'frost'] as const) assert.match(css({ details: { g } }), / > \.pahina-plate\{[^}]*--pahina-frame-opacity:0!important;\}/);
});

test('5 · a guest’s page: no mark and no style unless something is kept; the page’s own files carry no new code', () => {
  /* With nothing kept — or only what a block wears anyway — the reader hands the page NOTHING: no mark, no <style>. */
  for (const nothing of [undefined, {}, { entourage: {} }, { find_your_seat: {} }, { pass: {} }, { entourage: { g: 'none' }, gifts: { g: 'plain' }, spotlight: { g: 'plain' }, details: { g: 'paper' }, find_your_seat: { g: 'paper' }, pass: { g: 'none' } }]) {
    assert.deepEqual(readBlockLooks({ [BLOCK_LOOKS_PREF_KEY]: nothing }), {});
    assert.equal(css(nothing), '');
  }
  /* The page asks the one reader, and draws a mark for a block only when the reader kept something for it, and the one
     style only when there is a rule — the same two lines Animate shipped with (no new wrapper, no new attribute). */
  const BODY = src(`${G}/site-body.tsx`);
  assert.match(BODY, /const blockMark = \(block: BlockLookBlock\) => \(isEditorCanvas \|\| blockLooks\[block\] \? <span hidden \{\.\.\.\{ \[BLOCK_MARK_ATTR\]: block \}\} \/> : null\);/);
  assert.match(BODY, /\{blockCss \|\| isEditorCanvas \? <style \{\.\.\.\{ \[BLOCK_LOOKS_STYLE_ATTR\]: '' \}\}>\{blockCss\}<\/style> : null\}/);
  /* 🔁 RE-AIMED 2026-10-10 (a sample made real): 5 → 7. The two new ones are Your seat's — the mark that rides with
     the real block (`seatBlock`, one const for both of its slots) and the one before the canvas's sample of a day's
     part whose real block takes a look (`sampleBlockMark`). The claim is the same: every place a block is marked
     was walked, and its ground lands on one card there. */
  assert.equal((BODY.match(/blockMark\(/g) ?? []).length, 7, 'a block is marked in a new place (or one fewer): re-walk where its ground lands');
  /* Nothing about a ground is said in the page's own files: it is all behind the reader and the rules. */
  for (const file of [`${G}/site-body.tsx`, `${G}/editor-bridge.tsx`, `${G}/empty-states.tsx`, `${G}/guest-doorway-strip.tsx`, `${G}/spotlight-card.tsx`, `${G}/entourage-section.tsx`, `${G}/your-seat-block.tsx`, `${G}/your-seat-styles.tsx`, `${G}/maker-fixed-parts.tsx`, `${G}/guest-ticket.tsx`, `${G}/maker-guest-scenes.tsx`, 'app/[slug]/page.tsx']) {
    assert.doesNotMatch(src(file), /blockGround|BLOCK_GROUND|data-block-ground/, `${file} grew code for a block’s background`);
  }
  /* Happening now is drawn in two places — both stand behind the one mark, so the ground reaches both. */
  assert.equal((BODY.match(/blockMark\('spotlight'\)/g) ?? []).length, 2);
  /* THE MAKER LAB draws two of the four for real (the March, E-Gifts): each mark right BEFORE the real block — inside
     the lab's own wrapper, or a ground would dress the lab's padding and miss the door — and the one style on both of
     its canvases (The Day's had the March's mark and no style: a look picked there drew nothing, seen 2026-10-10). */
  const LAB = src('app/dev/maker-lab/guest/page.tsx');
  assert.match(LAB, /<span hidden \{\.\.\.\{ \[BLOCK_MARK_ATTR\]: 'entourage' \}\} \/>\s*<EntourageSection /);
  assert.match(LAB, /<span hidden \{\.\.\.\{ \[BLOCK_MARK_ATTR\]: 'gifts' \}\} \/>\s*\{words \? <WelcomeGifts /);
  assert.equal((LAB.match(/<style \{\.\.\.\{ \[BLOCK_LOOKS_STYLE_ATTR\]: '' \}\}>/g) ?? []).length, 2, 'a lab canvas draws the blocks with no style for their looks');
  /* …and The Day's pages there draw a day's part as the canvas's own sample: the mark of one whose real block takes a
     look stands right before the sample, inside the lab's wrapper. */
  assert.match(src('app/dev/maker-lab/guest/lab-day.tsx'), /\{block \? <span hidden \{\.\.\.\{ \[BLOCK_MARK_ATTR\]: block \}\} \/> : null\}\s*<MakerDayPartStandIn /);
  /* …and the pass's sample there is handed the block's mark before the Maker's marker, as the real canvas hands it. */
  assert.match(src('app/dev/maker-lab/guest/lab-day.tsx'), /mark=\{\(key\) => <>\{blockOfCanvas\(key\) \? <span hidden \{\.\.\.\{ \[BLOCK_MARK_ATTR\]: blockOfCanvas\(key\) \}\} \/> : null\}\{mark\(key\)\}<\/>\}/);
});

test('6 · the draft carries it and counts it: one change toward Apply, free; put back, none', () => {
  const look = { details: { g: 'frost' }, entourage: { g: 'plain', motion: { in: { fade: true } } } };
  const part = sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: look } } });
  assert.deepEqual(part?.events.style_preferences, { [BLOCK_LOOKS_PREF_KEY]: look }, 'the draft’s cleaner drops a block’s background');
  const merged = mergeHubDraft(part!, sanitizeHubDraft({ events: { style_preferences: { camera_look: 'film' } } })!);
  assert.deepEqual((merged.events.style_preferences as Record<string, unknown>)[BLOCK_LOOKS_PREF_KEY], look);

  const counted = (draft: ReturnType<typeof sanitizeHubDraft>, live: unknown) => hubDraftCountedChanges(planHubDraftApply(draft, { events: { style_preferences: live }, widgets: {} } as unknown as HubLiveState, false));
  const ground = sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: { spotlight: { g: 'none' } } } } });
  const moved = counted(ground, {});
  assert.equal(moved.length, 1, 'a block’s background does not move the Apply count');
  assert.equal(moved[0]!.held, false, 'a block’s background is held as if it were Pro — it is free');
  /* …a sample made real counts the same: Your seat's background is one change, free. */
  const seated = counted(sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: { find_your_seat: { g: 'frost' } } } } }), {});
  assert.equal(seated.length, 1, 'Your seat’s background does not move the Apply count');
  assert.equal(seated[0]!.held, false);
  const ticketed = counted(sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: { pass: { g: 'plain' } } } } }), {});
  assert.equal(ticketed.length, 1, 'the pass’s background does not move the Apply count');
  assert.equal(ticketed[0]!.held, false);
  /* A ground added beside a motion that is already live is a change too… */
  assert.equal(counted(sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: look } } }), { [BLOCK_LOOKS_PREF_KEY]: { entourage: { motion: { in: { fade: true } } } } }).length, 1);
  /* …and the same value over itself, or today's tile over nothing (the save writes `{}`), is not. */
  assert.equal(counted(part, { [BLOCK_LOOKS_PREF_KEY]: look }).length, 0, 'an unchanged look counts as a change');
  const back = sanitizeHubDraft({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: blockLooksWithGround({}, 'spotlight', 'plain') } } });
  assert.equal(back ? counted(back, {}).length : 0, 0, 'today’s tile counts as a change');
});

test('7 · the toolbar: Background is live on the four (E-Gifts only when real), with the RSVP card’s tiles', () => {
  const TOOLS = src(`${L}/stage-tools.tsx`);
  assert.match(TOOLS, /const ownTool = \(t: MakerPartTool\) => \(rsvpLooks && \(t === 'bg' \|\| t === 'animate'\)\) \|\| \(block !== null && \(t === 'bg' \|\| t === 'animate'\)\);/);
  /* `block` is null for a sample, for a scene with its own canvas, and for E-Gifts with nothing drawn for a guest. */
  assert.match(TOOLS, /const block = blockAt && blockIsReal \? blockAt : null;/);
  assert.match(TOOLS, /const empty = blockAt && !blockIsReal && \(t === 'bg' \|\| t === 'animate'\) \? BLOCK_EMPTY_WHY : undefined;/);
  assert.match(TOOLS, /const sample = picked && \(t === 'bg' \|\| t === 'animate'\) \? BLOCK_SAMPLE_WHY\[makerPartCanvasOn\(stageKey, picked\) \?\? ''\] : undefined;/);
  /* Its rows are the toolbar's own four, and the work area's tool stands aside for them as it does for Animate. */
  assert.match(TOOLS, /const blockGround = open && block !== null && shownTool === 'bg';/);
  assert.match(TOOLS, /data-stage-own-rows=\{blockRows \|\| blockGround \? '' : undefined\}/);
  assert.match(TOOLS, /\{blockGround && block \? <BlockGroundRows key=\{block\} block=\{block\} \/> : null\}/);
  assert.match(TOOLS, /\[data-maker-shell\]:has\(\[data-stage-tools\]\[data-stage-own-rows\]\) \[data-phone-chrome="panel"\]\{visibility:hidden;pointer-events:none\}/);

  /* THE TILES ARE THE RSVP CARD'S — the same three, in its order and its words, the same face and ring. */
  const RSVP = src(`${L}/rsvp-line-look.tsx`);
  const rsvpTiles = [...RSVP.matchAll(/\{ key: '(none|plain|frost)', name: '([^']+)' \}/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(rsvpTiles, BLOCK_GROUNDS.map((g) => [g, BLOCK_GROUND_NAME[g]]), 'a block’s tiles are not the RSVP card’s');
  const ROWS = src(`${L}/stage-panel/block-background.tsx`);
  assert.match(ROWS, /<div className=\{SP_ROWS\} data-block-ground=\{block\}/, 'the tiles are not in the toolbar’s four-row frame');
  assert.match(ROWS, /\{BLOCK_GROUNDS\.map\(\(g\) => \(\s*<button\s+key=\{g\}\s+type="button"\s+aria-pressed=\{g === picked\}\s+aria-label=\{BLOCK_GROUND_NAME\[g\]\}/);
  for (const cls of ['className={SP_BG_TILE}', 'className={SP_BG_TILE_FACE}', 'SP_BG_TILE_SLASH', 'SP_BG_TILE_NAME', 'SP_BG_TILE_TONE.ink']) {
    assert.ok(ROWS.includes(cls) && RSVP.includes(cls), `the tile lost ${cls} (the ring on the picked one is the face’s own)`);
  }
  assert.ok(ROWS.includes("background: 'linear-gradient(135deg, rgba(255,255,255,.9), rgba(217,185,154,.55))'") && RSVP.includes("background: 'linear-gradient(135deg, rgba(255,255,255,.9), rgba(217,185,154,.55))'"), 'Frosted’s face is not the RSVP card’s');
  /* One plain sentence under them. */
  assert.match(ROWS, /row-start-2[^>]*>\{BLOCK_GROUND_LINE\}<\/p>/);
  assert.equal(BLOCK_GROUND_LINE, 'Behind this block is the Look’s background — the same one every page wears.');
  for (const words of [BLOCK_GROUND_LINE, ...Object.values(BLOCK_GROUND_NAME)]) assert.doesNotMatch(words, /celebration|website|\bsite\b/i);
  /* TODAY'S TILE IS THE PICKED ONE with nothing kept — and picking it keeps nothing. */
  assert.match(ROWS, /const picked = readBlockLooks\(prefs\)\[block\]\?\.g \?\? today;/);
  assert.match(ROWS, /useEffect\(\(\) => setToday\(blockGroundToday\(block, blockOnCanvas\(block\)\)\), \[block\]\);/);
  assert.match(ROWS, /saveWhole\(blockLooksWithGround\(prefs, block, g === today \? null : g\)\)/);
  /* THE ONE SAVE — Animate's own, through the work area's draft door (`a-fixed-block-has-its-own-motion.test.ts` §5
     holds the door and the patch): on the canvas at the tap, in the draft behind it, live on Apply. */
  assert.match(ROWS, /const \{ eventId, prefs, error, saveWhole \} = useBlockLooksDraft\(\);/);
  const ANIMATE = src(`${L}/stage-panel/block-animate.tsx`);
  assert.match(ANIMATE, /export function useBlockLooksDraft\(\) \{/);
  assert.equal((ANIMATE.match(/fd\.set\('patch', /g) ?? []).length, 1, 'a second save path for the blocks’ looks');
  assert.doesNotMatch(ROWS, /hubDraftAction|makerSave|FormData/, 'Background grew a save of its own');
  assert.match(ANIMATE, /return \{ eventId, prefs, pending, error, saveWhole \};/);
});

test('8 · first load: nothing of a block’s background is reached by a file the Maker loads first', () => {
  /* The Maker's first load is AT its ceiling (507.0 of 507.0 KB, 2026-10-10). The rows are imported by the toolbar —
     itself fetched on demand — and by nothing else; the first-load door file (`details-lazy.tsx`) is not given a new
     door for them (a `dynamic()` line there is bytes on the first load). */
  for (const file of ['lib/hub-draft.ts', 'lib/maker-parts.ts', 'lib/rsvp-ask.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts', `${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, `${L}/details-lazy.tsx`]) {
    assert.doesNotMatch(src(file), /block-background|BlockGroundRows|blockLooksWithGround|BLOCK_GROUND/, `${file} is in the Maker’s first load and reaches a block’s background`);
  }
  assert.match(src(`${L}/stage-tools.tsx`), /import \{ BlockGroundRows \} from '\.\/stage-panel\/block-background';/);
  assert.match(src(`${L}/details-lazy.tsx`), /export const StageTools = dynamic\(\(\) => import\(\s*'\.\/stage-tools'\)/, 'the toolbar is no longer fetched on demand — the rows would ride the first load');
  /* The draft's first-load cleaner still only carries the key (it was not edited for this). */
  assert.match(src('lib/hub-draft.ts'), /if \(isPlainObject\(raw\.block_looks\)\) out\.block_looks = raw\.block_looks;/);
});
