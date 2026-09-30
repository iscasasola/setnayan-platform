/**
 * THE SELFIE WAITS FOR A YES.
 *
 * Owner, verbatim, 2026-09-29, about the RSVP's "Take a selfie" step (it was
 * shown to every attending guest):
 *   *"registry of face tagging starts when papic service is running. if not
 *   running then this is not needed?"* →
 *   *"only if the want tagging service. if the do not click tagging service.
 *   no selfie needed"* →
 *   *"it should only depend if they want to be tagged"*.
 *
 * THE RULE, each part able to fail on its own below:
 *   1 · one plain question first — "Want to be tagged in the photos?" —
 *       "Yes, tag me" / "No thanks", neither pre-set for a guest who never
 *       answered;
 *   2 · the selfie is drawn ONLY behind the Yes (a CSS `:has()` reveal keyed on
 *       value="yes", nothing else), on the open card AND the locked one;
 *   3 · No asks nothing more — and `submitRsvp` refuses any selfie that still
 *       rides along in a hidden input (a hidden input still POSTS);
 *   4 · the day-of catch honours the answer: a stored No is never asked again,
 *       a guest who never answered is asked the SAME one question first, and
 *       the couple's decline puts the question to nobody.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, same shape as the-arrival-says-what-opens.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  dayOfFaceCatchShows,
  parseFaceTaggingAnswer,
  FACE_TAGGING_QUESTION,
} from '@/lib/face-tagging-wish';

(globalThis as unknown as { React: unknown }).React = React;

{
  // Same stub as the sibling render guards: `server-only` throws outside Next.
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
/** Source with comments stripped — prose about a claim must never satisfy it. */
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

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
    rsvp_status: 'attending',
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

async function card(props: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('./rsvp-widget');
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

/** The `<input>` tag for one tag answer. */
function answerInput(html: string, value: 'yes' | 'no'): string {
  const tag = html.match(new RegExp(`<input[^>]*name="face_tagging"[^>]*value="${value}"[^>]*>`))?.[0] ?? '';
  assert.notEqual(tag, '', `no "${value}" answer on the card — the question is gone`);
  return tag;
}

/** Where the selfie's own consent box sits, and where the Yes-reveal opens. */
function selfieSitsBehindTheYes(html: string, label: string) {
  const consent = html.indexOf('name="biometric_consent"');
  assert.notEqual(consent, -1, `${label}: the selfie is not on the card at all — the Yes leads nowhere`);
  // The selfie's step is the element carrying the reveal class; the consent box
  // must be INSIDE it — i.e. after its opening tag, and no other step opened
  // in between.
  const reveal = html.lastIndexOf('class="tag-yes-reveal"', consent);
  assert.notEqual(reveal, -1, `${label}: the selfie is drawn outside the Yes reveal — it shows without being chosen`);
  assert.doesNotMatch(
    html.slice(reveal + 1, consent),
    /data-rsvp-step/,
    `${label}: another step opens between the Yes reveal and the selfie — the selfie is not the one behind the Yes`,
  );
  // …and the question comes FIRST.
  const question = html.indexOf(FACE_TAGGING_QUESTION);
  assert.ok(question !== -1 && question < reveal, `${label}: the selfie comes before the question`);
}

// ═══ 1 · one plain question first ══════════════════════════════════════════

test('1 · the card asks "Want to be tagged in the photos?" with two choices, none pre-set', async () => {
  const html = await card();
  assert.ok(html.includes(FACE_TAGGING_QUESTION), 'the question is not on the card');
  assert.ok(html.includes('Yes, tag me') && html.includes('No thanks'), 'the two choices are not worded as the owner asked');
  for (const v of ['yes', 'no'] as const) {
    assert.doesNotMatch(answerInput(html, v), /checked/, `"${v}" arrives pre-ticked for a guest who never answered`);
  }
});

test('1 · a stored answer is shown back, and only that one', async () => {
  const yes = await card({}, { face_tagging_wanted: true });
  assert.match(answerInput(yes, 'yes'), /checked/, 'a guest who said yes sees no answer');
  assert.doesNotMatch(answerInput(yes, 'no'), /checked/);
  const no = await card({}, { face_tagging_wanted: false });
  assert.match(answerInput(no, 'no'), /checked/, 'a guest who said no sees no answer');
  assert.doesNotMatch(answerInput(no, 'yes'), /checked/);
});

// ═══ 2 · the selfie only behind the Yes ════════════════════════════════════

test('2 · the reveal hides the selfie by default and opens ONLY on "yes"', async () => {
  const html = await card();
  assert.match(html, /\.rsvp-form \.tag-yes-reveal\{display:none\}/, 'the selfie is not hidden by default — it shows unasked');
  assert.match(
    html,
    /\.rsvp-form:has\(input\[name="face_tagging"\]\[value="yes"\]:checked\) \.tag-yes-reveal\{display:block\}/,
    'the selfie reveal is not keyed on the Yes',
  );
  assert.doesNotMatch(
    html,
    /\[value="no"\]:checked\) \.tag-yes-reveal/,
    'a "No thanks" opens the selfie',
  );
  selfieSitsBehindTheYes(html, 'open card');
});

test('2 · the locked card (list final, guest coming) keeps the same order and the same reveal', async () => {
  const html = await card({ replyLocked: true });
  assert.doesNotMatch(html, /rsvp_status/, 'the locked card names the answer control again');
  assert.match(html, /\.rsvp-form \.tag-yes-reveal\{display:none\}/, 'on a locked card the selfie shows unasked — its reveal rule is missing');
  selfieSitsBehindTheYes(html, 'locked card');
});

test('2 · with the selfie not offered (the invite door, or the couple declined), neither the question nor the selfie is drawn', async () => {
  const html = await card({ offerSelfie: false });
  assert.ok(!html.includes(FACE_TAGGING_QUESTION), 'the question is asked where no selfie may be offered');
  assert.doesNotMatch(html, /name="face_tagging"/);
  assert.doesNotMatch(html, /name="biometric_consent"/, 'the selfie is drawn where it was not offered');
});

test('2 · 🏷 THE INVITATION ASKS, THE DAY TAKES THE SELFIE (owner 2026-09-30, "go"): the question and its answer, no camera, no face field', async () => {
  const html = await card({ offerSelfie: false, askTagging: true, faceMode: 'mode_a' });
  assert.ok(html.includes(FACE_TAGGING_QUESTION), 'the invitation no longer asks the tagging question');
  answerInput(html, 'yes');
  answerInput(html, 'no');
  assert.match(html, /Yes means one quick selfie on the day, so your photos find you\./, 'the line under the question does not say the selfie is on the day');
  // 📵 No face is collected at the invitation — no camera, no consent tick, no photo field.
  assert.doesNotMatch(html, /name="biometric_consent"|name="age_affirmation"|name="selfie_/, 'the invitation draws a selfie again');
  assert.doesNotMatch(html, /tag-yes-reveal/, 'a hidden selfie step rides along on the invitation');
  // …and the invite's save strips any face field a crafted post carries.
  const { stripInviteFaceFields } = await import('@/lib/face-tagging-wish');
  const fd = new FormData();
  for (const [k, v] of [['face_tagging', 'yes'], ['delete_selfie', '1'], ['selfie_ref', 'r2://x'], ['selfie_refs', 'a,b'], ['selfie_vector', '[1]'], ['selfie_anything', 'x'], ['biometric_consent', '1'], ['age_affirmation', '1'], ['rsvp_status', 'attending']] as [string, string][]) fd.set(k, v);
  stripInviteFaceFields(fd);
  assert.deepEqual([...fd.keys()].sort(), ['delete_selfie', 'face_tagging', 'rsvp_status'], 'a face field survives the invitation’s save');
  const door = read('app/[slug]/invite/actions.ts');
  const strip = door.indexOf('stripInviteFaceFields(formData);');
  assert.ok(strip > -1 && strip < door.indexOf('return submitRsvp(eventId, guestId, formData);'), 'the invitation’s save no longer strips face fields before submitRsvp');
  // The reply page asks only where the couple has not declined.
  assert.match(read('app/[slug]/invite/reply/page.tsx'), /offerSelfie=\{false\}\s*askTagging=\{faceTagging\.askable\}/);
});

test('2 · the Event Hub card asks only where the couple has not declined', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /offerSelfie=\{faceTaggingAskable\}/, 'the Event Hub card no longer honours the couple’s decline');
  const faceMode = read('lib/papic-face-mode.ts');
  assert.match(
    faceMode,
    /askable: row\.face_tagging_declined_by_couple !== true/,
    'the ask is no longer switched off by the couple’s decline',
  );
});

// ═══ 3 · No asks nothing more — and nothing rides along ════════════════════

test('3 · submitRsvp stores the answer and refuses the selfie after a "No"', () => {
  const src = read('app/[slug]/actions.ts');
  // `let` since 2026-09-29: an unconfirmed "No" after a selfie changes nothing (no-thanks-deletes-the-selfie.test.ts).
  assert.match(src, /(?:const|let) taggingWish = parseFaceTaggingAnswer\(formData\.get\(FACE_TAGGING_FIELD\)\)/, 'the answer is not read');
  assert.match(src, /\.update\(\{ face_tagging_wanted: taggingWish \}\)/, 'the answer is not stored — the day-of catch cannot honour it');
  const gate = src.match(/if \(selfieRef && biometricConsent && ageAffirmed[^{]*\{/)?.[0] ?? '';
  assert.notEqual(gate, '', 'the enrolment gate is gone — read actions.ts');
  assert.match(gate, /taggingWish !== false/, 'a "No thanks" still enrols the selfie left in a hidden input');
  // The consent gate itself is untouched — this only ever narrows.
  for (const term of ['biometricConsent', 'ageAffirmed', '!faceExcluded', '!knownMinor']) {
    assert.ok(gate.includes(term), `the consent gate lost ${term}`);
  }
});

test('3 · the posted answer parses to exactly three outcomes', () => {
  assert.equal(parseFaceTaggingAnswer('yes'), true);
  assert.equal(parseFaceTaggingAnswer('no'), false);
  for (const junk of [null, undefined, '', 'YES', 'true', '1']) {
    assert.equal(parseFaceTaggingAnswer(junk as never), undefined, `${String(junk)} must leave the stored answer alone`);
  }
});

// ═══ 4 · the day-of catch honours the answer ═══════════════════════════════

test('4 · the catch: No is never asked again; never-answered is asked; the couple’s decline asks nobody', () => {
  assert.equal(dayOfFaceCatchShows({ askable: true, enrolled: false, wish: false }), false, 'a guest who said No is nagged on the day');
  assert.equal(dayOfFaceCatchShows({ askable: true, enrolled: false, wish: null }), true, 'a guest who never answered is not asked');
  assert.equal(dayOfFaceCatchShows({ askable: true, enrolled: false, wish: undefined }), true);
  assert.equal(dayOfFaceCatchShows({ askable: true, enrolled: false, wish: true }), true, 'a yes without a selfie is not caught');
  assert.equal(dayOfFaceCatchShows({ askable: true, enrolled: true, wish: null }), false, 'an enrolled guest is asked again');
  assert.equal(dayOfFaceCatchShows({ askable: false, enrolled: false, wish: true }), false, 'the couple declined and the guest is still asked');
});

test('4 · both parents gate the camera’s face step on the wish', () => {
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /needsFaceEnroll = enrollError\s*\?\s*false\s*:\s*dayOfFaceCatchShows\(\{/, 'the hub loader ignores the guest’s answer');
  assert.match(loaders, /wish: faceTaggingWish/);
  const page = read('app/papic/guest/page.tsx');
  assert.match(page, /needsFaceEnroll=\{dayOfFaceCatchShows\(\{/, 'the camera page ignores the guest’s answer');
  assert.match(page, /faceTaggingWish=\{faceTaggingWish\}/, 'the camera page does not hand the answer to the face step');
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /faceTaggingWish=\{guest\.face_tagging_wanted \?\? null\}/, 'the hub’s inline camera does not hand the answer to the face step');
});

test('4 · the face step asks the one question first, and "No thanks" closes every prompt', () => {
  const step = read('app/[slug]/_components/day-of-face-enroll.tsx');
  assert.match(step, /wish = null,/, 'a mount that forgets the answer would show the selfie unasked');
  assert.match(step, /wish === true \? 'selfie' : wish === false \? 'declined' : 'ask'/, 'the face step no longer starts on the question');
  assert.match(step, /if \(step === 'declined'\) return null;/, 'a "No thanks" is shown something anyway');
  const from = step.indexOf('const question = (');
  const ask = from === -1 ? '' : step.slice(from, step.indexOf(');', from));
  assert.ok(ask.length > 0, 'the question block is gone — read day-of-face-enroll.tsx');
  assert.match(step, /\{step === 'ask' \? question : \(/, 'the card no longer shows the question first — the selfie shows unasked');
  assert.doesNotMatch(ask, /<SelfieCapture/, 'the question screen draws the selfie');
  assert.match(ask, /\{FACE_TAGGING_QUESTION\}/);
  assert.match(step, /void recordFaceTaggingWish\(yes\)/, 'the day-of answer is not stored — a No would be asked again');
  const camera = read('app/papic/guest/_components/papic-guest-capture.tsx');
  const mount = camera.slice(camera.indexOf('<DayOfFaceEnroll'), camera.indexOf('/>', camera.indexOf('<DayOfFaceEnroll')));
  assert.match(mount, /wish=\{faceTaggingWish\}/, 'the camera does not pass the answer to its face step');
  assert.match(mount, /onDecline=\{\(\) => \{\s*setPromptDismissed\(true\);/, 'after "No thanks" the in-camera prompt comes back');
});
