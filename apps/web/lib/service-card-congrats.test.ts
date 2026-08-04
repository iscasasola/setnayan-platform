import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildServiceCardCongrats } from './service-card-congrats';

test('the message carries every element the owner asked for', () => {
  const c = buildServiceCardCongrats({ activeCount: 3, isDraft: false });
  assert.match(c.headline, /Congratulations/);
  assert.match(c.headline, /🙂/);
  const care = c.care.join(' ');
  assert.match(care, /Take care of this card/);
  assert.match(care, /build your foundation around it/);
  assert.match(care, /more cards doesn.t mean better/i);
  assert.match(care, /each card has substance/);
  assert.match(care, /Every event this card creates is documented on the card/);
  assert.match(care, /compiles/); // the value = what the card compiles for them
});

test('active count wording — live card, plural', () => {
  assert.equal(
    buildServiceCardCongrats({ activeCount: 3, isDraft: false }).count,
    'You now have 3 active cards. 🙂',
  );
});

test('active count wording — the first live card is called out', () => {
  assert.equal(
    buildServiceCardCongrats({ activeCount: 1, isDraft: false }).count,
    'This is your first active card. 🙂',
  );
});

test('a draft with no live cards yet says so honestly (never "0 active cards")', () => {
  const c = buildServiceCardCongrats({ activeCount: 0, isDraft: true });
  assert.match(c.count, /draft/);
  assert.match(c.count, /publish it/);
  assert.doesNotMatch(c.count, /\b0 active/);
});

test('a draft alongside live cards states the real count and the join-on-publish', () => {
  const c = buildServiceCardCongrats({ activeCount: 2, isDraft: true });
  assert.match(c.count, /2 active cards/);
  assert.match(c.count, /when you publish it/);
});

test('singular pluralization holds for the draft wording', () => {
  assert.match(
    buildServiceCardCongrats({ activeCount: 1, isDraft: true }).count,
    /1 active card;/,
  );
});

// ── Call-site pins (the .map(-level precision lesson from the serves fix):
// pin the RENDER and the SIGNAL, not just any mention of the helper.
const SERVICES = join(process.cwd(), 'app', 'vendor-dashboard', 'services');

test('commitVendorService signals a CREATE with the new card’s actual state', () => {
  const src = readFileSync(join(SERVICES, 'actions.ts'), 'utf8');
  assert.match(
    src,
    /isCreate \? `&created=\$\{publish \? 'live' : 'draft'\}` : ''/,
    'the create redirect lost its &created= signal — the congratulations banner never fires',
  );
});

test('the services manager renders the congratulations from the tested builder', () => {
  const src = readFileSync(join(SERVICES, '_components', 'services-manager.tsx'), 'utf8');
  assert.match(
    src,
    /buildServiceCardCongrats\(\{\s*activeCount: services\.filter\(\(s\) => s\.is_active\)\.length/,
    'the banner must count active cards from the SAME services array the page renders — a second query could drift',
  );
});
