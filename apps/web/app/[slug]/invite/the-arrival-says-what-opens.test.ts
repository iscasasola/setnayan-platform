/**
 * THE ARRIVAL SAYS WHAT THE NEXT SCREEN ACTUALLY OPENS.
 *
 * Owner walked the invite arrival on 2026-09-11 and found five things the
 * arrival PROMISED that the destination did not deliver. They are one disease,
 * so they are guarded in one file — one section each, each able to fail.
 *
 *   1 · the sign-in line spoke to somebody who already had an account;
 *   2 · a decline went on to ask for a meal;
 *   3 · the reason worth giving for signing in — the photos — was not given;
 *   4 · the invite asked for a face, which is not where face tagging happens;
 *   5 · the last door promised an invitation and opened a save the date.
 *
 * 🪤 WHY SOME OF THESE READ SOURCE AND SOME RENDER. The reply and enter doors
 * are server components sitting on a `server-only` import chain, so they cannot
 * be rendered here; their claims are read from the source with the repo's one
 * comment-stripper (so a sentence quoted in a COMMENT can never satisfy a test —
 * and this very change quotes the old, false sentence in a comment). The shared
 * reply card renders, so its claims are asserted on real markup.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement` and a
 * static import would be hoisted above the assignment and throw. Same reason,
 * same shape, as `_lib/only-the-answer-freezes.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { getLifecyclePhase, type LifecyclePhase } from '@/lib/invitation-widgets';
import { arrivalDestination, arrivalDestinationWords } from '@/lib/invite-destination';

(globalThis as unknown as { React: unknown }).React = React;

{
  // `server-only` is a bundler-provided marker that throws outside Next; the
  // reply card's action chain pulls it in. Stubbing it changes no behaviour —
  // the real boundary is `lint-server-only-boundary.mjs`, which CI still runs.
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const WEB = join(APP, '..');
/** Source with comments stripped — prose about a claim must never satisfy it. */
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const readWeb = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/**
 * A window that FACES THE SABOTAGE: the text between two anchors, both of which
 * must exist. A guard that silently measures an empty slice is not a guard.
 */
/**
 * Collapse whitespace. 🪤 PROSE IN JSX IS LINE-WRAPPED, so a sentence a reader
 * sees as one line is "…the photos\n            they are in…" in the source. A
 * guard that matches the unwrapped form goes red on a re-indent and green on
 * nothing — measured: this file's own first run failed exactly that way.
 */
const flat = (s: string) => s.replace(/\s+/g, ' ');

function between(src: string, open: string, close: string, what: string): string {
  const a = src.indexOf(open);
  assert.notEqual(a, -1, `${what}: the opening anchor ${JSON.stringify(open)} is gone — update this test`);
  const b = src.indexOf(close, a + open.length);
  assert.notEqual(b, -1, `${what}: the closing anchor ${JSON.stringify(close)} is gone — update this test`);
  return src.slice(a, b);
}

const REPLY = read('[slug]/invite/reply/page.tsx');
const ENTER = read('[slug]/invite/enter/page.tsx');
const WIDGET = read('[slug]/_components/rsvp-widget.tsx');

// ═══ 1 · the sign-in line is true for somebody with NO account ═════════════

test('the provider block no longer tells an accountless guest it "fills this in for you"', () => {
  const block = between(
    REPLY,
    'ANY_OAUTH_ENABLED ? (',
    '<OAuthButtonRow',
    'the provider block on the Reply door',
  );
  assert.doesNotMatch(
    flat(block),
    /Fills this in for you, and becomes how you sign in later\./,
    'the old line is back: it reads as though the guest already has an account, which is exactly what the owner caught',
  );
  assert.match(
    flat(block),
    /No Setnayan account yet\?/,
    'the block no longer opens by telling a guest with no account that they are catered for',
  );
  assert.match(
    flat(block),
    /makes one in a tap/,
    'the block no longer says that continuing MAKES the account — the whole correction',
  );
});

test('the promise it does make is one the provider flow keeps', () => {
  // A provider sign-in returns through the connect route, and the page reads the
  // account's own saved details as defaults. Both halves must still be wired, or
  // "fills your name and email in below" becomes the next false sentence.
  assert.match(REPLY, /OAuthButtonRow next=\{connectPath\}/, 'the provider buttons no longer return through connect');
  assert.match(
    REPLY,
    /\.select\('meal_preference, dietary_restrictions, email, phone, display_name'\)/,
    'the door no longer reads the account details it promises to fill in',
  );
  assert.match(REPLY, /profileDetails=\{profileDetails\}/, 'the read no longer reaches the card');
});

// ═══ 3 · signing in keeps the photos — said, and true ══════════════════════

test('the photos reason is given, at the provider block and not merely somewhere in the file', () => {
  const block = between(
    REPLY,
    'ANY_OAUTH_ENABLED ? (',
    '<OAuthButtonRow',
    'the provider block on the Reply door',
  );
  assert.match(flat(block), /It also keeps the photos of you/, 'the reason the owner asked for is not on the door');
  assert.match(
    flat(block),
    /this page shows each guest the photos they are in/,
    'the photos sentence no longer names the surface that actually ships',
  );
});

test('the photos sentence does not outrun the feature', () => {
  // ⚠ THE /features FALSE-CLAIM TRAP. Two claims are made and BOTH must hold:
  //   · the guest gallery is mounted on the event page for the day window;
  //   · an account, not the cookie, is what reaches the event afterwards.
  const body = readWeb('app/[slug]/_components/site-body.tsx');
  assert.match(body, /<PhotosOfYouGallery/, 'the guest gallery is no longer mounted — the photos sentence is now a claim about nothing');
  assert.match(
    readWeb('app/[slug]/page.tsx'),
    /findGuestSeatForUser\(/,
    'the account-to-seat path is gone — "reach this wedding again from any phone" would stop being true',
  );
  // And nothing wider is promised. A cross-event photo "collection" was NOT
  // found in the tree, so the door must not describe one.
  const block = between(REPLY, 'ANY_OAUTH_ENABLED ? (', '<OAuthButtonRow', 'the provider block');
  assert.doesNotMatch(
    flat(block),
    /collection|all your events|every event/i,
    'the door is promising a cross-event photo collection, which was never verified to exist',
  );
});

// ═══ 4 · no face tagging on the invite — and none taken from the Event Hub ══

test('the Reply door asks this card NOT to offer the selfie', () => {
  const mount = between(REPLY, '<RsvpWidget', '/>', 'the RsvpWidget mount on the Reply door');
  assert.match(
    mount,
    /offerSelfie=\{false\}/,
    'the invite arrival is asking for a face again — owner: face tagging happens on the day, not on the invite',
  );
});

test('the Event Hub card keeps its selfie — the prop defaults ON, and no hub mount turns it off', () => {
  const body = readWeb('app/[slug]/_components/site-body.tsx');
  assert.ok(body.split('<RsvpWidget').length - 1 > 0, 'the body renders no reply card at all — read this file');
  assert.doesNotMatch(
    body,
    /offerSelfie=\{false\}/,
    'a removal scoped to the invite arrival has leaked onto the Event Hub card',
  );
  assert.match(WIDGET, /offerSelfie = true,/, 'the prop no longer defaults on — every other surface would lose the selfie silently');
});

test('the day-of catch the removal relies on is still mounted', () => {
  // 🔑 THE REMOVAL IS ONLY SAFE BECAUSE THIS SHIPS. `day-of-face-enroll.tsx`
  // calls itself "the day-of catch for a guest who skipped the optional RSVP
  // selfie". If its mounts go, the invite removal becomes a quiet feature loss.
  // Pinned per FILE, not as a total: a file-level count cannot say WHICH mount
  // survived. `site-body.tsx` is deliberately NOT pinned here — its mount is
  // `context={isLive ? 'day_of' : 'pre_event'}`, i.e. it also prompts BEFORE the
  // day, and whether that early prompt survives is an OPEN OWNER QUESTION. These
  // two are the ones the owner's own sentence names.
  for (const rel of ['app/[slug]/hub/page.tsx', 'app/papic/guest/_components/papic-guest-capture.tsx']) {
    assert.match(
      readWeb(rel),
      /<DayOfFaceEnroll/,
      `${rel} no longer mounts the day-of face-enrolment catch — taking the selfie off the invite now loses the feature outright`,
    );
  }
});

// ═══ 2 · a decline is not asked for the rest ═══════════════════════════════

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  occasion: 'celebration',
  solemn: false,
  organizerIsHonoree: false,
};

function guest(over: Record<string, unknown> = {}) {
  return {
    guest_id: 'g-1',
    first_name: 'Ana',
    last_name: 'Cruz',
    display_name: 'Ana Cruz',
    rsvp_status: 'pending',
    meal_preference: null,
    dietary_restrictions: null,
    guest_note: null,
    email: null,
    mobile: null,
    qr_token: 't',
    photo_source: null,
    photo_url: null,
    plus_one_allowed: false,
    ...over,
  };
}

async function render(props: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: guest(over),
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      replyLocked: false,
      ...props,
    } as never),
  );
}

/** The markup of the element carrying `cls`, from its tag to the end of the doc. */
function fromClass(html: string, cls: string): string {
  const i = html.indexOf(`class="${cls}"`);
  assert.notEqual(i, -1, `no element carries class="${cls}" — the reveal wrapper is gone or renamed`);
  return html.slice(i);
}

test('the meal and dietary boxes ride the EXISTING attending reveal, not a second mechanism', async () => {
  const html = await render();
  // The one rule, declared once, still hides the class by default and reveals it
  // only for an attending answer. Restating it would be the second mechanism.
  assert.match(
    html,
    /\.rsvp-form \.selfie-reveal,\.rsvp-form \.attending-reveal\{display:none\}/,
    'the reveal no longer hides by default — every decline would see the meal boxes',
  );
  assert.match(
    html,
    /\.rsvp-form:has\(input\[name="rsvp_status"\]\[value="attending"\]:checked\) \.attending-reveal\{display:block\}/,
    'the reveal is no longer keyed on the attending radio',
  );
  // …and the boxes are INSIDE it. Anchored to the wrapper, not to the file.
  const revealed = fromClass(html, 'attending-reveal');
  assert.match(revealed, /name="meal_preference"/, 'the meal box is outside the attending reveal — a decline is still asked what it wants to eat');
  assert.match(revealed, /name="dietary_restrictions"/, 'the dietary box is outside the attending reveal');
  // No client state was introduced doing it.
  assert.doesNotMatch(WIDGET, /'use client'|useState|onChange=/, 'the reply card has become a client component');
});

test('a returning decliner does not get the boxes back through the other path', async () => {
  // ⚠ TWO PATHS REACH THESE BOXES. The CSS reveal is one; the outright renders
  // keyed on `guest.rsvp_status` are the other, and that second path is what
  // makes an ALREADY-declined guest different from a fresh one.
  //  · open list, already declined → the attending radio must NOT be checked,
  //    so the same one rule keeps them hidden.
  const open = await render({}, { rsvp_status: 'declined' });
  const attendingInput = open.match(/<input[^>]*value="attending"[^>]*>/)?.[0] ?? '';
  assert.notEqual(attendingInput, '', 'the attending radio is gone from an open list');
  assert.doesNotMatch(attendingInput, /checked/, 'a declined guest arrives with "attending" pre-checked — the reveal would open on load');
  assert.match(fromClass(open, 'attending-reveal'), /name="meal_preference"/);

  //  · FINAL list, already declined → there is no radio at all, so the CSS rule
  //    is not even rendered. The boxes must be absent outright.
  const locked = await render({ replyLocked: true }, { rsvp_status: 'declined' });
  assert.doesNotMatch(locked, /rsvp_status/, 'the locked card still names the answer control');
  assert.doesNotMatch(
    locked,
    /name="meal_preference"/,
    'a guest whose FROZEN answer is "declined" is still asked for a meal — the CSS cannot help here, there is no radio',
  );
  assert.doesNotMatch(locked, /name="dietary_restrictions"/, 'same for the dietary box on a frozen decline');
});

test('what survives a decline: the contact boxes and the note stay', async () => {
  // Orchestrator's call on the owner's behalf, 2026-09-11, reversible: the host
  // still needs a way to reach them, the email is also their sign-in, and a
  // declining guest most often wants to leave a message.
  const locked = await render({ replyLocked: true }, { rsvp_status: 'declined' });
  for (const field of ['contact_email', 'contact_mobile', 'contact_display_name', 'guest_note']) {
    assert.match(locked, new RegExp(`name="${field}"`), `${field} was taken away from a declining guest`);
  }
});

test('a guest who IS coming still gets the meal boxes when the list is final', async () => {
  // The other direction of the same line: the list finalizes about a fortnight
  // out, which is exactly when "nut allergy" matters most.
  const locked = await render({ replyLocked: true }, { rsvp_status: 'attending' });
  assert.match(locked, /name="meal_preference"/, 'a coming guest lost the meal box once the list was frozen');
  assert.match(locked, /name="dietary_restrictions"/, 'a coming guest lost the allergy box once the list was frozen');
});

test('the door renders no selfie, the site card still does', async () => {
  // 🪤 ANCHORED ON THE CONTROLS, NOT ON THE WORD. `.selfie-reveal` is named in
  // the card's one CSS rule — which must STAY, because the same rule drives the
  // meal reveal above. A `doesNotMatch(/selfie/)` would therefore be red for a
  // reason that has nothing to do with whether a face is being asked for.
  const onDoor = await render({ offerSelfie: false });
  for (const control of ['selfie_ref', 'biometric_consent', 'selfie_quality']) {
    assert.doesNotMatch(
      onDoor,
      new RegExp(`name="${control}"`),
      `the invite arrival still posts ${control} — it is asking for a face again`,
    );
  }
  const onSite = await render({}, { rsvp_status: 'attending' });
  assert.match(
    onSite,
    /name="biometric_consent"/,
    'the Event Hub card lost its selfie — the removal was meant to be scoped to the invite arrival',
  );
});

// ═══ 5 · the last door names the face it is about to open ══════════════════

test('the map: every phase the Hub can wear has its own words', () => {
  const cases: [LifecyclePhase, string][] = [
    ['save_the_date', 'save_the_date'],
    ['rsvp', 'invitation'],
    ['event', 'day_of'],
    ['editorial', 'story'],
  ];
  for (const [phase, expected] of cases) {
    assert.equal(arrivalDestination({ phasesEnabled: true, lifecyclePhase: phase }), expected, `phase ${phase}`);
  }
  // Phases OFF is the ordinary body — hero, details and the reply card together.
  // That IS the invitation, and must not silently become a save-the-date.
  for (const [phase] of cases) {
    assert.equal(arrivalDestination({ phasesEnabled: false, lifecyclePhase: phase }), 'invitation', `phases off, ${phase}`);
  }
});

test('a FAR-FUTURE event is not promised an invitation', () => {
  // ⚠ CONSTRUCTED, NOT SPOT-CHECKED. The event the owner walked crosses the
  // threshold on its own within days, at which point the old copy becomes true
  // FOR IT and false for everyone further out. So this builds the far-future
  // case rather than reading any real event, and asks the SAME resolver the
  // Event Hub asks — the number lives in one place and is not repeated here.
  const NOW = Date.UTC(2026, 8, 11, 4, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const MNL = 'Asia/Manila';

  const far = getLifecyclePhase(iso(NOW + 200 * day), MNL, null, NOW);
  assert.equal(far, 'save_the_date', 'fixture drifted: 200 days out is no longer the save-the-date phase');
  const farWords = arrivalDestinationWords(arrivalDestination({ phasesEnabled: true, lifecyclePhase: far }));
  assert.doesNotMatch(
    farWords.blurb,
    /invitation is ready/,
    'a couple 200 days out is still told their invitation is ready, over a page that opens the save the date',
  );
  assert.doesNotMatch(farWords.blurb, /your QR/, 'the QR is promised in a phase where qr_card is gated out of the page');
  assert.doesNotMatch(farWords.cta, /Open your invitation/, 'the button still says invitation');
  assert.match(farWords.cta, /save the date/i, 'the button does not name what it opens');

  // …and the near case is untouched: the shipped sentence, byte for byte.
  const near = getLifecyclePhase(iso(NOW + 30 * day), MNL, null, NOW);
  assert.equal(near, 'rsvp', 'fixture drifted: 30 days out is no longer the invitation phase');
  const nearWords = arrivalDestinationWords(arrivalDestination({ phasesEnabled: true, lifecyclePhase: near }));
  assert.equal(
    nearWords.blurb,
    'Your invitation is ready — your seat, your QR and everything shared with guests are waiting on it.',
    'the sentence that was never wrong has been rewritten',
  );
  assert.equal(nearWords.cta, 'Open your invitation');
});

test('the door ASKS the resolver — it does not restate the rule, and does not repoint the link', () => {
  assert.match(ENTER, /arrivalDestinationFor\(\{/, 'the Enter door no longer resolves the face it is opening');
  assert.match(ENTER, /\{destinationWords\.blurb\}/, 'the blurb is hard-coded again');
  assert.match(ENTER, /\{destinationWords\.cta\}/, 'the button label is hard-coded again');
  assert.doesNotMatch(
    flat(ENTER),
    /Your invitation is ready/,
    'the door has a literal invitation sentence again — it must come from the phase',
  );
  // The DESTINATION was never the fault. `/[slug]` is the Event Hub; `/hub` is
  // the fullscreen event-DAY hub and is wrong for an arrival months out.
  assert.match(ENTER, /href=\{`\/\$\{home\}`\}/, 'the Enter door no longer opens the Event Hub');
  assert.doesNotMatch(ENTER, /\/hub`/, 'the Enter door was repointed at the event-day hub');

  // No threshold is restated, in the door or in the module it asks.
  const MODULE = readWeb('lib/invite-destination.ts');
  for (const src of [ENTER, MODULE]) {
    assert.doesNotMatch(src, /STD_THRESHOLD_DAYS|\b90\b/, 'the 90-day rule has been copied out of its one home');
  }
  assert.match(MODULE, /getLifecyclePhase\(/, 'the module stopped asking the Event Hub’s own resolver');
  assert.match(MODULE, /solemnAdjustedPhase\(/, 'the module dropped the solemn adjustment — a wake would be offered a save-the-date');
});
