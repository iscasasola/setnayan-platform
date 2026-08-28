/**
 * The drafted category proposal — the rules (C4, 2026-08-28).
 *
 * The thing these tests exist to stop is narrow and expensive: a model's
 * invented key rendered beside a control that mints a PERMANENT public
 * category. Trap 3 of § 6 of the plan says it plainly — a model that "chooses
 * from a list" still has to be checked against the list, and the check happens
 * BEFORE anything is shown, never after.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DRAFTED_BY_LEXICAL,
  DRAFT_MODEL,
  MAX_NEAR_MATCHES,
  buildDraftPrompt,
  buildTradeMenu,
  lexicalDraft,
  mintKeyFor,
  parseDraftReply,
  type LiveTile,
  type LiveTrade,
} from './category-proposal-draft';

const TILES: LiveTile[] = [
  { id: 'food_cart', label: 'Food Cart', folder: 'Booths, carts & bars' },
  { id: 'kids_entertainer', label: "Kids' Entertainer", folder: 'Hosts, music & program' },
];

const TRADES: LiveTrade[] = [
  {
    key: 'sorbetes_cart',
    label: 'Sorbetes Cart',
    tileId: 'food_cart',
    branch: 'Food Cart',
    aliases: ['sorbetero'],
  },
  { key: 'ice_cream_cart', label: 'Ice Cream Cart', tileId: 'food_cart', branch: 'Food Cart' },
  {
    key: 'kids_entertainer',
    label: "Kids' Entertainer",
    tileId: 'kids_entertainer',
    branch: "Kids' Entertainer",
  },
];

function reply(body: Record<string, unknown>): string {
  return JSON.stringify(body);
}

// ── ARM 1 · the shipped ranker, for free ────────────────────────────────────

test('lexicalDraft answers from the live list with no model, and says so', () => {
  const draft = lexicalDraft('sorbetes cart', TRADES);
  assert.ok(draft, 'the live list holds this trade');
  assert.equal(draft.verdict, 'existing');
  assert.equal(draft.closestExisting, 'sorbetes_cart');
  assert.equal(draft.draftedBy, DRAFTED_BY_LEXICAL);
  assert.equal(draft.suggestedTileId, null, 'nothing is minted, so no branch is proposed');
});

test('lexicalDraft finds a trade through a REVIEWED ALIAS (C2) — the word need not be in the label', () => {
  const draft = lexicalDraft('sorbetero', TRADES);
  assert.ok(draft);
  assert.equal(draft.closestExisting, 'sorbetes_cart');
});

test('lexicalDraft returns null when nothing matches — the ONLY door to the model', () => {
  assert.equal(lexicalDraft('pet grooming for weddings', TRADES), null);
  assert.equal(lexicalDraft('sorbetes', []), null);
});

// ── ARM 2 · what a model reply is allowed to become ─────────────────────────

test('a good reply becomes a draft, with OUR labels on the near-matches', () => {
  const draft = parseDraftReply(
    reply({
      verdict: 'new',
      name: 'Pet Attendants',
      tile_id: 'kids_entertainer',
      tile_reason: 'Closest to guest-facing helpers.',
      closest_existing: null,
      near_matches: [
        { canonical_service: 'kids_entertainer', why_not: 'Guest-facing, not animal care.' },
      ],
    }),
    TILES,
    TRADES,
  );
  assert.ok(draft);
  assert.equal(draft.suggestedLabel, 'Pet Attendants');
  assert.equal(draft.suggestedTileId, 'kids_entertainer');
  assert.equal(draft.verdict, 'new');
  assert.equal(draft.draftedBy, DRAFT_MODEL);
  assert.equal(draft.nearMatches.length, 1);
  // The label is read from the live list, never from the reply — a model must
  // not be able to rename a real trade in the eyes of the person comparing it.
  assert.equal(draft.nearMatches[0]?.label, "Kids' Entertainer");
});

test('a label the model tries to supply for a near-match is IGNORED', () => {
  const draft = parseDraftReply(
    reply({
      verdict: 'new',
      name: 'Pet Attendants',
      tile_id: 'kids_entertainer',
      near_matches: [
        {
          canonical_service: 'kids_entertainer',
          label: 'Dog Handlers (deprecated)',
          why_not: 'Not the same trade.',
        },
      ],
    }),
    TILES,
    TRADES,
  );
  assert.equal(draft?.nearMatches[0]?.label, "Kids' Entertainer");
});

test('an INVENTED trade key is dropped from the near-matches, never shown', () => {
  const draft = parseDraftReply(
    reply({
      verdict: 'new',
      name: 'Pet Attendants',
      tile_id: 'food_cart',
      near_matches: [
        { canonical_service: 'dog_groomer', why_not: 'Invented — we do not have this.' },
        { canonical_service: 'ice_cream_cart', why_not: 'Food, not animals.' },
      ],
    }),
    TILES,
    TRADES,
  );
  assert.deepEqual(
    draft?.nearMatches.map((m) => m.canonicalService),
    ['ice_cream_cart'],
  );
});

test('an INVENTED tile becomes "we could not place this", never a fake branch', () => {
  const draft = parseDraftReply(
    reply({
      verdict: 'new',
      name: 'Pet Attendants',
      tile_id: 'pets_and_animals',
      tile_reason: 'It belongs with animals.',
      near_matches: [],
    }),
    TILES,
    TRADES,
  );
  assert.ok(draft);
  assert.equal(draft.suggestedTileId, null);
  assert.equal(draft.tileReason, null, 'a reason for a branch that was dropped is dropped too');
});

test('verdict "existing" naming a trade we do not have KILLS the draft', () => {
  // Deliberately not demoted to `new`: presenting a failed lookup as a
  // considered "we have nothing like this" is the confidently-wrong answer the
  // plan says is worse than no answer at all.
  const draft = parseDraftReply(
    reply({ verdict: 'existing', name: 'Sorbetes', closest_existing: 'sorbetes_stall' }),
    TILES,
    TRADES,
  );
  assert.equal(draft, null);
});

test('verdict "existing" naming a real trade is kept', () => {
  const draft = parseDraftReply(
    reply({ verdict: 'existing', name: 'Sorbetes', closest_existing: 'sorbetes_cart' }),
    TILES,
    TRADES,
  );
  assert.equal(draft?.verdict, 'existing');
  assert.equal(draft?.closestExisting, 'sorbetes_cart');
});

test('near-matches are capped and de-duplicated', () => {
  const draft = parseDraftReply(
    reply({
      verdict: 'new',
      name: 'Pet Attendants',
      near_matches: [
        { canonical_service: 'sorbetes_cart', why_not: 'a' },
        { canonical_service: 'sorbetes_cart', why_not: 'b' },
        { canonical_service: 'ice_cream_cart', why_not: 'c' },
        { canonical_service: 'kids_entertainer', why_not: 'd' },
        { canonical_service: 'sorbetes_cart', why_not: 'e' },
      ],
    }),
    TILES,
    TRADES,
  );
  assert.ok(draft);
  assert.ok(draft.nearMatches.length <= MAX_NEAR_MATCHES);
  assert.equal(new Set(draft.nearMatches.map((m) => m.canonicalService)).size, draft.nearMatches.length);
});

test('a near-match with no reason is dropped — the WHY is the point', () => {
  const draft = parseDraftReply(
    reply({
      verdict: 'new',
      name: 'Pet Attendants',
      near_matches: [{ canonical_service: 'kids_entertainer', why_not: '   ' }],
    }),
    TILES,
    TRADES,
  );
  assert.deepEqual(draft?.nearMatches, []);
});

test('JSON wrapped in prose or a fenced block is still read', () => {
  const draft = parseDraftReply(
    'Here you go:\n```json\n' +
      reply({ verdict: 'new', name: 'Pet Attendants', near_matches: [] }) +
      '\n```\nHope that helps.',
    TILES,
    TRADES,
  );
  assert.equal(draft?.suggestedLabel, 'Pet Attendants');
});

test('garbage never throws and never produces a draft', () => {
  const junk = [
    '',
    'no json here at all',
    '{',
    '{"verdict":"new"}', // no name
    '{"name":"Pet Attendants"}', // no verdict
    '{"verdict":"maybe","name":"Pet Attendants"}',
    '{"verdict":"new","name":"x"}', // too short
    '[]',
    'null',
    '{"verdict":"new","name":"Pet Attendants","near_matches":"not an array"}',
    '{"verdict":"new","name":"Pet Attendants","near_matches":[null,3,"x"]}',
  ];
  for (const raw of junk) {
    const out = parseDraftReply(raw, TILES, TRADES);
    if (out) {
      // Only the last two are allowed through; both must carry no near-matches.
      assert.deepEqual(out.nearMatches, [], `unexpected near-matches from: ${raw}`);
    }
  }
});

test('an over-long name is trimmed to what the column accepts', () => {
  const draft = parseDraftReply(
    reply({ verdict: 'new', name: 'x'.repeat(300), near_matches: [] }),
    TILES,
    TRADES,
  );
  assert.equal(draft?.suggestedLabel.length, 80);
});

// ── the key the mint will actually produce ──────────────────────────────────

test('mintKeyFor mirrors the Studio slugify the action itself runs', () => {
  assert.equal(mintKeyFor('Pet Attendants'), 'pet_attendants');
  assert.equal(mintKeyFor('  Halo-Halo Station! '), 'halo_halo_station');
  assert.equal(mintKeyFor('!!!'), '');
});

// ── the prompt carries the tree and nothing else ────────────────────────────

test('the menu groups trades under their tile, so a tile can be picked at all', () => {
  const menu = buildTradeMenu(TILES, TRADES);
  assert.match(menu, /tile_id: food_cart/);
  assert.match(menu, /sorbetes_cart/);
  assert.match(menu, /Booths, carts & bars › Food Cart/);
});

test('a tile with no trades is still offered, and says so', () => {
  const menu = buildTradeMenu([{ id: 'empty_tile', label: 'Empty', folder: 'F' }], []);
  assert.match(menu, /\(none yet\)/);
});

test('the prompt carries their words and our tree — and asks for at most three near-matches', () => {
  const prompt = buildDraftPrompt('pet grooming', 'we bathe the dogs', 'MENU-HERE');
  assert.match(prompt, /pet grooming/);
  assert.match(prompt, /we bathe the dogs/);
  assert.match(prompt, /MENU-HERE/);
  assert.match(prompt, new RegExp(`at most ${MAX_NEAR_MATCHES} near_matches`));
});

test('a supplier who wrote no description does not become the word "null"', () => {
  const prompt = buildDraftPrompt('pet grooming', null, 'MENU');
  assert.match(prompt, /They wrote no description\./);
  assert.doesNotMatch(prompt, /"null"/);
});
