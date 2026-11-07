/**
 * GUARD — 🔗 THE CLAIM DOOR (controller A6, 7 Nov; owner 2026-11-06 "A SUPPLIER WHO JOINS FROM A COUPLE'S QR / LINK GOES
 * THROUGH THE SAME DOOR, PRE-FILLED"; v21 slides).
 *
 *   1. no couple-made claim link builds `/signup?as=vendor` — the URL builder, the emailed invite and the claim page's
 *      "Claim & sign up" all open `/open-shop?claim=<token>`;
 *   2. the door pre-fills from the couple's record, read through the SHIPPED token check, in v21's slide order;
 *   3. the door has NO Email field — the account's email comes from signing in;
 *   4. only the screens changed: the finish hands the consent to the shipped finalize.
 *
 * Sabotage (7 Nov, each reverted, each red): `buildClaimUrl` back to `/vendor/claim/` + the auto-share branch back to
 * `/signup?as=vendor` (1) · the door's shop name seeded '' instead of `record.business` (2) · an Email box added to the
 * account slide (3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  CLAIM_DETAIL_KEYS,
  claimDetailKeysOf,
  claimDoorHref,
  parseClaimDoorAnswers,
  seedBundleName,
  seedClaimCards,
  type ClaimDoorRecord,
} from '@/lib/claim-door';

const src = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const DOOR = src('app/open-shop/_components/claim-door.tsx');
const ACT = src('app/open-shop/claim-actions.ts');
const CLAIM_PAGE = src('app/vendor/claim/[token]/page.tsx');

const REC: ClaimDoorRecord = {
  token: 't0k3n',
  inviterName: 'Maria & Jose',
  hostNoun: 'couple',
  eventWord: 'wedding',
  eventType: 'wedding',
  datePhrase: 'on 12 December 2026',
  business: 'Banawe Florals',
  contactPerson: 'Ana Reyes',
  contactPhone: '+639178888889',
  services: [
    { category: 'photographer', tileId: 'photo_video', label: 'Photographer', price: 85000, inclusions: ['Two photographers'] },
    { category: 'photo_booth', tileId: 'photo_booth', label: 'Photo booth', price: null, inclusions: [] },
  ],
  price: 85000,
  inclusions: ['Full-day coverage', 'Two photographers'],
  plan: [{ label: 'Reservation', due: null, amount: 25500 }],
};

test('1 · the ONE claim address is the door', () => {
  assert.equal(claimDoorHref('ab c'), '/open-shop?claim=ab%20c');
  const invites = src('lib/vendor-invites.ts');
  const builder = invites.slice(invites.indexOf('export function buildClaimUrl('), invites.indexOf('export function buildClaimUrl(') + 300);
  assert.match(builder, /claimDoorHref\(token\)/, 'buildClaimUrl no longer opens the claim door');
  assert.doesNotMatch(builder, /vendor\/claim\//, 'buildClaimUrl points at the old claim page again');
  // The couple's emailed invite uses the same builder.
  const mail = src('lib/vendor-invite-actions.ts');
  assert.match(mail, /const claimUrl = buildClaimUrl\(claimToken\);/);
  assert.doesNotMatch(mail, /`\$\{appUrl\}\/vendor\/claim\//);
});

test('1 · the claim page’s "Claim & sign up" opens the door — /signup?as=vendor is left ONLY on Setnayan’s own (admin) invite', () => {
  const auto = CLAIM_PAGE.slice(CLAIM_PAGE.indexOf("if (invite.source === 'auto_share_link') {"), CLAIM_PAGE.indexOf("if (invite.source === 'admin') {"));
  const admin = CLAIM_PAGE.slice(CLAIM_PAGE.indexOf("if (invite.source === 'admin') {"), CLAIM_PAGE.indexOf('if (existingVendor) {'));
  const couple = CLAIM_PAGE.slice(CLAIM_PAGE.lastIndexOf('const signupUrl'), CLAIM_PAGE.indexOf('function TerminalCard('));
  for (const [name, part] of [['auto_share_link', auto], ['couple', couple]] as const) {
    assert.match(part, /const signupUrl = claimDoorHref\(invite\.claim_token\);/, `${name}: "Claim & sign up" no longer opens the door`);
    assert.doesNotMatch(part, /signup\?as=vendor/, `${name}: a couple-made claim link builds /signup?as=vendor again`);
  }
  // Every remaining /signup?as=vendor on the page is inside the admin branch (its own door, its own finalize path).
  const all = CLAIM_PAGE.match(/signup\?as=vendor/g)?.length ?? 0;
  const inAdmin = admin.match(/signup\?as=vendor/g)?.length ?? 0;
  assert.equal(all, inAdmin, '/signup?as=vendor appears outside the admin branch');
});

test('2 · the door reads the record through the SHIPPED token check, and the page hands it over', () => {
  const read = src('lib/claim-door.server.ts');
  assert.match(read, /fetchClaimLandingByToken\(admin, token\)/, 'the door grew its own token check');
  assert.match(read, /data\.invite\.status !== 'pending' \|\| !isCoupleMadeInvite\(data\.invite\.source\)/);
  const page = src('app/open-shop/page.tsx');
  assert.match(page, /const claimDoor = claimToken \? await readClaimDoor\(claimToken\) : null;/);
  assert.match(page, /if \(claimToken && !claimDoor\?\.open\) redirect\(`\/vendor\/claim\/\$\{encodeURIComponent\(claimToken\)\}`\);/);
  assert.match(page, /<ClaimDoor\s+record=\{claimDoor\.record\}/);
});

test('2 · every field the couple recorded pre-fills the door', () => {
  for (const re of [
    /name: record\.business,/,
    /who: record\.contactPerson \?\? '',/,
    /phone: digits\(record\.contactPhone \?\? ''\)/,
    /price: record\.price \? String\(record\.price\) : '',/,
    /inclusions: \[\.\.\.record\.inclusions\],/,
    /plan: record\.plan\.map\(/,
    /cards: seedClaimCards\(record\)\.map\(/,
    /bundleName: seedBundleName\(record\.services\.map\(\(s\) => s\.label\)\),/,
  ]) {
    assert.match(DOOR, re, `the door no longer pre-fills: ${re.source}`);
  }
  assert.match(DOOR, /const services: Picked\[\] = record\.services\.map\(/);
  // The seeds, executed: one card per service; the first carries the confirmed price + lines, the rest are bundled.
  const cards = seedClaimCards(REC);
  assert.deepEqual(cards.map((c) => [c.name, c.price, c.bundled]), [['Photographer', 85000, false], ['Photo booth', null, true]]);
  assert.deepEqual(cards[0]!.inclusions, ['Full-day coverage', 'Two photographers']);
  assert.equal(seedBundleName(['Photographer', 'Photo booth']), 'Photographer & Photo booth');
  assert.deepEqual(claimDetailKeysOf(REC), ['name', 'who', 'phone', 'service', 'price', 'incl', 'plan']);
  assert.deepEqual(claimDetailKeysOf({ ...REC, contactPerson: null, plan: [] }), ['name', 'phone', 'service', 'price', 'incl']);
});

test('2 · v21’s order: invited by → tick what is wrong → one detail per slide → one slide per card → bundle → plan → account', () => {
  assert.match(
    DOOR,
    /const order: Screen\[\] = \[\s*'invite',\s*'details',\s*\.\.\.editKeys\.map\(\(k\) => `ed:\$\{k\}` as Screen\),\s*\.\.\.d\.cards\.map\(\(_, i\) => `card:\$\{i\}` as Screen\),\s*'bundle',\s*'plan',\s*'account',\s*\];/,
  );
  // Slide 1 wears the door's frame: one terracotta Confirm, the grey pills for Sign in & claim and I'm not this supplier.
  assert.match(DOOR, /primary = \{ label: 'Confirm — continue', onClick: next \};/);
  assert.match(DOOR, /<ActionButton tone="neutral" icon=\{LogIn\} label="Sign in & claim" href=\{signInHref\} \/>/);
  assert.match(DOOR, /label="I’m not this supplier"/);
  // Specialties are optional — never in a Continue gate.
  assert.match(DOOR, /Specialties[\s\S]{0,400}optional/);
});

test('3 · NO EMAIL FIELD — the account’s email comes from signing in', () => {
  assert.doesNotMatch(DOOR, /type="email"/, 'the claim door asks for an email');
  assert.doesNotMatch(DOOR, /name="(contact_)?email"/, 'the claim door posts an email field');
  assert.doesNotMatch(DOOR, /field\(\s*'Email'/, 'the claim door draws an Email box');
  assert.ok(!(CLAIM_DETAIL_KEYS as readonly string[]).includes('email'), 'email became a detail to tick');
  assert.equal('email' in (parseClaimDoorAnswers(JSON.stringify({ email: 'x@y.z', name: 'A' })) ?? {}), false);
  // The shop's contact email is the signed-in account's — from nowhere else.
  assert.match(ACT, /contact_email: user\.email \?\? null,/);
  assert.equal(ACT.match(/contact_email/g)?.length, 1, 'the finish writes contact_email from somewhere besides the account');
});

test('4 · only the screens changed — the consent is the shipped finalize', () => {
  assert.doesNotMatch(ACT, /applyClaimAutoLink\(|seatClaimedCoupleAsCustomer\(|claim_ask_for_access/, 'the door grew its own consent');
  assert.match(ACT, /redirect\(`\/vendor\/claim\/\$\{encodeURIComponent\(token\)\}\/finalize`\);\s*\}\s*$/, 'the finish no longer ends on the shipped finalize');
  assert.match(ACT, /await createVendorService\(fd\)/, 'the cards are no longer made by the shipped card maker');
  assert.match(ACT, /await savePackage\(\{/, 'the bundle is no longer made by the shipped package maker');
});
