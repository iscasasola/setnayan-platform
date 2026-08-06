/**
 * Front-page copy pin — the owner-approved words on `/`, and the retired ones.
 *
 * WHY THIS EXISTS. The owner approved a full repositioning of the front page on
 * **2026-07-31** (`03_Strategy/Claude_Design_Brief_2026-07-31.md` § 5), answering
 * both scope questions at the same time: the whole front page moves, and the top
 * of the funnel stays **non-sectarian** — binyag · kumpil · kasal · aqiqah live
 * on the deeper pages only. The approved words then sat in the brief and **never
 * entered the code for five days**, while `/` kept shipping the culturally
 * neutral line they replaced. Nothing noticed, because nothing was looking.
 *
 * So this test looks. It pins three things:
 *   1. the hero sub-line,
 *   2. the manifesto paragraph,
 *   3. the Ala ala dock copy (§ 5's "Pillar 01 — Ala ala · Memory Hub"),
 * asserts the RETIRED neutral sentence is gone, and asserts no faith-specific
 * rite has crept into any of the three.
 *
 * ⚠ THIS IS A PIN, NOT A DRIFT GUARD, and the difference matters. A guard that
 * compares two hand-typed things is worthless — both sides drift together (see
 * `llms-txt.ts` for the three-week version of that mistake). This test is not
 * that: the right-hand side is not a second copy of the source, it is the
 * OWNER'S APPROVAL, transcribed from § 5. Editing the page alone fails. Editing
 * both is a deliberate act that has to be done in one commit, by someone who
 * has read this docblock and knows the words are owner territory.
 *
 * If the owner changes the copy: change § 5 of the brief, change the component,
 * change the literals below — all three, same commit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const HOME_RESKIN = 'app/_components/home/HomeReskin.tsx';
const PILLARS = 'app/_components/home/pillars.tsx';

const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * Typography is not copy. The source uses curly apostrophes (’) because the rest
 * of the file does; the brief was typed with straight ones. Normalise the quote
 * family and collapse whitespace so a failure here always means the WORDS moved,
 * never that someone swapped a glyph.
 */
function norm(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop comment lines, so the guard reads the SHIPPED copy and not a docblock
 *  that quotes the retired sentence to explain why it is retired. */
function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*'));
    })
    .join('\n');
}

/** The slice of a source file between two markers (end exclusive). */
function slice(src: string, from: string, to: string, label: string): string {
  const a = src.indexOf(from);
  assert.ok(a !== -1, `${label}: could not find the opening marker ${JSON.stringify(from)}`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b !== -1, `${label}: could not find the closing marker ${JSON.stringify(to)}`);
  return src.slice(a, b);
}

// ── The owner-approved copy, transcribed from § 5 ──────────────────────────

const APPROVED_HERO_KICK = "Set na 'yan";

const APPROVED_HERO_TITLE_LINES = ['Keep your memories.', 'Plan your moments.'];

const APPROVED_HERO_SUB =
  'The Filipino way to keep a celebration — remembered by everyone who came, ' +
  'not just the couple. Plan any event, free.';

const APPROVED_MANIFESTO =
  "Setnayan is where the memories of every event in your life are kept — the ones you hold " +
  "and the ones you attend. A Filipino celebration was never one family's; it belongs to the " +
  'whole samahan — the ninong and ninang, the titos and titas, the barkada, everyone who ' +
  "showed up. So the memory shouldn't belong to one camera either. Every one of them is " +
  'holding a piece of your day. Setnayan is where those pieces come together, and everyone ' +
  'goes home with their own. Plan it, run it, remember it, and keep it, for life.';

const APPROVED_ALA_ALA_DESC =
  "Not one family's album. The whole samahan's — every photo, every clip, every story of your " +
  'day, gathered from everyone who was there, waiting for you to step back into whenever you ' +
  'miss it. Yours for life.';

/** The culturally neutral line § 5 replaced. It must not come back — anywhere. */
const RETIRED_HERO_SUB =
  'The independent hub to keep a lifetime of memories, and plan any event, free.';

/**
 * § 5: "**Deeper only** (`/alaala`, `/our-story`) — binyag · kumpil · kasal ·
 * aqiqah … **Never in the hero.**" Scoped deliberately to the three § 5 strings:
 * this asserts the OWNER'S RULE about the top of the funnel, and does not
 * pretend to police every word elsewhere on the page.
 */
const FAITH_RITES = /\b(binyag|kumpil|kasal|aqiqah|bautismo|christening)\b/i;

// ── extraction ────────────────────────────────────────────────────────────

function heroSub(): string {
  const src = stripComments(read(HOME_RESKIN));
  const block = slice(src, 'const HOME_HERO = {', '};', 'HOME_HERO');
  const m = /\bsub:\s*'([^']*)'/.exec(block);
  assert.ok(m?.[1], 'HOME_HERO.sub is not a single-quoted string literal any more — update this test');
  return norm(m[1]);
}

function heroTitleBlock(): string {
  const src = stripComments(read(HOME_RESKIN));
  return norm(slice(src, 'const HOME_HERO = {', '};', 'HOME_HERO'));
}

function manifesto(): string {
  const src = stripComments(read(HOME_RESKIN));
  const block = slice(src, 'const MANIFESTO', '];', 'MANIFESTO');
  const segments = [...block.matchAll(/\bt:\s*'([^']*)'/g)].map((m) => m[1] ?? '');
  assert.ok(segments.length > 0, 'MANIFESTO has no `t:` segments — update this test');
  // The renderer emits every word followed by a space, so the reader hears the
  // segments joined by a single space. Compare what the reader hears.
  return norm(segments.join(' '));
}

function alaAlaDesc(): string {
  const src = stripComments(read(PILLARS));
  const tile = slice(src, "id: 'hr-p1',", "id: 'hr-p2',", 'PILLAR_HEROES[0]');
  const m = /\bdesc:\s*'([^']*)'/.exec(tile);
  assert.ok(m?.[1], 'PILLAR_HEROES[0].desc is not a single-quoted string literal any more');
  return norm(m[1]);
}

// ── the pins ──────────────────────────────────────────────────────────────

test('hero sub-line is the owner-approved § 5 wording', () => {
  assert.equal(heroSub(), norm(APPROVED_HERO_SUB));
});

test('hero keeps the brand kicker and both approved headline lines', () => {
  const block = heroTitleBlock();
  assert.ok(block.includes(APPROVED_HERO_KICK), `hero kicker "${APPROVED_HERO_KICK}" is gone`);
  for (const line of APPROVED_HERO_TITLE_LINES) {
    assert.ok(block.includes(line), `hero headline line "${line}" is gone`);
  }
});

test('manifesto is the owner-approved § 5 paragraph', () => {
  assert.equal(manifesto(), norm(APPROVED_MANIFESTO));
});

test('manifesto keeps the samahan clause — the whole point of the rewrite', () => {
  const m = manifesto();
  assert.ok(
    m.includes('belongs to the whole samahan'),
    'the samahan clause is the load-bearing idea of the approved manifesto and it is missing',
  );
  assert.ok(
    m.includes('everyone goes home with their own'),
    'the "everyone goes home with their own" close is missing',
  );
});

test('Ala ala dock copy is the owner-approved § 5 wording', () => {
  assert.equal(alaAlaDesc(), norm(APPROVED_ALA_ALA_DESC));
});

test('the retired culturally neutral hero line is gone from the homepage', () => {
  for (const rel of [HOME_RESKIN, PILLARS, 'app/page.tsx']) {
    const src = norm(stripComments(read(rel)));
    assert.ok(
      !src.includes(norm(RETIRED_HERO_SUB)),
      `${rel} still ships the retired neutral sentence "${RETIRED_HERO_SUB}"`,
    );
  }
});

test('the top of the funnel stays non-sectarian (§ 5: never in the hero)', () => {
  const surfaces: Array<[string, string]> = [
    ['hero sub', heroSub()],
    ['manifesto', manifesto()],
    ['Ala ala dock copy', alaAlaDesc()],
  ];
  for (const [label, text] of surfaces) {
    const hit = FAITH_RITES.exec(text);
    assert.equal(
      hit,
      null,
      `${label} names the rite "${hit?.[0]}" — § 5 keeps faith-specific rites on the deeper pages only`,
    );
  }
});
