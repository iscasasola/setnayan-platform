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

test('2 · 🚪 19 Nov order: Accept → Create account (SECOND) → Check your shop (a sheet per fact) → the first card → You’re all set', () => {
  // SUPERSEDES v21's slide order (DECISION_LOG 2026-11-19 "SUPPLIER CLAIM ONBOARDING (couple QR) APPROVED"): the old
  // slides are the list's sheets — every one is still drawn, from the same branch, over "Check your shop".
  assert.match(DOOR, /const order: Screen\[\] = \['invite', 'account', 'details', \.\.\.\(d\.cards\.length \? \(\['card:0'\] as Screen\[\]\) : \[\]\), 'plan'\];/);
  for (const sheet of ["'ed:name'", "'ed:who'", "'ed:service'", "'ed:phone'", "'package'", "'pay'"]) {
    assert.ok(DOOR.includes(`sheet: ${sheet}`), `"Check your shop" lost its ${sheet} sheet`);
  }
  assert.match(DOOR, /const sheetView = sheet \? slide\(sheet\) : null;/);
  // The package sheet holds what the price / inclusions / payment plan slides and the bundle slide asked.
  assert.match(DOOR, /\(\['price', 'incl', 'plan'\] as const\)\.filter\(\(k\) => detailKeys\.includes\(k\)\)\.map\(\(k\) => slide\(`ed:\$\{k\}`\)\.body\)/);
  // Slide 1 wears the door's frame: the main verb is "Accept" (owner 19 Nov; it was "Claim it"),
  assert.match(DOOR, /primary = \{\s*label: ACCEPT_LABEL,/);
  // P1 (19 Nov): the grey pills became quiet links — I have an account · Not my business.
  assert.match(DOOR, /<ActionButton tone="neutral" quiet icon=\{LogIn\} label="I have an account" href=\{signInHref\} \/>/);
  assert.match(DOOR, /label=\{NOT_MY_BUSINESS\}/);
  // Specialties are optional — never in a Continue gate.
  assert.match(DOOR, /Specialties[\s\S]{0,400}optional/);
});

// The account slide's branch — the ONE place an email box may be (owner 7 Nov: "Yes" to Continue with Email).
const ACCOUNT = DOOR.slice(DOOR.indexOf('[title] = ONBOARDING_HEADS.account;'), DOOR.indexOf('signedInAs || (emailWay && !taken && !sentTo)', DOOR.indexOf('[title] = ONBOARDING_HEADS.account;')));
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

test('3 · the account slide (P2, drawing v4 19 Nov): Google · Apple, then "or", then the email boxes — all at once', () => {
  const ways = ACCOUNT.slice(ACCOUNT.indexOf('data-claim-door-ways=""'));
  const email = ACCOUNT.slice(ACCOUNT.indexOf('} else if (emailWay) {'), ACCOUNT.indexOf('data-claim-door-ways=""'));
  assert.ok(ways.length > 100 && email.length > 500, 'the two halves of the account slide could not be found');
  // 🚪 Owner 19 Nov (drawing v4 P2, newer than v19's 7 Nov "Email chosen → the ways go"): the email boxes are open from
  // the start, and Google · Apple sit ABOVE them with an "or" — outside the finish form, because the OAuth row is a
  // form of its own and forms never nest. "Use another way" over the boxes is gone.
  assert.match(DOOR, /const \[emailWay, setEmailWay\] = useState\(true\);/, 'the email boxes do not open from the start');
  const above = DOOR.slice(DOOR.indexOf('key="ways-above"'), DOOR.indexOf('<form action={finishClaimDoor}'));
  assert.ok(above.length > 200 && above.length < 2500, 'the ways above the boxes could not be found');
  assert.match(above, /<OAuthButtonRow next=\{claimDoorHref\(record\.token\) \+ '&step=account'\}/);
  assert.match(above, /data-claim-door-or=""[\s\S]{0,200}\bor\b/);
  assert.doesNotMatch(email, /OAuthButtonRow|DesktopOAuthButtons|NativeOAuthButtons/, 'Google / Apple are drawn inside the finish form');
  assert.doesNotMatch(email, /label="Use another way"/, '"Use another way" is back over the boxes');
  // The no-Google fallback (and a taken address's "Use another way") still has Email in the ways' own button shape.
  assert.match(ways, /<OAuthButtonRow next=\{returnTo\}/);
  assert.match(ways, /className=\{OAUTH_BUTTON_CLASS\}[\s\S]{0,300}setEmailWay\(true\)[\s\S]{0,400}\{OAUTH_VERB\} Email/);
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
  assert.match(form, /\{emailMounted && last \? <TurnstileField action="signup" \/> : null\}/);
  assert.match(form, /\{emailMounted \? \([\s\S]{0,160}\{emailBody\}/, 'the email boxes are drawn outside the form that posts them');
  assert.match(DOOR, /const emailMounted = !signedInAs && !sentTo && emailWay && !taken;/);
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
  // 🚪 19 Nov: Edit on the first card rides through finalize as `?edit=` — the consent still comes first.
  // (Ship review 21 Nov: an Edit whose card cannot be found rides as `?edit=unread`, said on Today — test 4 below.)
  assert.match(ACT, /redirect\(`\/vendor\/claim\/\$\{encodeURIComponent\(token\)\}\/finalize\$\{editParam \? `\?edit=\$\{editParam\}` : ''\}`\);\s*\}/, 'the finish no longer ends on the shipped finalize');
  assert.match(ACT, /await createVendorService\(fd\)/, 'the cards are no longer made by the shipped card maker');
  assert.match(ACT, /await savePackage\(\{/, 'the bundle is no longer made by the shipped package maker');
});

const BUNDLE_SLIDE = DOOR.slice(DOOR.indexOf("} else if (view === 'bundle') {"), DOOR.indexOf("} else if (view === 'package') {"));
const CARD_SLIDE = DOOR.slice(DOOR.indexOf("} else if (view.startsWith('card:')) {"), DOOR.indexOf("} else if (view === 'bundle') {"));

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

test('4 · P4 (drawing v4): the couple’s first card is DRAFTED — the card, then "Built from what <couple> recorded" — by the ONE piece Door B’s PB4 uses', () => {
  const PIECE = src('app/open-shop/_components/first-card-draft.tsx');
  const WIZARD = src('app/open-shop/_components/open-shop-wizard.tsx');
  // One piece, two doors: neither door draws the card face by hand any more.
  assert.match(PIECE, /export function FirstCardDraft\(/);
  for (const [name, code] of [['claim door', DOOR], ['wizard', WIZARD]] as const) {
    assert.equal(code.match(/<FirstCardDraft\b/g)?.length, 1, `the ${name} does not draw its first card with FirstCardDraft`);
    assert.doesNotMatch(code, /data-(?:onboarding|claim-door)-card-face=""/, `the ${name} draws a card face by hand`);
  }
  // The claim door's draft: only the couple's own first card, its lines read-only on the face, and where each part came from.
  assert.match(DOOR, /const drafted = i === 0 && !team && !added && !inBundle;/);
  assert.match(DOOR, /sourceHead=\{`Built from what \$\{record\.inviterName\} recorded`\}/);
  for (const why of ['they picked it', 'they booked you for', 'they logged it', 'add yours']) assert.ok(DOOR.includes(`'${why}'`), `the "${why}" source is gone`);
  // No price is guessed: an unlogged price reads "Not logged" and the box asks for it; Approve still needs a price.
  assert.match(DOOR, /cardPriceNum \? peso\(c\.price\) : 'Not logged'/);
  assert.match(DOOR, /drafted \? 'From \(PHP\)' : 'Price'/);
  assert.match(DOOR, /Type a price to approve this card — or Edit it, or Skip\./);
  // The drafted body still carries the price box and the optional "Which one?" / specialties — nothing posted is dropped.
  const drafted = DOOR.slice(DOOR.indexOf('const draftedBody = drafted ? ('), DOOR.indexOf(') : null;', DOOR.indexOf('const draftedBody = drafted ? (')));
  assert.ok(drafted.length > 300, 'the drafted body could not be found');
  assert.match(drafted, /\{priceBox\}\s*\{extras\}/);
  assert.match(DOOR, /if \(draftedBody\) body = draftedBody;/);
});

test('1 · P1 (controller 21 Nov): the "Couple invite" label sits over every Door A title, and the date reads as the drawing does — "Sat, Dec 19, 2026"', async () => {
  // The label: ONE header every screen draws, the host noun capitalised ("couple" → "Couple invite"), right over the h1.
  const head = DOOR.slice(DOOR.indexOf('<div key={d.screen} className="os-in-r grid gap-[3px]">'), DOOR.indexOf('</h1>', DOOR.indexOf('<div key={d.screen} className="os-in-r grid gap-[3px]">')));
  assert.ok(head.length > 100 && head.length < 900, 'the screen header could not be found');
  assert.match(head, /\{team \? 'Your invite' : `\$\{record\.hostNoun\.charAt\(0\)\.toUpperCase\(\) \+ record\.hostNoun\.slice\(1\)\} invite`\}/);
  assert.match(head, /<h1\b[\s\S]*\{title\}\s*$/);
  assert.equal((DOOR.match(/ invite`\}/g) ?? []).length, 1, 'a second, hand-placed invite label');
  // The date: the record's phrase comes from the couple's own date line (`suppliersDateFact`) — weekday, short month,
  // day, year — and P1 drops the preposition: "For their wedding · Sat, Dec 19, 2026."
  const { claimDatePhrase } = await import('../../lib/claim-invite-words');
  assert.deepEqual(claimDatePhrase('2026-12-19', 'day'), { preposition: 'on', label: 'Sat, Dec 19, 2026' });
  assert.deepEqual(claimDatePhrase('2026-12-01', 'month'), { preposition: 'in', label: 'December 2026' });
  assert.match(DOOR, /`For their \$\{record\.eventWord\}\$\{record\.datePhrase \? ` · \$\{record\.datePhrase\.replace\(\/\^\(on\|in\) \/, ''\)\}` : ''\}\.`/);
  const SERVER = src('lib/claim-door.server.ts');
  assert.match(SERVER, /const date = claimDatePhrase\(event\?\.event_date, event\?\.event_date_precision\);/);
  assert.match(SERVER, /datePhrase: date \? `\$\{date\.preposition\} \$\{date\.label\}` : null,/);
  // The lab draws its sample through the same formatter, so the shots show the real format — no hand-typed date.
  const LAB = src('app/dev/open-shop-lab/page.lab.tsx');
  assert.match(LAB, /const LAB_DATE = claimDatePhrase\('2026-12-12', 'day'\);/);
  assert.doesNotMatch(LAB, /datePhrase: '(?:on|in) /, 'the lab hand-types a date again');
});

test('4 · ship review 21 Nov — Edit picked but the card cannot be found is SAID on Today, never a silent welcome', async () => {
  const ACT = src('app/open-shop/claim-actions.ts');
  const FIN = src('app/vendor/claim/[token]/finalize/page.tsx');
  const WEL = src('app/vendor-dashboard/_components/today-welcome.tsx');
  const TOD = src('app/vendor-dashboard/page.tsx');
  const mod = await import('../../lib/supplier-onboarding');
  // The action: Edit with no id found → `?edit=unread` to finalize.
  assert.match(ACT, /const editParam = editId \? encodeURIComponent\(editId\) : answers\.firstCard === 'edit' \? FIRST_CARD_EDIT_UNREAD : null;/);
  assert.match(ACT, /finalize\$\{editParam \? `\?edit=\$\{editParam\}` : ''\}/);
  // Finalize: `?edit=unread` → the claimed welcome carrying `card_edit=unread`.
  assert.equal(mod.welcomeEditUnreadPath(mod.WELCOME_CLAIMED_PATH), '/vendor-dashboard?claimed=1&card_edit=unread');
  assert.match(FIN, /editCard === FIRST_CARD_EDIT_UNREAD\s*\?\s*welcomeEditUnreadPath\(WELCOME_CLAIMED_PATH\)/);
  assert.match(FIN, /if \(v === FIRST_CARD_EDIT_UNREAD\) return FIRST_CARD_EDIT_UNREAD;/);
  // Today: the flag reaches the welcome, which says it and links the cards.
  assert.match(TOD, /editUnread=\{search\.card_edit === FIRST_CARD_EDIT_UNREAD\}/);
  assert.match(WEL, /\{editUnread \? \([\s\S]{0,300}\{FIRST_CARD_EDIT_UNREAD_LINE\}[\s\S]{0,200}href="\/vendor-dashboard\/services"/);
});
