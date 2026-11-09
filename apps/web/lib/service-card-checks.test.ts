/**
 * THE CARD CHECKS — FIX BEFORE CREATE (owner 2026-10-26). The rules, pure:
 *   1. claim words — whole word, any case, in the name / what's-included / extras; a shop's allowance skips a word;
 *   2. the card matches its service — the name says another trade (taxonomy label or reviewed alias) and nothing on
 *      the card says its own;
 *   3. one photo = one service card — another shop (never named) · another of this shop's cards (named) · unchecked.
 * And: no price check of any kind; the verdict the supplier reads never carries the other shop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardPhotoLine,
  claimTextsOf,
  decidePhotoVerdict,
  findClaimWords,
  findServiceMismatch,
  openCardProblems,
  photoBlocks,
  readCardCheckInput,
  type CheckTrade,
  type ClaimWord,
  type NamedPhotoHash,
} from './service-card-checks';

const SEED: ClaimWord[] = [
  { phrase: 'guaranteed', why: 'A promise.' },
  { phrase: '#1', why: 'A ranking.' },
  { phrase: 'best in', why: 'A ranking.' },
  { phrase: 'lowest price', why: 'A comparison.' },
  { phrase: 'official', why: 'An appointment.' },
  { phrase: '100%', why: 'A promise.' },
];

const words = (title: string, lines: string[] = [], extras: string[] = [], allowed: string[] = []) =>
  findClaimWords(claimTextsOf({ title, inclusionLabels: lines, addonLabels: extras }), SEED, allowed).map(
    (h) => `${h.field}:${h.index}:${h.phrase}`,
  );

// ── 1 · claim words ─────────────────────────────────────────────────────────

test('each of the six seed words is found, any case, as a whole word', () => {
  assert.deepEqual(words('GUARANTEED fresh lechon'), ['name:0:guaranteed']);
  assert.deepEqual(words('The #1 grazing table'), ['name:0:#1']);
  assert.deepEqual(words('Best in Cavite'), ['name:0:best in']);
  assert.deepEqual(words('Best-in-town lights'), ['name:0:best in']);
  assert.deepEqual(words('Lowest price lights'), ['name:0:lowest price']);
  assert.deepEqual(words('Official caterer'), ['name:0:official']);
  assert.deepEqual(words('100% satisfaction'), ['name:0:100%']);
});

test('a word inside another word is not a claim', () => {
  assert.deepEqual(words('Unofficially the cutest booth'), []);
  assert.deepEqual(words('Table #10 set-up'), []);
  assert.deepEqual(words('1100% more'), []);
  assert.deepEqual(words('The bestinclass package'), []);
});

test('the lines and the extras are read too, each on its own row', () => {
  assert.deepEqual(words('Lechon package', ['Whole lechon', 'Guaranteed crispy skin'], ['Official sauce']), [
    'included:1:guaranteed',
    'extras:0:official',
  ]);
});

test('an admin allowance skips that word for that shop only', () => {
  assert.deepEqual(words('Official caterer of the venue', [], [], ['official']), []);
  assert.deepEqual(words('Official caterer, guaranteed', [], [], ['official']), ['name:0:guaranteed']);
});

// ── 2 · the card matches its service ────────────────────────────────────────

const TRADES: CheckTrade[] = [
  { key: 'catering', label: 'Catering', branch: 'Food', aliases: ['caterer', 'buffet'] },
  { key: 'lechon', label: 'Lechon', branch: 'Food', aliases: ['litson'] },
  { key: 'photo_booth', label: 'Photo Booth', branch: 'Booths', aliases: ['photobooth', 'selfie booth'] },
  { key: 'photography', label: 'Wedding Photography', branch: 'Photo & Video', aliases: ['photographer'] },
  { key: 'lights_sound', label: 'Lights & Sound', branch: 'Production', aliases: ['sound system'] },
];

const mismatch = (category: string, categoryLabel: string, title: string, lines: string[] = []) =>
  findServiceMismatch({ title, lines, category, categoryLabel, trades: TRADES });

test('a catering card named for a photo booth is filed under the wrong service — the booth is suggested', () => {
  const m = mismatch('catering', 'Catering', 'Selfie booth for 3 hours');
  assert.equal(m?.says.key, 'photo_booth');
  assert.equal(m?.word, 'selfie booth');
});

test('a name that says the card’s own trade (label or reviewed alias) is never a mismatch', () => {
  assert.equal(mismatch('catering', 'Catering', 'Buffet with photo booth'), null);
  assert.equal(mismatch('photo_booth', 'Photo Booth', 'Photobooth unlimited prints'), null);
});

test('a related trade (same branch, or a shared real word) is never a mismatch', () => {
  assert.equal(mismatch('catering', 'Catering', 'Litson for 50'), null, 'Lechon is in the Food branch');
  assert.equal(mismatch('photography', 'Photo & Video', 'Photo booth corner'), null, 'shares “photo”');
});

test('what’s-included naming the card’s own trade clears a name that says another', () => {
  assert.equal(mismatch('catering', 'Catering', 'Sound system and dinner', ['Buffet for 100']), null);
  assert.equal(mismatch('catering', 'Catering', 'Sound system and dinner')?.says.key, 'lights_sound');
});

test('a name that says no trade at all is not a mismatch', () => {
  assert.equal(mismatch('catering', 'Catering', 'The Classic'), null);
  assert.equal(mismatch('catering', 'Catering', ''), null);
});

// ── 3 · one photo = one service card ────────────────────────────────────────

const ME = 'shop-me';
const near = (a: bigint, b: bigint) => (a === b ? 0 : Number(a > b ? a - b : b - a));
const hash = (over: Partial<NamedPhotoHash>): NamedPhotoHash => ({
  vendorProfileId: 'shop-other',
  ref: 'r2://media/x.webp',
  surface: 'service_primary',
  phash: 100n,
  isDemo: false,
  vendorServiceId: 'card-other',
  ...over,
});
const decide = (over: Partial<Parameters<typeof decidePhotoVerdict>[0]>) =>
  decidePhotoVerdict({
    ref: 'r2://media/new.webp',
    where: 'cover',
    phash: 100n,
    vendorProfileId: ME,
    serviceId: null,
    threshold: 10,
    named: [],
    ownCards: new Map([['card-a', 'Grazing table']]),
    sameRefCardId: null,
    distance: near,
    ...over,
  });

test('a photo on another shop’s card blocks — and the verdict never names the shop', () => {
  const d = decide({ named: [hash({ phash: 104n })] });
  assert.equal(d.verdict.verdict, 'another_shop');
  assert.ok(photoBlocks(d.verdict));
  assert.deepEqual(Object.keys(d.verdict).sort(), ['ref', 'verdict', 'where']);
  assert.doesNotMatch(cardPhotoLine(d.verdict) ?? '', /shop-other|card-other/);
  assert.equal(d.source?.vendorProfileId, 'shop-other', 'the server keeps the source for the report');
});

test('a demo shop’s photo, or one past the threshold, does not block', () => {
  assert.equal(decide({ named: [hash({ isDemo: true })] }).verdict.verdict, 'ok');
  assert.equal(decide({ named: [hash({ phash: 200n })] }).verdict.verdict, 'ok');
});

test('another of this shop’s cards — the same stored photo or a matching hash — blocks, naming that card', () => {
  const same = decide({ sameRefCardId: 'card-a' });
  assert.equal(same.verdict.verdict, 'this_shop');
  assert.equal(same.verdict.verdict === 'this_shop' ? same.verdict.cardTitle : '', 'Grazing table');
  const byHash = decide({ named: [hash({ vendorProfileId: ME, vendorServiceId: 'card-a' })] });
  assert.equal(byHash.verdict.verdict, 'this_shop');
});

test('the card being edited never counts against itself', () => {
  const d = decide({ serviceId: 'card-a', named: [hash({ vendorProfileId: ME, vendorServiceId: 'card-a' })] });
  assert.equal(d.verdict.verdict, 'ok');
});

test('a photo that could not be read is unchecked — it does not block, and it is not called ok', () => {
  const d = decide({ phash: null, named: [hash({})] });
  assert.equal(d.verdict.verdict, 'unchecked');
  assert.equal(photoBlocks(d.verdict), false);
});

// ── all three, and what is NOT checked ──────────────────────────────────────

test('every open problem keeps Create waiting', () => {
  const claims = findClaimWords(claimTextsOf({ title: 'Official', inclusionLabels: ['100% fresh'], addonLabels: [] }), SEED);
  const m = mismatch('catering', 'Catering', 'Selfie booth');
  const photos = [decide({ named: [hash({})] }).verdict, decide({}).verdict];
  assert.equal(openCardProblems({ claims, mismatch: m, photos }), 4);
  assert.equal(openCardProblems({ claims: [], mismatch: null, photos: [decide({}).verdict] }), 0);
});

test('the maker reads the SHIPPED field names', () => {
  const fd = new FormData();
  fd.set('title', ' Official grazing ');
  fd.append('inclusion_label', 'Cheese');
  fd.append('inclusion_label', ' ');
  fd.append('addon_label', 'Extra hour');
  fd.set('primary_photo_r2_key', 'r2://media/c.webp');
  fd.append('showcase_photo_r2_keys', 'r2://media/s1.webp');
  fd.append('showcase_photo_r2_keys', 'r2://media/s1.webp');
  assert.deepEqual(readCardCheckInput(fd), {
    title: 'Official grazing',
    inclusionLabels: ['Cheese'],
    addonLabels: ['Extra hour'],
    coverRef: 'r2://media/c.webp',
    showcaseRefs: ['r2://media/s1.webp'],
  });
});

test('no price check of any kind (owner: "ok then remove the price integrity issue")', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  for (const f of ['./service-card-checks.ts', './service-card-checks.server.ts', './card-photo-check.server.ts']) {
    const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
    assert.doesNotMatch(src, /starting_price|price_php|priceBand|price_band/i, `${f} reads a price`);
  }
});
