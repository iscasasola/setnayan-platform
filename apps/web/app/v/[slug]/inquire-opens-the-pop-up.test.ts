/**
 * Guard: Inquire on a shop page opens the one pop-up, for every shop — including one with no service — and the
 * shop page no longer sends anybody to "Plan with Setnayan".
 *
 * The reports (owner, 7 Nov 2026):
 *   • "inquire does nothing" — SetnaProd (verified, solo plan, 0 active services): Inquire scrolled to a section that
 *     said the shop "hasn't listed a service you can ask about yet. Check back soon" and offered nothing to press.
 *   • "Plan with Setnayan" on the shop (the header link and the button at the foot of Inquire) went to /signup —
 *     away from the shop the person came to ask.
 *   • the ask itself: "a pop up to first ask what service/s … then connect them to which event … and send inquire".
 *
 * A page CI cannot click, so the wiring is held from source, comments stripped (the prose above each block names the
 * retired things on purpose). The address round trip is held for real.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  inquireClearedHref,
  inquireResumeHref,
  inquireResumeOf,
  inquireSendPicks,
  inquireServiceList,
  NO_SERVICES_LINE,
  PRICE_ON_REQUEST,
  inquireRowNote,
} from '../../../lib/shop-inquire';
import { stripComments } from '../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
// The ONE comment stripper (lib/strip-comments.ts) — a hand-rolled two-replace regex blanks code after a `video/*`.
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

const page = read(join(HERE, 'page.tsx'));
const sheet = read(join(HERE, '_components', 'inquire-sheet.tsx'));
const action = read(join(HERE, 'inquiry-actions.ts'));
const save = read(join(APP, '(shell)', 'explore', 'actions.ts'));

/** Every file that draws a shop page: /v/[slug] and everything under it, and the bare-root /[slug] that renders it. */
function shopPageFiles(): string[] {
  const out: string[] = [join(APP, '[slug]', 'page.tsx')];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
  };
  walk(HERE);
  return out;
}

test('no shop page renders "Plan with Setnayan"', () => {
  const offenders = shopPageFiles().filter((f) => /plan with setnayan/i.test(read(f)));
  assert.deepEqual(offenders, [], `"Plan with Setnayan" is retired on shop pages (owner 2026-11-07): ${offenders.join(', ')}`);
});

test('the shop page mounts the pop-up for every bookable shop — never behind having a service', () => {
  assert.match(page, /\{bookable \? \(\s*<InquireSheet\b/, 'the Inquire pop-up must be mounted on `bookable` alone');
  const at = page.indexOf('<InquireSheet');
  const before = page.slice(Math.max(0, at - 400), at);
  assert.doesNotMatch(
    before,
    /activeServices\.length|composerInitial|inquireServices\.length/,
    'the pop-up is gated on having a service — a shop with none (SetnaProd) would have an Inquire that does nothing',
  );
  assert.match(page, /services=\{inquireServices\}/);
});

test('a shop with no service still has a working Inquire: the pop-up asks a general question', () => {
  assert.match(sheet, /const general = services\.length === 0;/, 'the pop-up must know a shop with no service');
  assert.match(sheet, /\bgeneral,\s*\n/, 'the send must carry `general` so the server accepts an ask with no card');
  assert.match(sheet, /NO_SERVICES_LINE\(shop\.name\)/, 'the one plain line must say the shop has no services listed');
  // …and the server accepts it, through the same send.
  assert.match(action, /const general = input\.general === true && !initialServiceId;/);
  assert.match(action, /if \(!vendorProfileId \|\| \(!initialServiceId && !general && askedKeys\.length === 0\)\)/);
  assert.match(action, /if \(general\) \{[\s\S]{0,400}saveVendorToPicks\(form\)/, 'a general ask still puts the shop on the event');
  // The section's dead end is gone, and it has its own way in.
  assert.doesNotMatch(page, /Check back soon/, 'the dead-end "Check back soon" is back on the shop page');
  assert.match(page, /<a href="#get-in-touch"[^>]*data-inquire-general-ask=""/);
});

test('every Inquire on the page opens the pop-up, which sends through the ONE inquiry action', () => {
  assert.match(sheet, /closest\?\.\('a\[href="#get-in-touch"\]'\)/, 'the pop-up no longer catches the page’s Inquire links');
  const imports = sheet.match(/from '[^']*inquiry-actions'/g) ?? [];
  assert.equal(imports.length, 1);
  assert.match(sheet, /import \{ startServiceInquiry, type StartServiceInquiryResult \} from '@\/app\/v\/\[slug\]\/inquiry-actions';/);
  assert.match(sheet, /send = startServiceInquiry/);
  assert.doesNotMatch(sheet, /\bfetch\(|from '[^']*\/actions'|from '[^']*-actions'(?<!inquiry-actions')/, 'a second send path');
});

test('signed out: the shipped sign-in sheet opens first — never a link to /signup', () => {
  assert.match(sheet, /if \(!signedIn\) \{[\s\S]{0,400}openSignIn\(\{ onSignedIn: \(\) => open\(/);
  assert.doesNotMatch(sheet, /['"`]\/signup/, 'the pop-up links to /signup');
});

test('the address carries the ask through sign-in and a new event, keeping where the visit came from', () => {
  const resume = inquireResumeHref('https://www.setnayan.com/setnaprod?src=discover#get-in-touch', ['a', 'b']);
  assert.equal(resume, '/setnaprod?src=discover&inquire=1&isvc=a%2Cb');
  assert.deepEqual(inquireResumeOf(resume.slice(resume.indexOf('?'))), { serviceIds: ['a', 'b'] });
  assert.equal(inquireResumeOf('?src=discover'), null);
  assert.equal(inquireClearedHref(`https://x.test${resume}`), '/setnaprod?src=discover');
  assert.equal(inquireResumeHref('/v/setnaprod?event=e1', []), '/v/setnaprod?event=e1&inquire=1');
  assert.match(NO_SERVICES_LINE('SetnaProd'), /^SetnaProd has no services listed yet/);
});

/*
 * "Yes, list all" (owner, 7 Nov 2026): the pop-up lists EVERY service the shop says it provides — not only its active
 * cards. Measured that day: 4 of 5 real shops have `vendor_profiles.services` and 0 active cards (Rondo Musical:
 * band_dj, band_live_music), so their Inquire listed nothing to ask about.
 */
test('every provided service is listed: cards as before, card-less ones by name with "Price on request"', () => {
  const name = (k: string) => `name-of-${k}`;
  // Rondo Musical: services, no card.
  const rondo = inquireServiceList([], ['band_dj', 'band_live_music'], name);
  assert.deepEqual(
    rondo.map((s) => [s.label, s.price, s.category, s.provided]),
    [
      ['name-of-band_dj', '', 'band_dj', true],
      ['name-of-band_live_music', '', 'band_live_music', true],
    ],
  );
  assert.ok(rondo.every((s) => s.serviceId.startsWith('k:')), 'a card-less service must never pose as a vendor_service_id');
  // Mixed: the card wins over the same key (one row), a card outside `services` still shows, cards stay first.
  const mixed = inquireServiceList(
    [
      { serviceId: 'card-bar', label: 'Mobile bar', price: '', category: 'mobile_bar' },
      { serviceId: 'card-x', label: 'Other card', price: '', category: 'not_in_services' },
    ],
    ['pabati', 'mobile_bar', 'day_of_coordinator', 'pabati'],
    name,
  );
  assert.deepEqual(mixed.map((s) => s.serviceId), ['card-bar', 'card-x', 'k:pabati', 'k:day_of_coordinator']);
  assert.equal(PRICE_ON_REQUEST, 'Price on request');
  // …and the pop-up prints it on the card-less rows (through the one row-note decision, Build 5 F4).
  assert.match(sheet, /note=\{inquireRowNote\(s\)\}/);
  assert.equal(inquireRowNote(rondo[0]!), PRICE_ON_REQUEST);
});

test('the names come from the ONE taxonomy resolver — never a label map on the shop page', () => {
  assert.match(page, /import \{ cardKindLabeller \} from '@\/lib\/card-kind-labeller';/);
  assert.match(page, /await cardKindLabeller\(\)/);
  assert.match(page, /inquireServiceList\(\s*activeServices\.map\(/, 'the list must be built by `inquireServiceList`');
  assert.match(page, /inquireProvidedKeys = bookable \? \(vendor\.services \?\? \[\]\) : \[\]/, 'the source is `vendor_profiles.services`');
  // No hand-kept key → name table in the pop-up or on the page.
  for (const [file, src] of [['inquire-sheet.tsx', sheet], ['page.tsx', page]] as const) {
    assert.doesNotMatch(src, /\bband_live_music\b|\bday_of_coordinator\b|\bpabati\s*:/, `${file} hard-codes a taxonomy name`);
  }
});

test('a card-less pick still files the shop on the event Find under THAT service, then sends', () => {
  // The first pick anchors the filing: a card → that card; a provided service → its key.
  const card = { serviceId: 'c1', label: 'C', price: '', category: 'mobile_bar' };
  const pabati = { serviceId: 'k:pabati', label: 'P', price: '', category: 'pabati', provided: true };
  const doc = { serviceId: 'k:day_of_coordinator', label: 'D', price: '', category: 'day_of_coordinator', provided: true };
  assert.deepEqual(inquireSendPicks([pabati, card, doc]), {
    initialServiceId: '',
    initialCategoryKey: 'pabati',
    alsoServiceIds: ['c1'],
    serviceKeys: ['pabati', 'day_of_coordinator'],
  });
  assert.deepEqual(inquireSendPicks([card, pabati]), {
    initialServiceId: 'c1',
    initialCategoryKey: 'mobile_bar',
    alsoServiceIds: [],
    serviceKeys: ['pabati'],
  });
  assert.match(sheet, /serviceKeys: picks\.serviceKeys,/, 'the pop-up must hand the card-less picks to the send');
  // The server holds each key to what the shop provides, and files the shop under the first one.
  assert.match(action, /serviceKeys\?: string\[\];/);
  assert.match(action, /\.from\('vendor_profiles'\)\s*\.select\('services'\)/);
  assert.match(action, /providedKeys = askedKeys\.filter\(\(k\) => provides\.has\(k\)/);
  assert.match(action, /if \(keyed\) \{[\s\S]{0,500}form\.set\('service_key', anchorKey\);[\s\S]{0,80}saveVendorToPicks\(form\)/);
  // …and the shipped shop-level save honours it, only for the shop's own services.
  assert.match(save, /const serviceKey = String\(formData\.get\('service_key'\) \?\? ''\)\.trim\(\);/);
  assert.match(save, /\(vendor\.services \?\? \[\]\) as string\[\]\)\.includes\(serviceKey\)/);
  assert.match(save, /const category = tileCategory \?\? keyCategory \?\? coerceCategory\(/);
});

test('the general question is only for a shop with no card AND no provided service', () => {
  assert.equal(inquireServiceList([], [], (k) => k).length, 0);
  assert.equal(inquireServiceList([], null, (k) => k).length, 0);
  assert.match(sheet, /const general = services\.length === 0;/);
  assert.match(page, /inquireServices\.length > 0 \? \(\s*<span data-inquire-provided="">/, 'a shop with provided services must not say it has none');
});

test('the message is the house field — TypedRow, long + boxed — never a hand-drawn box', () => {
  assert.doesNotMatch(sheet, /<textarea\b/, 'a hand-drawn <textarea> is back in the pop-up');
  assert.match(sheet, /<TypedRow\s+name=\{general \? 'Your question' : 'Anything to add\? \(optional\)'\}[\s\S]{0,120}\blong\s+boxed\b/);
  assert.match(sheet, /onType=\{\(t\) => setMessage\(t\)\}/, 'Send must carry what is typed before tap-out');
});
