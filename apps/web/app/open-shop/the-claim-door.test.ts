/**
 * GUARD — 🔗 THE CLAIM DOOR (controller A6, 7 Nov; owner 2026-11-06 "A SUPPLIER WHO JOINS FROM A COUPLE'S QR / LINK GOES
 * THROUGH THE SAME DOOR, PRE-FILLED"; v21 slides).
 *
 *   1. no claim link builds `/signup?as=vendor` — the URL builder, the emailed invite and the claim page's
 *      "Claim & sign up" all open `/open-shop?claim=<token>`, Setnayan's own personal invite included (owner 7 Nov:
 *      "yes"), which keeps its offer: the finish makes the same `claim_ready_the_invited_shop` call finalize makes;
 *   2. the door pre-fills from the couple's record, read through the SHIPPED token check, in v21's slide order;
 *   3. no slide before the account asks for an email; the ACCOUNT slide offers Google · Apple · Email (owner 7 Nov,
 *      "Yes") — Email chosen hides the other two, "Use another way" brings them back — through the shipped /open-shop
 *      account path; the shop's contact email is still the signed-in account's;
 *   4. only the screens changed: the finish hands the consent to the shipped finalize;
 *   5. THE COUPLE'S BUNDLE IS THE COUPLE'S RECORD (owner 7 Nov: "on the sign up the supplier can add more services but
 *      not add them to the customers bundle") — (a) the bundle slide lists only the recorded services; (b) a service
 *      the supplier adds is never `bundled`, on the door or on the server; (c) the saved package is built only from
 *      the couple's cards, split on the server against the record; (d) an added service's card slide shows neither
 *      "Part of the ₱… bundle" nor "Price it on its own" — it is priced on its own.
 *
 * Sabotage (7 Nov, each reverted, each red): `buildClaimUrl` back to `/vendor/claim/` + the auto-share branch back to
 * `/signup?as=vendor` (1) · the door's shop name seeded '' instead of `record.business` (2) · an Email box added to the
 * account slide (3, before Email was ruled in) · Google / Apple drawn beside the chosen Email way (3, 7 Nov) · the
 * admin branch's "Claim & sign up" back to `/signup?as=vendor` (1, 7 Nov) · the bundle list back to `d.cards.map` (5a) ·
 * `syncCards` seeding `bundled` without `s.fromRecord` (5b) · `splitClaimCards` keeping the posted `bundled` on an
 * added card (5b) · the package items back to `answers.cards.map` (5c) · the card slide's `inBundle` back to
 * `c.bundled` (5d).
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
  splitClaimCards,
  type ClaimDoorRecord,
} from '@/lib/claim-door';

const src = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const DOOR = src('app/open-shop/_components/claim-door.tsx');
const ACT = src('app/open-shop/claim-actions.ts');
const CLAIM_PAGE = src('app/vendor/claim/[token]/page.tsx');

const REC: ClaimDoorRecord = {
  token: 't0k3n',
  from: 'couple',
  offer: null,
  inviterName: 'Maria & Jose',
  hostNoun: 'couple',
  eventWord: 'wedding',
  eventType: 'wedding',
  datePhrase: 'on 12 December 2026',
  business: 'Banawe Florals',
  contactPerson: 'Ana Reyes',
  contactPhone: '+639178888889',
  inviteEmail: 'ana@banaweflorals.ph',
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

test('1 · the claim page’s "Claim & sign up" opens the door on EVERY source — /signup?as=vendor is gone from the page', () => {
  const auto = CLAIM_PAGE.slice(CLAIM_PAGE.indexOf("if (invite.source === 'auto_share_link') {"), CLAIM_PAGE.indexOf("if (invite.source === 'admin') {"));
  const admin = CLAIM_PAGE.slice(CLAIM_PAGE.indexOf("if (invite.source === 'admin') {"), CLAIM_PAGE.indexOf('if (existingVendor) {'));
  const couple = CLAIM_PAGE.slice(CLAIM_PAGE.lastIndexOf('const signupUrl'), CLAIM_PAGE.indexOf('function TerminalCard('));
  for (const [name, part] of [['auto_share_link', auto], ['admin', admin], ['couple', couple]] as const) {
    assert.ok(part.length > 40, `${name}: its branch could not be found`);
    assert.match(part, /const signupUrl = claimDoorHref\(invite\.claim_token\);/, `${name}: "Claim & sign up" no longer opens the door`);
  }
  // 🎁 Setnayan's invite: the door for a new account, finalize for an email that already runs a shop.
  assert.match(admin, /claimHref=\{existingVendor \? signInUrl : signupUrl\}/);
  assert.equal(CLAIM_PAGE.match(/signup\?as=vendor/g)?.length ?? 0, 0, 'a claim link builds /signup?as=vendor again');
  // Which links open the door: named, one rule (a new source is a decision, not a fall-through).
  const invites = src('lib/vendor-invites.ts');
  assert.match(invites, /export function opensTheClaimDoor\(source: VendorInviteSource\): boolean \{\s*return isCoupleMadeInvite\(source\) \|\| source === 'admin';/);
  assert.match(ACT, /!opensTheClaimDoor\(landing\.invite\.source\)/);
});

test('2 · the door reads the record through the SHIPPED token check, and the page hands it over', () => {
  const read = src('lib/claim-door.server.ts');
  assert.match(read, /fetchClaimLandingByToken\(admin, token\)/, 'the door grew its own token check');
  assert.match(read, /if \(!data \|\| data\.invite\.status !== 'pending'\) return \{ open: false \};/);
  assert.match(read, /if \(data\.invite\.source === 'admin'\) return \{ open: true, record: await readSetnayanInvite\(admin, token, data\) \};/);
  assert.match(read, /if \(!isCoupleMadeInvite\(data\.invite\.source\) \|\| !data\.parentVendor\) \{/);
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
    /const order: Screen\[\] = \[\s*'invite',\s*'details',\s*\.\.\.editKeys\.map\(\(k\) => `ed:\$\{k\}` as Screen\),\s*\.\.\.d\.cards\.map\(\(_, i\) => `card:\$\{i\}` as Screen\),\s*\.\.\.\(team \? \[\] : \(\['bundle'\] as Screen\[\]\)\),\s*'plan',\s*'account',\s*\];/,
  );
  // Slide 1 wears the door's frame: one terracotta Confirm, the grey pills for Sign in & claim and I'm not this supplier.
  assert.match(DOOR, /primary = \{ label: 'Confirm — continue', onClick: next \};/);
  assert.match(DOOR, /<ActionButton tone="neutral" icon=\{LogIn\} label="Sign in & claim" href=\{signInHref\} \/>/);
  assert.match(DOOR, /label="I’m not this supplier"/);
  // Specialties are optional — never in a Continue gate.
  assert.match(DOOR, /Specialties[\s\S]{0,400}optional/);
});

// The account slide's branch — the ONE place an email box may be (owner 7 Nov: "Yes" to Continue with Email).
const ACCOUNT = DOOR.slice(DOOR.indexOf("title = 'Your account';"), DOOR.indexOf('primary = null;', DOOR.indexOf("title = 'Your account';")));
const BEFORE_ACCOUNT = DOOR.replace(ACCOUNT, '');

test('3 · NO EMAIL FIELD on the slides before the account — the record’s details never include an email', () => {
  assert.ok(ACCOUNT.length > 500, 'the account slide could not be found');
  assert.doesNotMatch(BEFORE_ACCOUNT, /type="email"/, 'a slide before the account asks for an email');
  assert.doesNotMatch(BEFORE_ACCOUNT, /name="(contact_)?email"/, 'a slide before the account posts an email field');
  assert.doesNotMatch(BEFORE_ACCOUNT, /field\(\s*'Email'/, 'a slide before the account draws an Email box');
  assert.ok(!(CLAIM_DETAIL_KEYS as readonly string[]).includes('email'), 'email became a detail to tick');
  assert.equal('email' in (parseClaimDoorAnswers(JSON.stringify({ email: 'x@y.z', name: 'A' })) ?? {}), false);
  // The shop's contact email is the signed-in account's — from nowhere else. The typed box only makes the account.
  assert.match(ACT, /contact_email: user\.email \?\? null,/);
  assert.equal(ACT.match(/contact_email:/g)?.length, 1, 'the finish writes contact_email from somewhere besides the account');
  assert.equal(ACT.match(/formData\.get\('contact_email'\)/g)?.length, 1);
  assert.match(ACT, /const typed = String\(formData\.get\('contact_email'\) \?\? ''\)[^\n]*\n\s*const decision = decideOpenShopAccount\(/);
});

test('3 · the account slide: Google · Apple · Email — Email chosen hides the others, "Use another way" brings them back', () => {
  const ways = ACCOUNT.slice(ACCOUNT.indexOf('data-claim-door-ways=""'));
  const email = ACCOUNT.slice(ACCOUNT.indexOf('} else if (emailWay) {'), ACCOUNT.indexOf('data-claim-door-ways=""'));
  assert.ok(ways.length > 100 && email.length > 500, 'the two halves of the account slide could not be found');
  // Not chosen: the shipped Google / Apple row, then Email in the same button shape.
  assert.match(ways, /<OAuthButtonRow next=\{returnTo\}/);
  assert.match(ways, /className=\{OAUTH_BUTTON_CLASS\}[\s\S]{0,300}setEmailWay\(true\)[\s\S]{0,400}\{OAUTH_VERB\} Email/);
  // Chosen: no Google / Apple at all, one grey "Use another way".
  assert.doesNotMatch(email, /OAuthButtonRow|DesktopOAuthButtons|NativeOAuthButtons/, 'Email chosen still shows Google / Apple');
  assert.match(email, /<ActionButton tone="neutral" icon=\{X\} label="Use another way" onClick=\{\(\) => setEmailWay\(false\)\}/);
  // The shipped boxes: one email, the shipped password field (quiet: one rule line), the Terms tick.
  assert.equal(email.match(/type="email"/g)?.length, 1);
  assert.equal(email.match(/name="contact_email"/g)?.length, 1);
  assert.match(email, /<PasswordField[\s\S]{0,80}mode="new"\s+quiet\s+name="password"/);
  assert.match(email, /minLength=\{OPEN_SHOP_PASSWORD_MIN\}/);
  assert.match(email, /name=\{TERMS_FIELD\} required/);
  // Pre-filled from the invite; a taken address becomes the shipped in-place sign-in, returning to this slide.
  assert.match(DOOR, /email: record\.inviteEmail \?\? '',/);
  assert.match(ACCOUNT, /<TakenSignIn key=\{d\.email\} email=\{d\.email\} next=\{returnTo\}/);
  // The draft (kept in this browser) never holds the password.
  const draft = DOOR.slice(DOOR.indexOf('type Draft = {'), DOOR.indexOf('};', DOOR.indexOf('type Draft = {')));
  assert.ok(draft.length > 50, 'the Draft type could not be found');
  assert.doesNotMatch(draft, /password/i, 'the kept draft holds the password');
});

test('3 · the email way IS the shipped /open-shop path, after the invite is known to be usable', () => {
  // The boxes post with the finish form, which carries the bot check (lib/captcha-is-wired.test.ts pairs them).
  const form = DOOR.slice(DOOR.indexOf('<form action={finishClaimDoor}'), DOOR.indexOf('</form>', DOOR.indexOf('<form action={finishClaimDoor}')));
  assert.match(form, /\{emailForm \? <TurnstileField action="signup" \/> : null\}/);
  assert.match(form, /\{emailForm \? \([\s\S]{0,120}\{body\}/, 'the email boxes are drawn outside the form that posts them');
  assert.match(DOOR, /const emailForm = d\.screen === 'account' && !signedInAs && !sentTo && emailWay && !taken;/);
  // Server: the shipped decision + account maker, never a second signUp.
  assert.match(ACT, /decideOpenShopAccount\(\{/);
  assert.match(ACT, /createVendorAccountForShop\(\{/);
  assert.match(ACT, /captchaToken: captchaTokenFromForm\(formData\),/);
  assert.match(ACT, /confirmNext: accountSlide,/);
  assert.doesNotMatch(ACT, /auth\.signUp\(/, 'the door grew its own signUp');
  // A dead / claimed link never mints an account: the landing check runs first.
  assert.ok(ACT.indexOf('fetchClaimLandingByToken(admin, token)') < ACT.indexOf('createVendorAccountForShop({'));
});

test('1 · 🎁 Setnayan’s invite: pre-filled from the staged shop, the offer kept by the SHIPPED claim call', () => {
  const read = src('lib/claim-door.server.ts');
  const team = read.slice(read.indexOf('async function readSetnayanInvite('));
  assert.ok(team.length > 300, 'readSetnayanInvite could not be found');
  // The staged shop (no owner yet) is the pre-fill; the invite's snapshot when there is none.
  assert.match(team, /\.eq\('vendor_profile_id', inv\.claimed_vendor_profile_id\)\s*\.is\('user_id', null\)/);
  assert.match(team, /business: \(staged\?\.business_name \|\| inv\.business_name \|\| ''\)\.trim\(\),/);
  assert.match(team, /inviteEmail: \(inv\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\) \|\| null,/);
  // The offer: the claim page's own read and rows.
  assert.match(team, /const stored = await readInviteOffer\(admin, inv\.invite_id\);/);
  assert.match(team, /offer: stored \? doorOffer\(offerFromInvite\(stored\)\) : null,/);
  assert.match(team, /from: 'setnayan',/);
  // The finish: the same call finalize makes for an admin invite — it applies the offer and spends the link once.
  assert.match(ACT, /admin\.rpc\(fromSetnayan \? 'claim_ready_the_invited_shop' : 'claim_ready_the_shop', \{/);
  assert.match(src('app/vendor/claim/[token]/finalize/page.tsx'), /admin\.rpc\('claim_ready_the_invited_shop', \{/);
  assert.match(ACT, /if \(fromSetnayan\) redirect\('\/vendor-dashboard\/profile'\);/);
  // The door shows the offer on slide 1 and skips the bundle (nothing was booked).
  assert.match(DOOR, /const offer = team \? record\.offer : null;/);
  assert.match(DOOR, /data-claim-door-offer=""/);
  // No confirmed price → each card is priced on its own, never "part of a ₱0 bundle".
  const seeded = seedClaimCards({ services: [REC.services[0]!, REC.services[1]!], price: null, inclusions: [] });
  assert.deepEqual(seeded.map((c) => c.bundled), [false, false]);
});

test('4 · only the screens changed — the consent is the shipped finalize', () => {
  assert.doesNotMatch(ACT, /applyClaimAutoLink\(|seatClaimedCoupleAsCustomer\(|claim_ask_for_access/, 'the door grew its own consent');
  assert.match(ACT, /redirect\(`\/vendor\/claim\/\$\{encodeURIComponent\(token\)\}\/finalize`\);\s*\}\s*$/, 'the finish no longer ends on the shipped finalize');
  assert.match(ACT, /await createVendorService\(fd\)/, 'the cards are no longer made by the shipped card maker');
  assert.match(ACT, /await savePackage\(\{/, 'the bundle is no longer made by the shipped package maker');
});

const BUNDLE_SLIDE = DOOR.slice(DOOR.indexOf("} else if (d.screen === 'bundle') {"), DOOR.indexOf("} else if (d.screen === 'plan') {"));
const CARD_SLIDE = DOOR.slice(DOOR.indexOf("} else if (d.screen.startsWith('card:')) {"), DOOR.indexOf("} else if (d.screen === 'bundle') {"));

test('5a · the bundle slide lists ONLY the services the couple recorded — an added one is named as the supplier’s own', () => {
  assert.ok(BUNDLE_SLIDE.length > 200, 'the bundle slide could not be found');
  assert.match(BUNDLE_SLIDE, /const theirCards = d\.cards\.filter\(\(_, i\) => d\.services\[i\]\?\.fromRecord === true\);/);
  assert.match(BUNDLE_SLIDE, /\{theirCards\.map\(/, 'the bundle list no longer draws only the couple’s cards');
  assert.doesNotMatch(BUNDLE_SLIDE, /\{d\.cards\.map\(/, 'the bundle list draws every card again — an added service would read as part of the couple’s bundle');
});

test('5b · a service the supplier adds is NEVER bundled — on the door, and again on the server', () => {
  const sync = DOOR.slice(DOOR.indexOf('const syncCards ='), DOOR.indexOf('const syncCards =') + 500);
  assert.match(sync, /if \(kept\) return s\.fromRecord \? kept : \{ \.\.\.kept, bundled: false \};/);
  assert.match(sync, /bundled: s\.fromRecord && i > 0 && !!record\.price/, 'a new card is seeded bundled without being the couple’s');
  assert.match(DOOR, /bundled: c\.bundled && d\.services\[i\]\?\.fromRecord === true,\s*fromRecord: d\.services\[i\]\?\.fromRecord === true,/);
  // Executed: the server decides, against the record — never the post.
  const card = (category: string, fromRecord: boolean, bundled: boolean) => ({ name: category, category, leaf: null, price: 100, inclusions: [], bundled, fromRecord });
  const { theirs, added } = splitClaimCards(
    [card('photographer', true, false), card('photo_booth', true, true), card('lights', false, true), card('drone', true, true)],
    new Set(['photographer', 'photo_booth']),
  );
  assert.deepEqual(theirs.map((c) => [c.category, c.bundled]), [['photographer', false], ['photo_booth', true]]);
  assert.deepEqual(added.map((c) => [c.category, c.bundled]), [['lights', false], ['drone', false]], 'an added card kept its posted `bundled`, or a card claiming to be recorded slipped into the couple’s bundle');
});

test('5c · the package the finish saves is built ONLY from the couple’s cards — split on the server against the record', () => {
  assert.match(ACT, /const recordRead = await readClaimDoor\(token\)/, 'the finish no longer reads the record it splits against');
  assert.match(ACT, /const \{ theirs, added \} = splitClaimCards\(answers\.cards, recorded\);/);
  assert.match(ACT, /for \(const card of \[\.\.\.theirs, \.\.\.added\]\) \{/, 'an added service no longer gets its own card through createVendorService');
  assert.match(ACT, /const total = theirs\.find\(/);
  assert.match(ACT, /\.\.\.theirs\.map\(\(c, i\) => \(\{\s*ref: `card-\$\{i\}`/);
  const uses = ACT.match(/answers\.cards/g) ?? [];
  assert.equal(uses.length, 1, `answers.cards is read ${uses.length}× — only splitClaimCards may read it, or an added card can reach the package`);
});

test('5d · an added service’s card slide: no "Part of the ₱… bundle", no "Price it on its own" — priced on its own', () => {
  assert.ok(CARD_SLIDE.length > 400, 'the card slide could not be found');
  assert.match(CARD_SLIDE, /const added = s\?\.fromRecord === false;\s*const inBundle = c\.bundled && !added;/);
  assert.match(CARD_SLIDE, /\{team \|\| added\s*\? null\s*: inBundle\s*\? band\(/, 'the "Part of the … bundle" band is no longer kept off an added service');
  assert.match(CARD_SLIDE, /\{inBundle \? \(\s*<span>\s*<ActionButton[^>]*label="Price it on its own"/, '"Price it on its own" is no longer kept off an added service');
  assert.doesNotMatch(CARD_SLIDE, /c\.bundled \?/, 'the card slide branches on c.bundled again — an added service could read as part of the bundle');
});
