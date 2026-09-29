/**
 * THE GUEST PATHWAY — guest side (owner 2026-09-26/27, spec corpus
 * DECISION_LOG "GUEST PATHWAY", "GET INSIDE", "NOBODY WITHOUT A KEY", "TWO
 * LEVELS OF ACCESS", "THE RSVP IS ONE EDITABLE SCENE + ONE SWITCH"; build brief
 * build-sessions/GUEST-PATHWAY-BUILD-BRIEF-2026-09-26.md).
 *
 * > *"we handle the chaos and organize it so everything is smooth for the
 * > users"* — ONE button per screen, and we choose the method for the guest.
 *
 *   1 · THE KEY GATE — a key with a missing required answer meets the RSVP page
 *       first, only what is missing; after the lock, inside as "Didn't reply".
 *   2 · THE RSVP PAGE — Terms required on Send; "only what is missing" carries
 *       everything else through untouched; one question at a time.
 *   3 · THE THANK-YOU — "Your guests" + ONE "Save to my account", method chosen
 *       by the device; the RSVP-page Terms reach the Google/Apple account.
 *   5 · THE STRANGER — general details + ONE "Get inside"; nothing inside is
 *       rendered for them; a signed-in non-guest gets "Ask to join".
 *   7 · "Two ways to celebrate" leaves the Invitation and the Day.
 *
 * Each decision is PURE and executed here; the wiring is read from source with
 * comments stripped, so a sentence in a comment can never satisfy a guard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { rsvpGate, saveMethodFor, isInAppWebview } from '@/lib/guest-one-path';
import { rsvpTermsCarried, TERMS_VERSION } from '@/lib/terms-agreement';
import { askOneAtATime } from '@/lib/rsvp-one-at-a-time';
import { dayOrdinal, thankYouHeadline, replySummary } from './thank-you-words';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const APP = join(process.cwd(), 'app');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const flat = (s: string) => s.replace(/\s+/g, ' ');

const PAGE = read('[slug]/page.tsx');
const BODY = read('[slug]/_components/site-body.tsx');
const REPLY = read('[slug]/invite/reply/page.tsx');
const ENTER = read('[slug]/invite/enter/page.tsx');
const DOOR_ACTION = read('[slug]/invite/actions.ts');
const CALLBACK = read('auth/callback/route.ts');
const PUBLIC_WIDGET = read('[slug]/_components/public-hideable-widget.tsx');

const OPEN = { locked: false, askMeal: true, askMobile: true };

// ═══ 1 · THE KEY GATE ═════════════════════════════════════════════════════

test('1 · a key with no answer meets the RSVP page first', () => {
  const g = rsvpGate({ ...OPEN, rsvpStatus: 'pending', mealPreference: null, mobile: null });
  assert.equal(g.kind, 'ask');
  assert.ok(g.kind === 'ask' && g.missing.includes('attending'));
});

test('1 · the couple marked them attending → ONLY the remaining details, and it says so', () => {
  const g = rsvpGate({ ...OPEN, rsvpStatus: 'attending', mealPreference: null, mobile: null });
  assert.deepEqual(g, { kind: 'ask', missing: ['meal', 'mobile'], coupleMarked: true });
});

test('1 · a question switched on LATER is asked alone', () => {
  // They replied (meal written), then the couple switched Mobile on.
  const g = rsvpGate({ ...OPEN, rsvpStatus: 'attending', mealPreference: 'fish', mobile: '' });
  assert.deepEqual(g.kind === 'ask' ? g.missing : null, ['mobile']);
});

test('1 · a switched-off question is never required', () => {
  const g = rsvpGate({ locked: false, askMeal: false, askMobile: false, rsvpStatus: 'attending', mealPreference: null, mobile: null });
  assert.deepEqual(g, { kind: 'inside', didntReply: false });
});

test('1 · a decliner is not asked for a meal or a number', () => {
  const g = rsvpGate({ ...OPEN, rsvpStatus: 'declined', mealPreference: null, mobile: null });
  assert.deepEqual(g, { kind: 'inside', didntReply: false });
});

test('1 · after the final-count lock the gate never closes — an unreplied guest is inside as "Didn\'t reply"', () => {
  const unreplied = rsvpGate({ ...OPEN, locked: true, rsvpStatus: 'pending', mealPreference: null, mobile: null });
  assert.deepEqual(unreplied, { kind: 'inside', didntReply: true });
  // …and a replied one missing a detail is not stopped either (no headcount questions).
  const replied = rsvpGate({ ...OPEN, locked: true, rsvpStatus: 'attending', mealPreference: null, mobile: null });
  assert.deepEqual(replied, { kind: 'inside', didntReply: false });
});

test('1 · WIRING: the event page redirects a key with missing answers to the RSVP page, on the SERVER, before anything renders', () => {
  const gate = PAGE.indexOf('const keyGate = rsvpGate(');
  const redirectAt = PAGE.indexOf('redirect(inviteReplyPath(event.slug ?? slug))');
  const firstGuestRender = PAGE.indexOf('identity={guestIdentity(');
  assert.ok(gate > -1, 'the event page no longer asks rsvpGate');
  assert.ok(redirectAt > gate, 'the event page no longer sends a gated guest to the RSVP page');
  assert.ok(redirectAt < firstGuestRender, 'the redirect now comes AFTER the guest page is built');
  assert.match(
    PAGE,
    // A plus-one is gated by `plusOneGate` instead — their own door, the
    // minimum four (owner 2026-09-29) — never the full reply.
    /if \(!isPlusOne && keyGate\.kind === 'ask' && !isEditorCanvas && !ownerCapability\) \{\s*redirect\(inviteReplyPath/,
    'the gate must spare only the Maker canvas, the event’s own host, and a plus-one (who has their own door)',
  );
  assert.match(PAGE, /didntReply: keyGate\.kind === 'inside' && keyGate\.didntReply/, 'the "Didn\'t reply" mark no longer reaches the page');
  assert.match(BODY, /\{g\.didntReply \? \(/, 'the "Didn\'t reply · you\'re in" chip is not drawn');
});

test('1 · WIRING: the RSVP page asks the SAME rule for which answers are missing', () => {
  assert.match(
    REPLY,
    /const gate = canvas \? \(\{ kind: 'inside', didntReply: false \} as const\) : rsvpGate\(\{/,
    'the RSVP page decides what is missing some other way',
  );
  assert.match(REPLY, /gate=\{gate\.kind === 'ask' \? \{ missing: gate\.missing, coupleMarked: gate\.coupleMarked \} : null\}/);
  // Both the event page and the RSVP page recognise the SAME key.
  assert.match(REPLY, /readGuestSessionForEvent\(event\.event_id as string\)/);
});

// ═══ 2 · THE RSVP PAGE ════════════════════════════════════════════════════

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

function guest(over: Record<string, unknown> = {}) {
  return {
    guest_id: 'g-1',
    first_name: 'Tita',
    last_name: 'Baby',
    display_name: 'Tita Baby',
    rsvp_status: 'attending',
    meal_preference: null,
    dietary_restrictions: 'nut allergy',
    guest_note: 'See you!',
    email: 'tita@example.com',
    mobile: null,
    qr_token: 't',
    photo_source: null,
    photo_url: null,
    plus_one_allowed: false,
    ...over,
  };
}

async function renderCard(extra: Record<string, unknown>, over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: guest(over),
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      doorAction: async () => {},
      offerSelfie: false,
      ...extra,
    } as never),
  );
}

test('2 · couple-marked: "The couple has you down as attending", only meal + mobile asked, "Not coming after all?"', async () => {
  const html = await renderCard({ gate: { missing: ['meal', 'mobile'], coupleMarked: true }, termsOnSend: true });
  assert.match(flat(html), /The couple has you down as <span[^>]*>attending<\/span>/);
  assert.match(html, /<select[^>]*name="meal_preference"/, 'the missing meal is not asked');
  const mobile = (html.match(/<input[^>]*name="contact_mobile"[^>]*>/g) ?? []).find((t) => !/type="hidden"/.test(t)) ?? '';
  assert.ok(mobile, `the missing mobile is not asked: ${html.match(/<input[^>]*contact_mobile[^>]*>/g)}`);
  assert.match(mobile, /required/, 'the missing mobile is not required');
  assert.doesNotMatch(html, /name="rsvp_status" value="maybe"/, 'the answer itself is asked again');
  assert.match(html, /Not coming after all\?/);
});

test('2 · 🔒 "only what is missing" carries every unasked answer through AS STORED — nothing is erased', async () => {
  // submitRsvp writes every field on every save; a box the card omitted would
  // post nothing and clear the stored note, the name, the allergy.
  const html = await renderCard({ gate: { missing: ['mobile'], coupleMarked: true }, termsOnSend: true }, {
    meal_preference: 'fish',
  });
  const main = html.slice(0, html.indexOf('data-rsvp-decline'));
  for (const [name, value] of [
    ['rsvp_status', 'attending'],
    ['meal_preference', 'fish'],
    ['dietary_restrictions', 'nut allergy'],
    ['guest_note', 'See you!'],
    ['contact_display_name', 'Tita Baby'],
  ] as const) {
    assert.match(
      main,
      new RegExp(`<input type="hidden" name="${name}" value="${value}"`),
      `${name} is not carried through — the focused save would erase it`,
    );
  }
});

test('2 · the Terms tick is on the Send step: unticked, required, one name', async () => {
  const html = await renderCard({ termsOnSend: true }, { rsvp_status: 'pending' });
  const tick = html.match(/<input[^>]*id="rsvp_terms"[^>]*>/)?.[0] ?? '';
  assert.ok(tick, 'no Terms tick on the RSVP page');
  assert.match(tick, /name="terms_agreed"/);
  assert.match(tick, /required/);
  assert.doesNotMatch(tick, /checked/, 'the Terms tick is pre-ticked — that is not an agreement');
  assert.match(html, />Send</, 'the one button is not "Send"');
});

test('2 · 🔒 the door action refuses an unticked Send, carries the tick in a server cookie, and never lets Send email a sign-in link', () => {
  const refuse = DOOR_ACTION.indexOf('if (!agreed && !declining)');
  const save = DOOR_ACTION.indexOf('return submitRsvp(');
  assert.ok(refuse > -1 && refuse < save, 'an unticked Send reaches the save');
  assert.match(DOOR_ACTION, /\?rsvp=terms/);
  assert.match(DOOR_ACTION, /jar\.set\(RSVP_TERMS_COOKIE, TERMS_VERSION, \{\s*httpOnly: true/, 'the agreement is not carried, or the cookie is readable by the page');
  const strip = DOOR_ACTION.indexOf('formData.delete(TERMS_FIELD)');
  assert.ok(strip > -1 && strip < save, 'Send would also email a sign-in link — saving is the NEXT screen’s one button');
});

test('2 · "Ask one question at a time" is read defensively from rsvp_ask_config.oneAtATime', async () => {
  assert.equal(askOneAtATime({ oneAtATime: true }), true);
  for (const off of [null, undefined, {}, { oneAtATime: 'yes' }, { oneAtATime: 1 }, [true]]) {
    assert.equal(askOneAtATime(off), false, `${JSON.stringify(off)} must be OFF`);
  }
  assert.match(REPLY, /oneAtATime=\{askOneAtATime\(event\.rsvp_ask_config\)\}/);
  // Every question is a step, so the switch can show one at a time.
  const html = await renderCard({ termsOnSend: true }, { rsvp_status: 'pending' });
  assert.ok((html.match(/data-rsvp-step/g) ?? []).length >= 3, 'the questions are not marked as steps');
});

// ═══ 3 · THE THANK-YOU ════════════════════════════════════════════════════

test('3 · the method is chosen by the DEVICE, never shown as a choice', () => {
  const both = { apple: true, google: true };
  const MESSENGER =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/430.0]';
  const INSTAGRAM = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Instagram 300.0';
  const IOS_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const IOS_APP = `${IOS_SAFARI} SetnayanApp`;
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
  // 📵 Never the email link any more (owner 2026-09-29, "NO EMAIL TO GUESTS"):
  // inside Messenger the button is "Open in your browser" (frame F).
  assert.equal(saveMethodFor(MESSENGER, both), 'browser', 'Google blocks sign-in inside Messenger — it must be "Open in your browser"');
  assert.equal(saveMethodFor(INSTAGRAM, both), 'browser');
  assert.ok(isInAppWebview(MESSENGER) && !isInAppWebview(IOS_SAFARI));
  assert.equal(saveMethodFor(IOS_SAFARI, both), 'apple');
  assert.equal(saveMethodFor(IOS_APP, both), 'apple');
  assert.equal(saveMethodFor(ANDROID, both), 'google');
  // A provider that is not switched on is never offered.
  assert.equal(saveMethodFor(IOS_SAFARI, { apple: false, google: true }), 'google');
  assert.equal(saveMethodFor(ANDROID, { apple: false, google: false }), 'link', 'no provider must fall back to the guest’s own link, never an email');
});

test('3 · WIRING: the thank-you mounts ONE Save, "Your guests", and a small "Not now"', () => {
  assert.match(ENTER, /<SaveToAccount\b/);
  assert.match(ENTER, /<YourGuests\b/);
  assert.match(ENTER, />\s*Not now\s*</);
  // Each plus-one's link is built from THEIR OWN key by the one url speller.
  assert.match(ENTER, /buildInvitationUrl\(\{ \.\.\.qrParams, qrToken: s\.qrToken \}\)/);
});

test('3 · 🔒 the Terms ticked on the RSVP page reach a Google/Apple account — the callback writes them', () => {
  assert.equal(rsvpTermsCarried(TERMS_VERSION), true);
  assert.equal(rsvpTermsCarried('2020-01-01'), false, 'an older version is not an agreement to this one');
  assert.equal(rsvpTermsCarried(undefined), false);
  const at = CALLBACK.indexOf('rsvpTermsCarried(request.cookies.get(RSVP_TERMS_COOKIE)?.value)');
  assert.ok(at > -1, 'the OAuth callback no longer records the RSVP-page agreement');
  const block = CALLBACK.slice(at, at + 700);
  assert.match(block, /terms_accepted_at: new Date\(\)\.toISOString\(\), terms_version: TERMS_VERSION/);
  assert.match(block, /\.is\('terms_accepted_at', null\)/, 'an existing agreement would be rewritten');
  assert.match(CALLBACK, /isEventConnectNext\(fallbackNext\) && rsvpTermsCarried/, 'the write is no longer scoped to "Save to my account"');
});

test('3 · the thank-you says the right thing, and reads the date as text', () => {
  assert.equal(dayOrdinal('2026-12-18'), '18th');
  assert.equal(dayOrdinal('2026-12-01'), '1st');
  assert.equal(dayOrdinal('2026-12-02'), '2nd');
  assert.equal(dayOrdinal('2026-12-23'), '23rd');
  assert.equal(dayOrdinal('2026-12-11'), '11th');
  assert.equal(dayOrdinal(null), null);
  assert.equal(
    thankYouHeadline({ status: 'attending', firstName: 'Ana Reyes', eventDate: '2026-12-18', solemn: false }),
    'See you on the 18th, Ana!',
  );
  assert.equal(replySummary({ status: 'attending', seats: 3, meal: 'fish', solemn: false }), 'Joyfully accepts · 3 seats · Fish');
});

test('3 · "Your guests": Send their invite for a named plus-one, Add their name for a TBA seat', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { YourGuests } = await import('../_components/your-guests');
  const html = renderToStaticMarkup(
    React.createElement(YourGuests, {
      guests: [
        { guestId: 'p1', name: 'Ben Reyes', inviteUrl: 'https://x/ana?invite=tok-ben' },
        { guestId: 'p2', name: null, inviteUrl: null },
      ],
      eventName: 'Indalecio & Claire',
      addNamesHref: '/ana/invite/reply#plus-ones',
    }),
  );
  assert.match(html, /Ben Reyes/);
  assert.match(html, /Send their invite/);
  assert.match(html, /\+2 · TBA/, 'an unnamed seat is numbered by seat — "+2 · TBA"');
  assert.doesNotMatch(html, /Guest \d|Seat \d/, 'a seat numbered by headcount');
  assert.match(html, /href="\/ana\/invite\/reply#plus-ones"[^>]*>Add their name/);
  const none = renderToStaticMarkup(
    React.createElement(YourGuests, { guests: [], eventName: 'x', addNamesHref: '#' }),
  );
  assert.equal(none, '', 'a guest bringing nobody is shown an empty section');
});

// ═══ 5 · THE STRANGER ═════════════════════════════════════════════════════

test('5 · the stranger gets ONE button — "Get inside" — and a signed-in non-guest gets "Ask to join"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GetInside } = await import('../_components/get-inside');
  const door = renderToStaticMarkup(
    React.createElement(GetInside, { slug: 'ana', eventId: 'e-1', signedInNotListed: false, theOrganizer: 'the couple' }),
  );
  assert.match(door, /Get inside/);
  assert.match(door, /Scan your QR · Tap NFC · Sign in/);
  assert.match(door, /href="\/login\?next=%2Fana"/);
  // "Ask to join" only on "Anyone, I approve" (owner 2026-09-27) — the closed
  // list is pinned in the-poster-qr-opens-the-event.test.ts.
  const ask = renderToStaticMarkup(
    React.createElement(GetInside, {
      slug: 'ana',
      eventId: 'e-1',
      signedInNotListed: true,
      theOrganizer: 'the couple',
      mayAskToJoin: true,
    }),
  );
  assert.match(ask, /You’re not on the guest list for this event yet/);
  assert.match(ask, /href="\/join\/e-1"[^>]*>Ask to join/);
  assert.doesNotMatch(ask, /Get inside/, 'two buttons on one screen');
  assert.match(
    PAGE,
    /signedInNotListed:\s*Boolean\(viewerAccount\?\.id\) && !viewerHoldsASeat && !ownerCapability && !vendorCapability/,
  );
});

test('5 · 🔒 nothing INSIDE is rendered for a stranger — decided on the server', () => {
  const start = BODY.indexOf('const anonymousTree = ');
  const end = BODY.indexOf('const guestTree = ');
  const anon = BODY.slice(start, end);
  assert.ok(start > -1 && end > start);
  assert.match(anon, /const insideAllowed = viewerIsHost \|\| vendorCapability !== null;/);
  assert.match(anon, /\{insideAllowed && dayOfPhase === 'live' && plan\.liveMediaVisible && liveWall \? \(/, 'the live photo wall reaches strangers');
  assert.match(anon, /\{insideAllowed \? \(\s*<div className="mt-8 text-center">\s*<Link\s*href=\{`\/\$\{event\.slug\}\/find-seat`\}/, 'the seat finder is offered to strangers');
  assert.match(anon, /candidCameraActive=\{insideAllowed && publicCandidCameraActive\}/, 'the camera reaches strangers');
  assert.match(anon, /photosHref=\{insideAllowed \? publicAlbumHref : null\}/, 'the photos reach strangers');
  assert.match(anon, /<GetInside\b/, 'the stranger has no way in');
});

test('5 · the day-of schedule is GENERAL — shown without a key, on the day too', () => {
  const at = PUBLIC_WIDGET.indexOf("case 'schedule':");
  const block = PUBLIC_WIDGET.slice(at, PUBLIC_WIDGET.indexOf("case 'venue_map':"));
  assert.ok(at > -1);
  assert.doesNotMatch(block, /!isLive/, 'the schedule vanishes for strangers on the day again');
  assert.match(block, /return scheduleBlocks\.length > 0 \? \(/);
});

test('5 · "Not you? Switch" clears the guest pass with a POST, never a prefetchable link', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { NotYouSwitch } = await import('../_components/not-you-switch');
  const html = renderToStaticMarkup(React.createElement(NotYouSwitch, { slug: 'ana' }));
  const form = html.match(/<form[^>]*>/)?.[0] ?? '';
  assert.match(form, /action="\/ana\/sign-out"/);
  assert.match(form, /method="post"/);
  assert.match(html, /Switch/);
  assert.match(read('[slug]/sign-out/route.ts'), /await clearGuestSession\(\);/);
  assert.match(REPLY, /<NotYouSwitch slug=\{home\} \/>/);
});

// ═══ 7 · "Two ways to celebrate" leaves the Invitation and the Day ════════

test('7 · the tier_comparison pitch is filtered out before the plan, except Post Event — the Maker too', () => {
  // Owner review 2026-09-27: the Maker shows what guests see, so its canvas no
  // longer keeps the pitch on the Invitation or the Day. ONE rule, read by the
  // page and the Maker's navigator (`widgetsGuestsMeet`, lib/maker-scene-list.ts).
  assert.match(BODY, /widgets:\s*widgetsGuestsMeet\(widgets, lifecyclePhase\),/);
  assert.doesNotMatch(BODY, /isMakerCanvas \|\| lifecyclePhase === 'editorial'/);
});
