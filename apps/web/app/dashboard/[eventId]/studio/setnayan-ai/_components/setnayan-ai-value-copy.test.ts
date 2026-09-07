import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  buildAiValueGroups,
  buildAiValueSpotlights,
  WEDDING_AI_VALUE_TERMS,
  type AiCapabilityId,
  type AiValueTerms,
} from './setnayan-ai-value-copy';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A birthday: host-organized, no statutory pack. The canonical non-wedding case. */
const BIRTHDAY: AiValueTerms = {
  eventWord: 'event',
  organizerNoun: 'host',
  hasStatutoryPaperwork: false,
};

const allText = (terms: AiValueTerms) =>
  buildAiValueGroups(terms)
    .flatMap((g) => [g.heading, g.blurb, ...g.caps.flatMap((c) => [c.title, c.body])])
    .join('\n');

// ── The defect this module exists to fix ───────────────────────────────────
test('a non-wedding NEVER promises PH marriage paperwork', () => {
  const text = allText(BIRTHDAY);
  for (const banned of ['Pre-Cana', 'marriage', 'PSA', 'license']) {
    assert.ok(
      !text.includes(banned),
      `Non-wedding copy must not mention "${banned}" — it promised marriage paperwork on a birthday`,
    );
  }
});

test('a wedding KEEPS the statutory paperwork promise', () => {
  const text = allText(WEDDING_AI_VALUE_TERMS);
  assert.match(text, /PH marriage paperwork/);
  assert.match(text, /Pre-Cana/);
});

test('the deadline row still promises something real without a statutory pack', () => {
  // Dropping the paperwork clause must not leave a stub. The remaining promise
  // (booking windows) is a capability the app genuinely runs for every type.
  const cap = buildAiValueGroups(BIRTHDAY)
    .flatMap((g) => g.caps)
    .find((c) => c.id === 'deadlines');
  assert.ok(cap, 'the deadlines capability must still be present');
  assert.match(cap.body, /booking windows/);
  // No dangling em-dash pair or doubled punctuation from the removed clause.
  assert.ok(!/—\s*—/.test(cap.body), 'orphaned em-dashes from the removed clause');
  assert.ok(!/\s,|,,|\s\./.test(cap.body), `punctuation broke: ${cap.body}`);
});

// ── The other two wedding-isms ─────────────────────────────────────────────
test('the demand row uses the type ORGANIZER, not "another couple"', () => {
  assert.match(allText(BIRTHDAY), /another host starts looking/);
  assert.ok(!allText(BIRTHDAY).includes('another couple'));
  assert.match(allText(WEDDING_AI_VALUE_TERMS), /another couple starts looking/);
});

test('no "reception" anywhere — a tournament has none', () => {
  for (const terms of [BIRTHDAY, WEDDING_AI_VALUE_TERMS]) {
    assert.ok(!allText(terms).toLowerCase().includes('reception'));
  }
  // ⚠ The positive half of this test used to assert the distance capability said
  // "distance to your venue" rather than "reception". That capability was REMOVED
  // 2026-08-12 — nearest-first sorting is FREE for everyone, so selling it on the
  // paid card was charging for something every couple already had. There is no
  // longer a line to check the wording of. The "reception" sweep above still runs
  // over every word of the copy, which is the half that actually guards the
  // 16 event types; keeping a match on deleted text would only have forced the
  // line back.
});

test('the shortlist blurb uses the type event word', () => {
  assert.match(allText(BIRTHDAY), /made for your event\./);
  assert.match(allText(WEDDING_AI_VALUE_TERMS), /made for your wedding\./);
});

// ── Structure invariants ───────────────────────────────────────────────────
test('every type gets the same 9 capabilities with stable ids', () => {
  const ids = (t: AiValueTerms) => buildAiValueGroups(t).flatMap((g) => g.caps.map((c) => c.id));
  const wedding = ids(WEDDING_AI_VALUE_TERMS);
  assert.equal(wedding.length, 9);
  assert.deepEqual(new Set(wedding).size, 9, 'ids must be unique — they key icons + live figures');
  // Type-awareness varies WORDS, never which capabilities exist. A non-wedding
  // must not silently lose a row, and must not gain a dormant one.
  assert.deepEqual(ids(BIRTHDAY), wedding);
});

/*
 * ── THE COVERAGE CONTRACT — replaces the old CAP_ICON drift guard ──────────
 * The nine capabilities are no longer nine cards with nine icons; they are four
 * spotlights (owner 2026-09-07: *"too wordy … more image simple impact"*). The
 * icon map that guard pinned no longer exists.
 *
 * 🔑 IT IS REPLACED RATHER THAN DELETED, AND AIMED AT THE SAME RISK. The old
 * guard existed so a capability could not be added without something to render
 * it. The way to render one is now a spotlight, so that is what gets pinned. A
 * shorter page must never be a page that quietly promises less — this is the
 * mechanism that makes "nine paragraphs went away, nine promises did not" a
 * fact instead of a comment.
 */
test('COVERAGE — every capability is shown by exactly one spotlight', () => {
  for (const terms of [WEDDING_AI_VALUE_TERMS, BIRTHDAY]) {
    const declared = buildAiValueGroups(terms).flatMap((g) => g.caps.map((c) => c.id));
    const shown = buildAiValueSpotlights(terms).flatMap((s) => s.caps);

    for (const id of declared) {
      const times = shown.filter((c) => c === id).length;
      assert.equal(times, 1, `capability "${id}" is shown ${times} times — must be exactly 1`);
    }
    // And nothing is shown that was never declared.
    for (const id of shown) {
      assert.ok(declared.includes(id), `spotlight claims "${id}", which is not a capability`);
    }
    assert.equal(shown.length, declared.length);
  }
});

/*
 * ── THE CLAIM IS IN THE SENTENCE, NOT ONLY IN THE MAPPING ─────────────────
 * `caps` is a DECLARATION: it says a spotlight speaks for `payments`. It does
 * not prove the sentence beside the picture actually mentions a payment. On its
 * own it is exactly the cheap proxy that lets a rewrite quietly drop a promise
 * while the coverage test stays green — the page would get shorter by promising
 * less, which is the one thing this redesign must not do.
 *
 * So each capability also names a word its spotlight's prose must contain. The
 * words are deliberately the PLAIN ones a reader would recognise, not internal
 * vocabulary: if a rewrite can no longer say "deposit" anywhere near the money
 * spotlight, the claim has probably gone with it.
 */
const CLAIM_IN_PROSE: Record<AiCapabilityId, RegExp> = {
  rank: /best fit/i,
  demand: /marks anyone another/i,
  date_watch: /frees up/i,
  deadlines: /booking window/i,
  next_move: /most urgent thing to do next/i,
  schedule_clash: /booked over each other/i,
  payments: /deposit/i,
  budget: /budget/i,
  price_watch: /changes their price/i,
};

test('each spotlight actually SAYS the capability it claims to cover', () => {
  for (const terms of [WEDDING_AI_VALUE_TERMS, BIRTHDAY]) {
    for (const spot of buildAiValueSpotlights(terms)) {
      for (const id of spot.caps) {
        assert.match(
          spot.d,
          CLAIM_IN_PROSE[id],
          `spotlight "${spot.t}" claims capability "${id}" but its sentence never says so:\n  ${spot.d}`,
        );
      }
    }
  }
});

test('CLAIM_IN_PROSE covers every capability — a partial map is a partial guard', () => {
  const declared = buildAiValueGroups(WEDDING_AI_VALUE_TERMS).flatMap((g) => g.caps.map((c) => c.id));
  for (const id of declared) {
    assert.ok(CLAIM_IN_PROSE[id] instanceof RegExp, `CLAIM_IN_PROSE is missing "${id}"`);
  }
  assert.equal(Object.keys(CLAIM_IN_PROSE).length, declared.length);
});

test('the component renders the shared kit rather than a second one', () => {
  // Rule 0. `_spotlights.tsx` is the shipped archetype; this page supplies
  // content to it. A hand-rolled row grid here would drift from the eight
  // public doorways the moment either side changed.
  const tsx = readFileSync(join(HERE, 'setnayan-ai-value.tsx'), 'utf8');
  assert.match(tsx, /from '@\/app\/_components\/marketing\/_spotlights'/);
  assert.match(tsx, /<Spotlights\b/);
});

test('DRIFT GUARD — no capability body hardcodes a wedding-ism', () => {
  // The whole class of bug, caught generically: build the copy for a type with
  // NO wedding traits and assert none of the wedding vocabulary survives.
  const text = allText(BIRTHDAY).toLowerCase();
  for (const word of ['couple', 'wedding', 'bride', 'groom', 'reception', 'pre-cana']) {
    assert.ok(!text.includes(word), `non-wedding copy leaked the wedding-ism "${word}"`);
  }
});

const WEDDING_ISMS = ['couple', 'wedding', 'bride', 'groom', 'reception', 'pre-cana'];

test('DRIFT GUARD — no spotlight WORDS hardcode a wedding-ism', () => {
  const text = buildAiValueSpotlights(BIRTHDAY)
    .flatMap((s) => [s.chip, s.t, s.d])
    .join('\n')
    .toLowerCase();
  for (const word of WEDDING_ISMS) {
    assert.ok(!text.includes(word), `non-wedding spotlight copy leaked "${word}"`);
  }
});

/*
 * 🖼 A PICTURE IS A CLAIM, AND NO COPY TEST CAN READ ONE.
 * `/add-ons/demo/stills/setnayan-ai-2.jpg` is a frame of our own demo scene and
 * it PRINTS the words "3 couples inquired for your date" inside the image. That
 * is true for a wedding and false for a birthday — the very wedding-ism this
 * module exists to kill, except baked into a JPEG where the sweep above is
 * blind to it. Pin the picture by name for the type it cannot describe.
 */
test('the couples-only still is never shown to a non-couple event type', () => {
  const srcs = (t: AiValueTerms) =>
    buildAiValueSpotlights(t)
      .map((s) => ('src' in s.media ? s.media.src : `film:${s.media.slug}`))
      .join('\n');

  assert.ok(
    !srcs(BIRTHDAY).includes('setnayan-ai-2.jpg'),
    'the still printing "3 couples inquired" was shown to an event with no couple',
  );
  assert.ok(
    srcs(WEDDING_AI_VALUE_TERMS).includes('setnayan-ai-2.jpg'),
    'a wedding should still get the real screen, not the fallback photograph',
  );
});

test('every spotlight picture is one of the three real roots', () => {
  // Mirrors `_components/marketing/spotlights-are-real.test.ts`, which scans
  // only `app/(shell)` and therefore cannot see this dashboard page.
  for (const terms of [WEDDING_AI_VALUE_TERMS, BIRTHDAY]) {
    for (const s of buildAiValueSpotlights(terms)) {
      if (s.media.kind === 'still') {
        assert.match(s.media.src, /^\/add-ons\/demo\/stills\/[a-z0-9-]+\.jpg$/);
      } else if (s.media.kind === 'photo') {
        assert.match(s.media.src, /^\/demo\//);
      }
      if ('alt' in s.media) assert.ok(s.media.alt.length > 10, 'alt text must describe the picture');
    }
  }
});
