/**
 * evaluateMessage(body, profile) — the CARD profile.
 *
 * Lives in its own file rather than in chat-contact-filter.test.ts on purpose:
 * that suite is the chat contract and is edited by other work, and a new file
 * cannot conflict with a concurrent PR.
 *
 * Locks three things:
 *   1. The DEFAULT ARGUMENT is byte-identical to `'chat'` — every shipped chat
 *      caller (chat-send.ts, chat-send-form.tsx, vendor-voice-profile.ts,
 *      vendor-autoreply/phrasings.ts) passes one argument today, so if this
 *      ever drifts the chat gate silently changes.
 *   2. Each MEASURED card misfire — honest vendor copy the chat rules refuse —
 *      is blocked under 'chat' and allowed under 'card'.
 *   3. Nothing that is actually contact info gets through 'card'. This is the
 *      half that matters: the profile relaxes four specific rules, and the
 *      whole phone-disguise matrix has to survive all four.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMessage } from './chat-contact-filter';

const chat = (s: string) => evaluateMessage(s, 'chat').blocked;
const card = (s: string) => evaluateMessage(s, 'card').blocked;

// -- 1. The default argument IS 'chat' ---------------------------------------

test("evaluateMessage(s) === evaluateMessage(s, 'chat') for dirty and clean input", () => {
  const sample = [
    'call me 09178807163',
    '0917 880 7163',
    '+63 917 880 7163',
    'zero nine one seven eight eight zero seven one six three',
    'juan.delacruz@gmail.com',
    'juan (at) gmail (dot) com',
    'facebook.com/juanphotos',
    'follow @juan_photo',
    'add me on messenger',
    'i am on the blue app',
    'my number is below',
    'Instagram teaser reel',
    'Message me on Setnayan for the full menu',
    'Valid 2026-09-17 - 2026-12-31',
    'the package is 12,999 for 150 pax',
    'Full-day wedding coverage',
    '',
  ];
  for (const s of sample) {
    assert.deepEqual(
      evaluateMessage(s),
      evaluateMessage(s, 'chat'),
      `default arg drifted from 'chat' for ${JSON.stringify(s)}`,
    );
  }
});

// -- 2. Measured misfires: blocked in chat, allowed on a card ----------------
// Every string below was confirmed refused by the shipped detector (run under
// npx tsx) before the profile existed. On a card each one is honest copy.

test("CARD (c): app names on a card are DELIVERABLES, not a place to take the deal", () => {
  for (const s of [
    'Instagram teaser reel',
    'TikTok highlights package',
    'FB live streaming add-on',
    'Insta-ready photo booth',
    // Setnayan's own SKU copy was refused by the chat rules.
    'Patiktok — 250 TikTok recordings',
  ]) {
    assert.equal(chat(s), true, `expected chat to block ${JSON.stringify(s)}`);
    assert.equal(card(s), false, `expected card to allow ${JSON.stringify(s)}`);
  }
});

test("CARD (c): the colour-coded euphemisms are dropped too", () => {
  // Same category rule as app_name — on a card "the pink app" is a colour.
  const s = 'Pink app-style neon signage';
  assert.equal(chat(s), true);
  assert.equal(card(s), false);
});

test('CARD (c): the accepted trade — a bare platform name with no destination', () => {
  // Written down rather than discovered. Skipping app_name means a bare
  // mention passes on a card. That is the price of "Instagram teaser reel",
  // and it is affordable because a bare name is not a way to reach anyone.
  assert.equal(card('Viber only'), false);
  assert.equal(card('We also post on IG'), false);
  // MEASURED, and NOT a CARD (d) bypass despite looking like one: this string
  // has no solicitation verb at all, so the solicit rule never matched it in
  // either profile and the SOLICIT_TO_SETNAYAN scrub cannot reach it. In chat
  // it blocked on `app_name:Viber` alone — so on a card it is this (c) trade,
  // not (d). Closing it would need a NEW rule ("a platform named alongside
  // Setnayan"), which is an owner call, not a profile tweak.
  assert.equal(card('Faster on Viber than on Setnayan'), false);
  assert.equal(chat('Faster on Viber than on Setnayan'), true);
  // The moment it carries a destination, a rule that is STILL live fires.
  assert.equal(card('add me on viber'), true); // solicit
  assert.equal(card('IG: @juanphotos'), true); // HANDLE
  assert.equal(card('IG: facebook.com/ourstudio'), true); // SOCIAL_URL
  assert.equal(card('Viber 0917 880 7163'), true); // phone
});

test('CARD (a): a price line is not a phone number', () => {
  const s = 'Php 9,000 per hour, minimum 4 hours, 150 pax, 20 staff';
  assert.equal(chat(s), true);
  assert.equal(card(s), false);
});

test('CARD (b): a discount validity range is not a phone number', () => {
  const s = 'Valid 2026-09-17 - 2026-12-31';
  assert.equal(chat(s), true);
  assert.equal(card(s), false);
});

test('CARD (d): a solicitation pointing AT Setnayan is not a leak', () => {
  for (const s of [
    'Message me on Setnayan for the full menu',
    'Chat me on Setnayan',
    'Ask me here on Setnayan',
  ]) {
    assert.equal(card(s), false, `expected card to allow ${JSON.stringify(s)}`);
  }
});

test('CARD (d): the exemption is the PHRASE, never the whole message', () => {
  // THE BYPASS THIS CLOSES. The first cut tested "on Setnayan" against the
  // whole body and skipped `solicit` when it fired anywhere. Because app_name
  // is also skipped on a card, a vendor could name another platform, point at
  // it, and say "Setnayan" to disarm the rule. All three were measured PASSING
  // under 'card'. If SOLICIT_TO_SETNAYAN ever goes back to a whole-body test,
  // these are the strings that catch it.
  //
  // Each one carries a solicit VERB ("message me on", "add me on", "reach me
  // on") pointed somewhere that is not us — that is what makes it a leak, and
  // that is what still fires once the exemption is scoped to the phrase.
  for (const s of [
    'Message me on Viber, not on Setnayan',
    'We reply on Setnayan or add me on WhatsApp',
    'reach me on IG, we are on Setnayan too',
  ]) {
    assert.equal(card(s), true, `card BYPASS — expected block: ${JSON.stringify(s)}`);
  }
});

test('CARD (d): only the solicit hit is dropped, not the rest of the message', () => {
  // "on Setnayan" must not become a bypass token that launders real contact
  // info sitting in the same string.
  assert.equal(card('Message me on Setnayan or 0917 880 7163'), true);
  assert.equal(card('Message me on Setnayan — hi@studio.com'), true);
  assert.equal(card('Message me on Setnayan, follow @juanphotos'), true);
  assert.equal(card('Message me on Setnayan or facebook.com/ourstudio'), true);
});

test('CARD (d): a solicitation pointing anywhere ELSE still blocks', () => {
  // Note `viber` is an app_name (skipped on a card) — this blocks on `solicit`
  // alone, which is exactly the rule the Setnayan carve-out must not widen.
  assert.equal(card('message me on viber'), true);
  assert.equal(card('add me on whatsapp'), true);
  assert.equal(card("let's take this off platform"), true);
});

test("CARD (d): chat is untouched — the scrub must never be applied there", () => {
  // All seven CARD (d) fixtures, honest and dishonest alike, block in chat.
  // Asserted so nobody "helpfully" extends the scrub to the chat profile: in a
  // chatroom "message me on Setnayan" is already redundant, and the whole
  // point of that gate is that a solicitation verb is suspicious full stop.
  for (const s of [
    'Message me on Setnayan for the full menu',
    'Chat me on Setnayan',
    'Message me on Viber, not on Setnayan',
    'Faster on Viber than on Setnayan',
    'We reply on Setnayan or add me on WhatsApp',
    'reach me on IG, we are on Setnayan too',
    'Viber only',
  ]) {
    assert.equal(chat(s), true, `expected chat to block ${JSON.stringify(s)}`);
  }
  // The one exception, and it is not the scrub's doing: "Ask me here on
  // Setnayan" has no solicit verb ("ask" is not in the list) and no app name,
  // so neither profile ever blocked it.
  assert.equal(chat('Ask me here on Setnayan'), false);
  assert.equal(card('Ask me here on Setnayan'), false);
});

test('CARD (d): SOLICIT_TO_SETNAYAN is stateless across calls', () => {
  // It carries /g. Used with String.replace that is fine, but a regression to
  // .test() would make every SECOND identical call disagree with the first
  // (lastIndex). Two passes over the same input must match.
  for (let i = 0; i < 4; i++) {
    assert.equal(card('Message me on Setnayan for the full menu'), false, `call ${i}`);
    assert.equal(card('Message me on Viber, not on Setnayan'), true, `call ${i}`);
  }
});

// -- 3. Real contact info still blocks on a card -----------------------------

test('CARD: every phone disguise survives the narrower filler gap', () => {
  for (const s of [
    '0917 880 7163',
    '(0917) 880 7163',
    '0917-880-7163',
    '+63 917 880 7163',
    '09178807163',
    '0 9 1 7 8 8 0 7 1 6 3',
    'zero nine one seven eight eight zero seven one six three',
    'my number is 09175551234',
  ]) {
    assert.equal(card(s), true, `expected card to block ${JSON.stringify(s)}`);
  }
});

test('CARD: email / obfuscated email / social link / handle are unchanged', () => {
  for (const s of [
    'hi@studio.com',
    'juan (at) gmail (dot) com',
    'facebook.com/ourstudio', // app_name is skipped; SOCIAL_URL is not
    'wa.me/639171234567',
    'follow @juan_photo',
  ]) {
    assert.equal(card(s), true, `expected card to block ${JSON.stringify(s)}`);
  }
});

test('CARD: solicitation phrasing still blocks', () => {
  assert.equal(card('message me on viber'), true);
  assert.equal(card('my number is below'), true);
});

// -- The chat profile is untouched -------------------------------------------

test("'card' does not leak back into 'chat'", () => {
  // The four relaxations, asserted from the chat side.
  assert.equal(chat('Instagram teaser reel'), true); // (c) app_name
  assert.equal(chat('Pink app-style neon signage'), true); // (c) euphemism
  assert.equal(chat('Php 9,000 per hour, minimum 4 hours, 150 pax, 20 staff'), true); // (a)
  assert.equal(chat('Valid 2026-09-17 - 2026-12-31'), true); // (b)
  assert.equal(chat('Message me on Setnayan for the full menu'), true); // (d)
  // And the chat-only Tier 1 reach that (a) gives up.
  assert.equal(chat('0917 my number is 8807163'), true);
});

// -- Known, deliberate over-block on a card ----------------------------------

test('CARD: a bare @ meaning "at" is STILL blocked — HANDLE is unchanged', () => {
  // Documented, not a bug: HANDLE cannot tell "@Tagaytay" (a venue) from
  // "@juanphotos" (a real Instagram handle), and letting it through would open
  // the exact leak this gate exists to close. The vendor writes "at Tagaytay".
  // Change this only with an owner ruling — it is the one measured misfire the
  // card profile does NOT relax.
  assert.equal(card('Coverage @Tagaytay'), true);
  assert.equal(card('Reception @Shangri-La'), true);
  // Unrelated, and deliberately left alone: HANDLE needs a non-word char
  // before the @, so this was never blocked in either profile.
  assert.equal(card('Photo@Manila'), false);
  assert.equal(chat('Photo@Manila'), false);
});

// -- Reporting shape ---------------------------------------------------------

test("the 'card' profile still reports categories + matched", () => {
  const r = evaluateMessage('reach me at 0917 880 7163', 'card');
  assert.equal(r.blocked, true);
  assert.ok(r.categories.includes('phone'));
  assert.ok(r.matched.length >= 1);
});
