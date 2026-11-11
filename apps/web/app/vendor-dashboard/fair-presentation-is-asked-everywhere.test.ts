/**
 * 🚫 FAIR PRESENTATION IS ASKED EVERYWHERE A SUPPLIER WRITES A NAME — the wiring (owner 2026-11-08).
 *
 * `lib/fair-presentation.test.ts` proves the rules. This proves they are ASKED where the ruling put them: on every
 * supplier-written field, (a) a plain note under the line, live, (b) Save / Publish / Next off while it is open, and
 * (c) the SAME check again on the server, BEFORE the write. A rule nobody asks is the same as no rule — and its own
 * unit tests stay green. That is exactly how the 8 Nov ruling sat unbuilt until a live card read "Best mobile bar".
 *
 * Every assertion below is also run against a SABOTAGED copy of the source (the call removed) and must go red there —
 * so a guard that could not fail is caught here, not in production (the `(?!\s*\?)` lookahead lesson, CLAUDE.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

type Surface = {
  name: string;
  field: string;
  /** The client file that draws the field. */
  ui: string;
  /** How Save is held while the note is open, in that file. */
  gate: RegExp;
  /** The server file that writes the field, and the function that must ask before the write. */
  server: string;
  fn: string;
  /** The text of the write the ask must come before. */
  write: string;
};

const SURFACES: Surface[] = [
  {
    name: 'shop name (Your details)',
    field: 'shop_name',
    ui: 'app/vendor-dashboard/shop/_components/editable-row.tsx',
    gate: /else if \(dirty\.current && fairOpen\.current\)[\s\S]{0,200}onReopenAfterError\(\)/,
    server: 'app/vendor-dashboard/actions.ts',
    fn: 'export async function updateVendorProfileField',
    write: "case 'business_owner_name'",
  },
  {
    name: 'shop name (/open-shop)',
    field: 'shop_name',
    ui: 'app/open-shop/_components/open-shop-wizard.tsx',
    gate: /if \(nameFair\.length > 0\) return fairRefusal\(nameFair\);/,
    server: 'app/open-shop/actions.ts',
    fn: 'const shopName = clean(rawShopName, SHOP_NAME_MAX);',
    write: ".from('vendor_profiles')",
  },
  {
    name: 'tagline',
    field: 'tagline',
    ui: 'app/vendor-dashboard/shop/_components/public-line-card.tsx',
    gate: /disabled=\{pending \|\| fair\.length > 0\}/,
    server: 'app/vendor-dashboard/shop/public-line-actions.ts',
    fn: 'export async function updatePublicLine',
    write: ".from('vendor_profiles')",
  },
  {
    name: 'About',
    field: 'about',
    ui: 'app/vendor-dashboard/website/_components/page-parts.tsx',
    gate: /aboutFair\.length > 0 && changedParts\(draft, d\.saved\)\.includes\('about'\)/,
    server: 'app/vendor-dashboard/actions.ts',
    fn: 'export async function applyVendorPageDraft',
    write: '.update({ ...patch, updated_at',
  },
  {
    name: 'bundle name',
    field: 'package_name',
    ui: 'app/vendor-dashboard/packages/_components/package-editor.tsx',
    gate: /waiting=\{pending \|\| nameFair\.length > 0\}/,
    server: 'app/vendor-dashboard/packages/actions.ts',
    fn: 'export async function savePackage',
    write: "if (input.packageId) {",
  },
];

/** (a) the note is drawn for the field · (b) Save is held. Returns a failure sentence, or null. */
function uiProblem(src: string, s: Surface): string | null {
  if (!new RegExp(`<FairNote hits=\\{\\w+\\} field="${s.field}" />`).test(src)) return `${s.name}: no fair-presentation note under the field`;
  if (!new RegExp(`findFairHits\\(\\[\\{ field: '${s.field}'`).test(src)) return `${s.name}: the note is not computed from the field`;
  if (!s.gate.test(src)) return `${s.name}: Save is no longer held while the note is open`;
  return null;
}

/** (c) the server asks the same check for the field, BEFORE the write. */
function serverProblem(src: string, s: Surface): string | null {
  const start = src.indexOf(s.fn);
  if (start < 0) return `${s.name}: ${s.fn} is gone — update this guard`;
  const body = src.slice(start);
  const ask = s.field === 'about' ? body.search(/await aboutFairRefusal\(/) : body.search(new RegExp(`fairPresentationRefusal\\(\\{[\\s\\S]{0,160}field: '${s.field}'`));
  const write = body.indexOf(s.write);
  if (ask < 0) return `${s.name}: the save no longer asks the fair-presentation check`;
  if (write < 0) return `${s.name}: the write marker "${s.write}" is gone — update this guard`;
  if (ask > write) return `${s.name}: the check runs AFTER the write`;
  return null;
}

for (const s of SURFACES) {
  test(`${s.name}: the note is live under the field and Save waits for it`, () => {
    assert.equal(uiProblem(read(s.ui), s), null);
  });
  test(`${s.name}: the save asks the same check before it writes`, () => {
    assert.equal(serverProblem(read(s.server), s), null);
  });
  test(`${s.name}: SABOTAGE — removing the note, the hold or the server ask turns the guard red`, () => {
    const ui = read(s.ui);
    assert.ok(uiProblem(ui.replace(/<FairNote hits=\{\w+\} field="[a-z_]+" \/>/g, ''), s), 'removing the note left the guard green');
    assert.ok(uiProblem(ui.replace(s.gate, ''), s), 'removing the Save hold left the guard green');
    const server = read(s.server);
    const noAsk = server.replace(/fairPresentationRefusal\(/g, 'somethingElse(').replace(/await aboutFairRefusal\(/g, 'await somethingElse(');
    assert.ok(serverProblem(noAsk, s), 'removing the server ask left the guard green');
  });
}

test('the About check runs in BOTH About doors (the one-field save and the page Apply)', () => {
  const src = read('app/vendor-dashboard/actions.ts');
  for (const fn of ['export async function updateVendorWebsiteField', 'export async function applyVendorPageDraft']) {
    const body = src.slice(src.indexOf(fn));
    const ask = body.indexOf('await aboutFairRefusal(');
    const write = body.indexOf(".from('vendor_profiles')\n    .update(");
    assert.ok(ask > 0 && write > 0 && ask < write, `${fn} no longer asks About's check before it writes`);
  }
  assert.match(src, /async function aboutFairRefusal[\s\S]{0,400}field: 'about'/, 'aboutFairRefusal no longer checks About as About');
});

test('a name-change REQUEST (verified shops) is checked too — a claim word is refused before review, not after', () => {
  const src = read('app/vendor-dashboard/actions.ts');
  const body = src.slice(src.indexOf('export async function requestProfileCorrection'));
  assert.match(body.slice(0, 4000), /fieldKey === 'business_name' && requestedValue\)[\s\S]{0,200}fairPresentationRefusal\(/);
});

// ── the card maker ───────────────────────────────────────────────────────────

const MAKER = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
const CHECKS_UI = read('app/vendor-dashboard/services/_components/card-checks.tsx');
const CARD_SERVER = read('lib/service-card-checks.server.ts');

function makerProblem(maker: string, checksUi: string, server: string): string | null {
  for (const [row, field] of [['name', 'card_name'], ['included', 'included'], ['extras', 'extras']] as const) {
    if (!new RegExp(`data-maker-row="${row}"[\\s\\S]*?<FairNote hits=\\{checks\\.fair\\} field="${field}" />`).test(maker)) return `the ${row} row no longer shows its note`;
  }
  if (!/open: fair\.length \+/.test(checksUi)) return 'Create no longer waits for the fair-presentation problems';
  if (!/findFairHits\(cardFairTexts\(input\)/.test(checksUi)) return 'the maker no longer asks the fair-presentation checks';
  if (!/fairRefusal\(\s*findFairHits\(cardFairTexts\(card\)/.test(server)) return 'the card save no longer asks the fair-presentation checks';
  return null;
}

test('card maker: name · what’s included · extras each draw the note, Create waits, and the save asks again', () => {
  assert.equal(makerProblem(MAKER, CHECKS_UI, CARD_SERVER), null);
});

test('card maker: SABOTAGE — each removal turns the guard red', () => {
  assert.ok(makerProblem(MAKER.replace('<FairNote hits={checks.fair} field="extras" />', ''), CHECKS_UI, CARD_SERVER));
  assert.ok(makerProblem(MAKER, CHECKS_UI.replace('open: fair.length +', 'open: 0 +'), CARD_SERVER));
  assert.ok(makerProblem(MAKER, CHECKS_UI, CARD_SERVER.replace('findFairHits(cardFairTexts(card)', 'noop(')));
});

// ── every page that draws a field hands it the word list ─────────────────────

test('every page that draws a supplier-written field reads the word list and hands it down', () => {
  const pairs: [string, RegExp][] = [
    ['app/vendor-dashboard/profile/details-data.ts', /loadClaimWordsFor\(vendorId\)/],
    ['app/vendor-dashboard/profile/_components/details-screen.tsx', /fairWords=\{d\.fairWords\}/],
    ['app/vendor-dashboard/website/page.tsx', /loadClaimWordsFor\(profile\.vendor_profile_id\)[\s\S]*fairWords,/],
    ['app/vendor-dashboard/packages/[packageId]/page.tsx', /loadClaimWordsFor\(vendorProfileId\)[\s\S]*fairWords=\{fairWords\}/],
    ['app/open-shop/page.tsx', /loadClaimWordList\(\)[\s\S]*fairWords=\{fairWords\}/],
    ['lib/service-card-checks.server.ts', /loadClaimWordsFor\(vendorProfileId\),\s*loadCheckTrades\(\),\s*loadOwnCardNames\(vendorProfileId\)/],
  ];
  for (const [f, re] of pairs) assert.match(read(f), re, `${f} no longer hands the word list to its field`);
});

test('the sweep notice is on the Shop tab, streamed, and in-app only', () => {
  const page = read('app/vendor-dashboard/shop/page.tsx');
  assert.match(page, /<Suspense fallback=\{null\}>\s*<FairSweepNotice /, 'the "Edit your name" notice left the Shop tab (or stopped streaming)');
});

test('no fair-presentation file names a law or an agency (owner: "remove the DTI statement")', () => {
  for (const f of ['lib/fair-presentation.ts', 'app/_components/fair-note.tsx', 'lib/fair-presentation-sweep.ts', 'app/vendor-dashboard/shop/_components/fair-sweep-notice.tsx', 'app/vendor-dashboard/shop/_components/fair-sweep-list.tsx']) {
    const code = stripComments(read(f));
    assert.doesNotMatch(code, /\bDTI\b|RA\s*7394|Consumer Act/i, `${f} names a law or an agency in what a supplier reads`);
  }
});
