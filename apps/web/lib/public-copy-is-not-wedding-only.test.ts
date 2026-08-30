/**
 * GUARD — the two public surfaces that describe the WHOLE product may not
 * describe one seventeenth of it, and may not describe things we have not built.
 *
 * ─── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 * Measured on the live database on 2026-08-31: `event_type_vocab` carries
 * SEVENTEEN rows and every one is `status = 'active'` AND `enabled = TRUE`.
 * Meanwhile:
 *   · `app/page.tsx` — `HOME_TITLE` read "Plan your Filipino wedding free" and
 *     the SoftwareApplication JSON-LD called Setnayan "The Philippines-first
 *     wedding platform". That page is the one URL an answer engine grounds the
 *     entire brand on.
 *   · `lib/llms-txt.ts` — the lead paragraph said the other types arrive "AS
 *     THOSE EVENT TYPES UNLOCK". They were already unlocked when it said so.
 *
 * Neither could fail, throw, or typecheck red: a true sentence about a smaller
 * product is a valid sentence.
 *
 * ─── WHY THE ASSERTIONS ARE SHAPED THIS WAY ──────────────────────────────────
 * 🔑 THE HOME-PAGE ASSERTIONS RUN AGAINST COMMENT-STRIPPED SOURCE, for exactly
 * the reason `home-brand-name.test.ts` gives: `page.tsx` now carries long
 * comments explaining this very defect, and those comments quote the strings a
 * naive whole-file grep would look for. A guard that can be satisfied by its own
 * justification passes forever after the code is deleted.
 *
 * 🔑 THE DO-NOT-CLAIM CHECKS ARE NEGATIVE, AND A NEGATIVE ASSERTION IS THE EASY
 * ONE TO WRITE VACUOUSLY. Every one below was mutation-tested by inserting the
 * forbidden phrase and confirming this file goes red — see the changelog
 * fragment for the before → after counts.
 *
 * ⚠ ONE ITEM ON THE SESSION'S DO-NOT-CLAIM LIST IS DELIBERATELY NOT GUARDED:
 * multi-camera Live Studio. It is advertised on `main` today, and it CANNOT be
 * removed from llms.txt by a copy edit — `LIVE_STUDIO` is `is_active = TRUE` in
 * the catalog, and `llms-txt.test.ts`'s "every ACTIVE retail price is quoted
 * somewhere in the file" would fail the moment its prose line went. Taking the
 * claim down means taking the SKU off sale, which is an owner decision, not a
 * copy decision. Recorded rather than silently skipped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  renderLlmsTxt,
  peso,
  LIVE_EVENT_TYPES,
  liveEventTypesPhrase,
  type LlmsTxtInput,
} from './llms-txt';
import { INPUT_FOR_GUARDS } from './llms-txt-guard-input';

const HOME_PAGE = path.join(import.meta.dirname, '..', 'app', 'page.tsx');

/** Same stripper as `home-brand-name.test.ts`, and for the same reason. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const homeSource = stripComments(readFileSync(HOME_PAGE, 'utf8'));
const body = renderLlmsTxt(INPUT_FOR_GUARDS);

/**
 * The rendered file WITHOUT its denial lines.
 *
 * 🪤 THE FIRST CUT OF THIS GUARD FAILED ON ITS OWN FIX. The "Out of scope to
 * advertise here" section exists to NAME the unbuilt surfaces and deny them —
 * "No public feed and no social channel" — so a pattern hunting for `public
 * feed` matched the sentence that says there isn't one. A guard that cannot
 * survive the copy it demands is a guard nobody can keep.
 *
 * 🔑 THE EXCLUSION IS ONE LINE SHAPE, NOT ONE SECTION. Only lines beginning
 * `- No ` (and the one commission line) are dropped, wherever they appear —
 * so a claim smuggled into the middle of the out-of-scope section, or anywhere
 * after it, still fails. Dropping the whole section would have made it a hiding
 * place, which is the opposite of what it is for.
 */
const claims = body
  .split('\n')
  .filter((line) => !/^- (No |"Commission" means)/.test(line.trim()))
  .join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1 · THE COPY COVERS THE WHOLE PRODUCT
// ─────────────────────────────────────────────────────────────────────────────

test('the homepage title does not sell one event type as the whole product', () => {
  const title = /const HOME_TITLE = '([^']+)'/.exec(homeSource)?.[1];
  assert.ok(title, 'HOME_TITLE is gone from page.tsx — find it before changing this guard');
  assert.ok(
    !/\bwedding\b/i.test(title!),
    `HOME_TITLE narrows the whole platform to weddings: ${JSON.stringify(title)}. ` +
      'Seventeen event types are live and enabled in production.',
  );
});

test('the homepage description names event types beyond the wedding', () => {
  const desc = /const HOME_DESCRIPTION =\s*'([^']+)'/.exec(homeSource)?.[1];
  assert.ok(desc, 'HOME_DESCRIPTION is gone from page.tsx');
  // Wedding is ALLOWED here and is deliberately named first — it is the deepest
  // surface and the query the brand ranks for. What is forbidden is it being alone.
  const others = ['debut', 'christening', 'birthday', 'graduation', 'anniversary'];
  const named = others.filter((t) => desc!.toLowerCase().includes(t));
  assert.ok(
    named.length >= 3,
    `HOME_DESCRIPTION names only ${named.length} non-wedding event type(s) (${named.join(', ') || 'none'}). ` +
      'The description is the SERP snippet; if it lists one event type, that is the product a searcher believes we sell.',
  );
});

test('the machine-readable app description is not a wedding-only claim', () => {
  assert.ok(
    !/The Philippines-first wedding platform/i.test(homeSource),
    'The SoftwareApplication JSON-LD still calls Setnayan a "wedding platform" — ' +
      'this is the paragraph an LLM quotes when asked what Setnayan is.',
  );
  assert.ok(
    !/as those event types unlock/i.test(homeSource),
    'The JSON-LD still says event types are yet to unlock. Every row in ' +
      'event_type_vocab is already enabled = TRUE in production.',
  );
});

test('llms.txt no longer says the other event types are still to come', () => {
  assert.ok(
    !/as those event types unlock/i.test(body),
    'llms.txt still tells AI assistants the other event types have not opened yet. They have.',
  );
  assert.ok(
    !/V1 leads with weddings/i.test(body),
    'llms.txt still frames the product as weddings-with-more-later.',
  );
});

test('llms.txt names every live event type, from the one list', () => {
  for (const type of LIVE_EVENT_TYPES) {
    assert.ok(body.includes(type), `llms.txt never mentions "${type}", which is a live enabled event type`);
  }
  assert.ok(
    body.includes(liveEventTypesPhrase()),
    'the rendered list is not the one LIVE_EVENT_TYPES produces — somebody typed a second copy',
  );
  // 🔑 `wake` is the reason the surrounding copy says "event", not "celebration".
  assert.ok(LIVE_EVENT_TYPES.includes('wakes'), 'a wake is a live event type and is not a celebration');
});

test('no COUNT of event types is written into either surface', () => {
  // A numeral goes false the day the eighteenth row ships — silently, in a
  // machine-readable field. An un-extended LIST merely under-describes.
  const counted = /\b(fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(event|celebration)\s+types?\b/i;
  assert.ok(!counted.test(body), 'llms.txt writes a literal count of event types; it will go false on its own');
  assert.ok(!counted.test(homeSource), 'page.tsx writes a literal count of event types; it will go false on its own');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · THE DO-NOT-CLAIM LIST — nothing unbuilt may be advertised
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each entry is [what it is, the pattern, why it is forbidden]. Every pattern
 * was mutation-tested by inserting a sentence that matches it.
 */
const MUST_NOT_CLAIM: ReadonlyArray<readonly [string, RegExp, string]> = [
  ['a public feed', /\b(public|social)\s+feed\b|\bsocial channel\b|\bbrowse other (people|couples|families)/i,
    'no code renders a feed of other people’s events'],
  ['a business page or timeline', /\b(business|company)\s+(page|timeline|profile page of its own)\b/i,
    'a business is not an entity with a page or a history — session C4, unbuilt'],
  ['an avatar maker', /\bavatar (maker|builder|creator)\b|\b(build|create|design) your (own )?avatar\b/i,
    'guest-avatar.tsx and vendor-avatar.tsx RENDER; nothing makes one — session C5, unbuilt'],
  ['a drawn family tree', /\bfamily tree\b|\bkinship (chart|diagram|graph|map)\b/i,
    'kinship is derived but reaches no screen — session C1'],
  ['affiliate pages', /\baffiliate\b/i, 'no code'],
  ['a real published story', /\breal[- ](wedding|event) stor(y|ies) (are|is) published\b|\bread real stories from real (couples|families)\b/i,
    'every showcase is a labelled sample'],
  ['a latency or speed figure', /\b\d+\s?(ms|milliseconds)\b|\bloads? in (under )?\d|\b(fastest|instantly|real-?time) (upload|sync|render)/i,
    'nothing measures one'],
];

test('llms.txt claims nothing that has not shipped', () => {
  // Sanity: the exclusion must remove the denial lines and NOTHING else. If this
  // ever drops most of the file, the filter has gone wrong and every assertion
  // below it is vacuous.
  const dropped = body.split('\n').length - claims.split('\n').length;
  assert.ok(dropped >= 4 && dropped <= 12, `the denial filter dropped ${dropped} lines — expected the out-of-scope bullets only`);

  for (const [what, pattern, why] of MUST_NOT_CLAIM) {
    const hit = pattern.exec(claims);
    assert.equal(
      hit,
      null,
      `llms.txt advertises ${what} — ${why}. Matched: ${JSON.stringify(hit?.[0])}`,
    );
  }
});

test('the homepage metadata claims nothing that has not shipped', () => {
  for (const [what, pattern, why] of MUST_NOT_CLAIM) {
    const hit = pattern.exec(homeSource);
    assert.equal(
      hit,
      null,
      `the homepage advertises ${what} — ${why}. Matched: ${JSON.stringify(hit?.[0])}`,
    );
  }
});

/**
 * The retired CURRENCY word. Owner ruling 2026-08-29 (commit 32df56e81):
 * *"please make sure to change shots to credits."*
 *
 * ⚠ ONLY THE CURRENCY MEANING MOVED, so this pattern must not ban the word. A
 * photograph is still "a shot"; "Take the shot" and the vendor's shot list are
 * deliberately untouched. What is banned is `shots` used as the thing you BUY or
 * HOLD — a quantity of them, or a top-up of them.
 */
const SHOTS_AS_CURRENCY = /\b\d[\d,]*\s+shots\b|\b(more|extra|remaining|unused|free)\s+shots\b|\bshots?\s+(left|remaining|balance)\b/i;

test('the retired currency word never reaches public copy', () => {
  /*
    🪤 THIS GUARD EXISTS BECAUSE THE FIXTURE FAILED IT SILENTLY. Every one of the
    seventeen Papic titles in llms-txt-guard-input.ts said "add N shots" while the
    production catalogue said "add N credits", and no check anywhere noticed —
    the titles are never rendered, so nothing could go red. The homepage JSON-LD
    was selling "paid top-ups for more shots" at the same time, and that one IS
    rendered, to every answer engine.
  */
  const homeHit = SHOTS_AS_CURRENCY.exec(homeSource);
  assert.equal(homeHit, null, `the homepage sells "shots"; the currency is credits. Matched: ${JSON.stringify(homeHit?.[0])}`);
  const bodyHit = SHOTS_AS_CURRENCY.exec(body);
  assert.equal(bodyHit, null, `llms.txt sells "shots"; the currency is credits. Matched: ${JSON.stringify(bodyHit?.[0])}`);
});

test('the fixture describes the catalogue in the words the catalogue uses', () => {
  // The fixture is the guards' reference reality. If IT is a vocabulary behind,
  // a guard written against it can enforce the retired word.
  for (const row of INPUT_FOR_GUARDS.retail.filter((r) => r.is_active)) {
    assert.equal(
      SHOTS_AS_CURRENCY.exec(row.title),
      null,
      `fixture row ${row.service_code} is titled ${JSON.stringify(row.title)} — production says "credits"`,
    );
  }
});

test('the booking fee is never called a commission', () => {
  // The word "commission" is load-bearing brand copy — "0% commission" appears
  // many times and must stay. What is forbidden is the word being attached to
  // the booking fee. So the assertion is SENTENCE-SCOPED, not file-scoped: a
  // file-wide ban would be red on arrival and would have to be deleted.
  for (const sentence of body.split(/(?<=[.!?])\s+/)) {
    const both = /booking fee/i.test(sentence) && /commission/i.test(sentence);
    assert.ok(
      !both,
      `a sentence names the booking fee and calls it a commission: ${JSON.stringify(sentence)}`,
    );
  }
  assert.ok(/0% commission/.test(body), 'the 0%-commission claim is the brand promise and must still be here');
});

test('the out-of-scope section still exists and now carries the list', () => {
  assert.ok(
    body.includes('## Out of scope to advertise here'),
    'the section that withholds unshipped surfaces was deleted — it is the reason ' +
      'AI assistants are not sent to dead links',
  );
  for (const marker of ['No public feed', 'No avatar maker', 'No drawn family tree', 'No affiliate']) {
    assert.ok(body.includes(marker), `the out-of-scope list no longer withholds: ${marker}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · THE FIGURES STILL COME FROM THE CATALOG, NOT FROM THIS FILE
// ─────────────────────────────────────────────────────────────────────────────

test('every peso figure in the widened copy still resolves from a catalog row', () => {
  const known = new Set<string>([
    ...INPUT_FOR_GUARDS.retail.map((r) => peso(Number(r.retail_price_php))),
    ...INPUT_FOR_GUARDS.vendor.map((r) => peso(Number(r.price_php))),
  ]);
  const quoted = body.match(/₱[0-9][0-9,]*/g) ?? [];
  assert.ok(quoted.length > 0, 'no figures rendered at all — the fixture or the renderer is broken');
  for (const fig of quoted) {
    assert.ok(known.has(fig), `the copy quotes ${fig}, which matches no catalog row — somebody typed a literal`);
  }
});

test('repricing a row moves the copy with it — no figure is hard-coded', () => {
  // 🔑 THIS IS THE ONE THAT CATCHES A PASTED NUMBER. A literal survives a
  // reprice; a resolved figure cannot.
  const repriced: LlmsTxtInput = {
    ...INPUT_FOR_GUARDS,
    retail: INPUT_FOR_GUARDS.retail.map((r) =>
      r.service_code === 'PAKANTA' ? { ...r, retail_price_php: 7321 } : r,
    ),
  };
  const moved = renderLlmsTxt(repriced);
  const was = peso(
    Number(INPUT_FOR_GUARDS.retail.find((r) => r.service_code === 'PAKANTA')!.retail_price_php),
  );
  /*
    🪤 THE FIRST CUT ASSERTED `!moved.includes(was)` AND FAILED HONESTLY — the
    old Pakanta figure is ALSO the Thank You Video's and the retired Live Wall's,
    so a file-wide "the old number is gone" check tests set membership, which is
    the exact shape this module's docblock was written to kill: a price attached
    to the WRONG PRODUCT passes it. So the assertion is ANCHORED TO THE PRODUCT.
  */
  assert.ok(moved.includes(`**Pakanta** — ₱7,321.`), 'a catalog reprice did not reach the Pakanta line');
  assert.ok(
    !moved.includes(`**Pakanta** — ${was}`),
    `the Pakanta line still quotes ${was} after a reprice — that figure is typed into the prose`,
  );
});
