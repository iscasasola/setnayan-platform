import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildLeafIndex,
  cardKindLabel,
  humanizeKind,
  isCoverageLeafKind,
  leafFamilies,
  EMPTY_LEAF_INDEX,
} from '@/lib/service-card-kind';

/**
 * A CARD IS FILED UNDER THE SHOP'S OWN WORDS (owner 2026-08-28, asked twice:
 * *"yes their own words"*).
 *
 * What these assertions are actually holding, and why each one exists:
 *
 *  1. The shop's own coverage word BEATS the legacy label. That is the decision.
 *  2. Nothing ever renders a raw database key — the rule `lib/vendors.ts` wrote
 *     down on 2026-08-09 and which survived, unfixed, in six other fallbacks.
 *  3. A leaf and its legacy pill count as ONE family, so a Pabati card does not
 *     spend a second slot of a Solo plan on the family its coverage already
 *     claimed.
 *  4. An unreadable taxonomy degrades to the LEGACY behaviour, never to "every
 *     unknown word is a valid kind" — the gate must not widen when a read fails.
 *
 * ⚠ Pure by construction: `service-card-kind.ts` imports no Supabase client, so
 * this file can execute it. `server-only` is not installed in this repo, so a
 * module that reaches the server client cannot be unit-tested at all — which is
 * exactly why the RULE lives in the pure file and only the thin request wrapper
 * (`card-kind-labeller.ts`) is source-read below rather than run.
 */

// A miniature of the real tree, shaped like `getCoverageTaxonomy()` returns it.
// `pabati` is the live example: it sits under the Photo Booth branch, whose
// family the legacy `photobooth` pill also claims.
const TREE = [
  {
    folderId: 'booths',
    label: 'Booths, carts & bars',
    branches: [
      {
        tileId: 'photo_booth',
        label: 'Photo Booth',
        leaves: [
          { canonicalService: 'pabati', label: 'Pabati', allowedEventTypes: null },
          { canonicalService: 'booth_360', label: '360 Booth', allowedEventTypes: null },
        ],
      },
    ],
  },
  {
    folderId: 'planning',
    label: 'Coordinators & planners',
    branches: [
      {
        tileId: 'coordinator',
        label: 'Coordinator / Planner',
        leaves: [
          {
            canonicalService: 'day_of_coordinator',
            label: 'Day-Of Coordinators',
            allowedEventTypes: null,
          },
        ],
      },
    ],
  },
];

const INDEX = buildLeafIndex(TREE as never);

test('the shop’s own word wins over the legacy label — the whole decision', () => {
  // SetnaProd covers `pabati`. Before this, the maker bridged BY FAMILY and the
  // card read "Photobooth" — a word the supplier never chose.
  assert.equal(cardKindLabel('pabati', INDEX, 'Photobooth'), 'Pabati');
  assert.equal(
    cardKindLabel('day_of_coordinator', INDEX, 'Planner / Coordinator'),
    'Day-Of Coordinators',
  );
});

test('a legacy kind keeps its legacy label — nothing was taken away', () => {
  // The 52 remain choosable for a shop whose coverage does not cover this card.
  assert.equal(cardKindLabel('photobooth', INDEX, 'Photobooth'), 'Photobooth');
  assert.equal(cardKindLabel('catering', EMPTY_LEAF_INDEX, 'Catering'), 'Catering');
});

test('a raw database key can never reach a person', () => {
  // Both production cards hold `live_band` / `host_mc` — tile ids that are in
  // NEITHER vocabulary. Every screen used to end its fallback chain at the key.
  assert.equal(cardKindLabel('host_mc', EMPTY_LEAF_INDEX, null), 'Host Mc');
  assert.equal(cardKindLabel('live_band', EMPTY_LEAF_INDEX, null), 'Live Band');
  assert.equal(humanizeKind('pre_nup_photographer'), 'Pre Nup Photographer');
  // An empty-string label is not a label — it must not win over humanising.
  assert.equal(cardKindLabel('food_truck', EMPTY_LEAF_INDEX, '   '), 'Food Truck');
});

test('a leaf and its legacy pill count as ONE family, not two', () => {
  // `pabati` and the legacy `photobooth` pill both live under `booths`. If they
  // counted separately, a Solo shop covering Pabati would be refused a Pabati
  // card by the family cap its own coverage had already claimed.
  assert.deepEqual(leafFamilies('pabati', INDEX), ['booths']);
  assert.deepEqual(leafFamilies('day_of_coordinator', INDEX), ['planning']);
});

test('“not a leaf” and “a leaf with no family” are different answers', () => {
  // null → the caller must fall back to the legacy bridge.
  // []   → a real leaf that counts against no family, so it is never refused.
  assert.equal(leafFamilies('photobooth', INDEX), null);
  const orphan = buildLeafIndex([
    {
      folderId: '',
      label: '',
      branches: [
        {
          tileId: 't',
          label: 'T',
          leaves: [{ canonicalService: 'lonely', label: 'Lonely', allowedEventTypes: null }],
        },
      ],
    },
  ] as never);
  assert.deepEqual(leafFamilies('lonely', orphan), []);
});

test('an unreadable taxonomy degrades to LEGACY, never to “anything goes”', () => {
  // The gate must not widen when a read fails. Nothing is a leaf in an empty
  // index, so `parseCategory` falls back to the 52 and refuses the rest.
  assert.equal(isCoverageLeafKind('pabati', EMPTY_LEAF_INDEX), false);
  assert.equal(isCoverageLeafKind('anything_at_all', EMPTY_LEAF_INDEX), false);
  assert.equal(buildLeafIndex([]).label.size, 0);
  // …and a real index does not admit words that are not in it.
  assert.equal(isCoverageLeafKind('not_a_real_leaf', INDEX), false);
  assert.equal(isCoverageLeafKind('pabati', INDEX), true);
});

// ── The wiring, read as source (these modules reach the server client) ───────

const WEB = join(process.cwd());
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('the save’s gate asks the leaves, and is still a CLOSED set', () => {
  const save = read('app/vendor-dashboard/services/actions.ts');
  // `vendor_services.category` is plain TEXT and `save_vendor_service`
  // validates nothing (read out of production), so this function is the whole
  // fence. It must accept legacy OR a live leaf — and nothing else.
  assert.match(
    save,
    /CATEGORY_SET\.has\(raw\) \|\| isCoverageLeafKind\(raw, leaves\)/,
    'the save stopped accepting the shop’s own coverage words (or stopped checking at all)',
  );
  assert.match(
    save,
    /throw new Error\('Unknown service category\.'\)/,
    'the gate stopped refusing an unknown kind',
  );
  // The family cap must ask the leaf-aware helper, or a leaf card would count
  // against no family and ride straight past a Solo plan's allowance.
  //
  // 🪤 THE FIRST VERSION OF THIS ASSERTION WAS DECORATION, and only the mutation
  // caught it: `assert.match(save, /parentsOfKind\(/)` is a FILE-LEVEL match
  // over a name that appears at four call sites, so reverting ONE of them to
  // `parentsOfCategory` left three behind and the guard stayed green. A
  // file-level count cannot say which call site still asks the right question.
  // So: NO legacy-only call may survive anywhere in the save, and the leaf-aware
  // one is counted with a floor.
  assert.ok(
    !/parentsOfCategory\s*\(/.test(save),
    'a family cap in the save went back to the legacy-only helper, which cannot see a leaf',
  );
  const kindCalls = save.match(/parentsOfKind\s*\(/g) ?? [];
  assert.ok(
    kindCalls.length >= 4,
    `the save has ${kindCalls.length} leaf-aware family calls, expected at least 4 (both create paths × new + existing)`,
  );
});

test('the chooser offers the shop’s own words, and keeps the legacy list below', () => {
  const door = read('app/vendor-dashboard/services/new/page.tsx');
  // 🪤 MATCHING THE BARE NAME `coverageKindOptions` WAS DECORATION — the
  // mutation that emptied its source (`vendorCoverages.map` → `[].map`) left the
  // identifier standing and the guard passed. Pin what it is BUILT FROM.
  assert.match(
    door,
    /const coverageKindOptions = vendorCoverages\.map\(/,
    'the chooser stopped building its first band from the shop’s own coverage',
  );
  assert.match(
    door,
    /value: c\.canonical_service/,
    'the chooser offers coverage words but stores something else',
  );
  // ⚠ NARROWED, NEVER REMOVED — the 52 stay one tap below. A chooser that
  // dropped them would read as "Setnayan does not do that" to a shop growing
  // into something it does not yet cover.
  assert.match(door, /SERVICE_GROUPS\.map/, 'the legacy kinds were removed from the chooser');
  assert.match(door, /leadWithOwnWords/, 'the legacy pills stopped being re-banded');
});

test('a leaf-filed card can still be copied — the [category] route accepts it', () => {
  // "Start from one of your cards" builds `/services/new/<the card's kind>`, so
  // a route that only knows the 52 would 404 on a card the NEW door legitimately
  // created — the copy button would simply not work, with no error to explain it.
  const route = read('app/vendor-dashboard/services/new/[category]/page.tsx');
  assert.match(
    route,
    /!CATEGORY_SET\.has\(category\) && !isCoverageLeafKind\(category, leafKinds\)/,
    'the [category] route stopped accepting the shop’s own coverage words',
  );
  assert.match(route, /notFound\(\)/, 'the route stopped refusing an unknown kind entirely');
  // And its rendered name goes through the shared resolver, not the legacy-only
  // one, or a leaf card's own page would announce a humanised guess.
  assert.ok(
    !/displayServiceLabel\(/.test(route),
    'the [category] route went back to naming a kind with the legacy-only label',
  );
});

test('the labeller owns the fallback chain, and every card screen asks it', () => {
  // Six screens each wrote `isCanonicalService(cat) ? LABEL[cat] : cat`, and
  // that last branch is the raw key. The chain is written once now.
  const labeller = read('lib/card-kind-labeller.ts');
  assert.match(labeller, /cardKindLabel\(/, 'the labeller stopped using the shared rule');
  for (const screen of [
    'app/vendor-dashboard/messages/[threadId]/page.tsx',
    'app/api/vendor/chat/[threadId]/compose-options/route.ts',
    'app/vendor-dashboard/invite/page.tsx',
    'app/vendor-dashboard/_components/qr-section.tsx',
  ]) {
    const src = read(screen);
    assert.match(src, /cardKindLabeller\(\)/, `${screen} stopped asking the shared labeller`);
    // 🪤 THE FIRST VERSION LISTED THE FALLBACK SPELLINGS IT KNEW (`??` and `:`)
    // and the mutation used the third one — `|| s.category`. A deny-list of
    // spellings is a bill you keep paying, and the one you forget is the one
    // that ships. So the rule is inverted: on these screens EVERY use of a
    // card's `s.category` must sit inside a `kindLabel(...)` call. Checked
    // against the real files — there are no other uses to trip over.
    const uses = src.match(/s\.category/g) ?? [];
    const wrapped = src.match(/kindLabel\(s\.category\)/g) ?? [];
    assert.ok(
      uses.length > 0 && uses.length === wrapped.length,
      `${screen} reads a card's kind ${uses.length}× but only names it through the labeller ${wrapped.length}× — the rest can print a raw database key`,
    );
  }
});

test('the family helper is TOTAL — an unknown stored kind cannot 500 the page', () => {
  // `VENDOR_CATEGORY_CANONICAL` is a Record over the 52; an unknown key indexes
  // to undefined and `tilesForVendorCategory` throws on `.kind`. Production
  // already stores `live_band` / `host_mc`, so this was reachable.
  const rule = read('lib/vendor-category-parents.ts');
  assert.match(
    rule,
    /if \(!\(category in VENDOR_CATEGORY_CANONICAL\)\) return \[\];/,
    'parentsOfCategory can throw on an unknown stored kind again',
  );
});
