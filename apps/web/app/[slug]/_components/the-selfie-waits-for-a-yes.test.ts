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
 *   2 · ⚖ AMENDED 2026-09-30 ("THE TAGGING QUESTION IS ASKED AT RSVP; THE
 *       SELFIE IS TAKEN ON THE DAY"): NO reply card draws the selfie — not
 *       the invitation's, not the Event Hub's. The question is asked only
 *       where face tagging is on offer (Papic active and open, mode_a);
 *   3 · `submitRsvp` stores the answer and takes no face — every selfie field
 *       is stripped before the form is read;
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

// ═══ 1 · one plain question first ══════════════════════════════════════════

const ASK = { askTagging: true };

test('1 · the card asks "Want to be tagged in the photos?" with two choices, none pre-set', async () => {
  const html = await card(ASK);
  assert.ok(html.includes(FACE_TAGGING_QUESTION), 'the question is not on the card');
  assert.ok(html.includes('Yes, tag me') && html.includes('No thanks'), 'the two choices are not worded as the owner asked');
  for (const v of ['yes', 'no'] as const) {
    assert.doesNotMatch(answerInput(html, v), /checked/, `"${v}" arrives pre-ticked for a guest who never answered`);
  }
});

test('1 · a stored answer is shown back, and only that one', async () => {
  const yes = await card(ASK, { face_tagging_wanted: true });
  assert.match(answerInput(yes, 'yes'), /checked/, 'a guest who said yes sees no answer');
  assert.doesNotMatch(answerInput(yes, 'no'), /checked/);
  const no = await card(ASK, { face_tagging_wanted: false });
  assert.match(answerInput(no, 'no'), /checked/, 'a guest who said no sees no answer');
  assert.doesNotMatch(answerInput(no, 'yes'), /checked/);
});

// ═══ 2 · the question only — the selfie is taken on the day ════════════════

test('2 · 📵 NO REPLY CARD DRAWS A CAMERA (owner 2026-09-30) — open, locked, or with a Yes already stored', async () => {
  for (const [label, props, over] of [
    ['open card', ASK, {}],
    ['locked card', { ...ASK, replyLocked: true }, {}],
    ['a stored Yes', ASK, { face_tagging_wanted: true }],
  ] as const) {
    const html = await card(props, over);
    assert.ok(html.includes(FACE_TAGGING_QUESTION), `${label}: the question is gone`);
    assert.doesNotMatch(html, /name="biometric_consent"|name="age_affirmation"|name="selfie_/, `${label}: a reply card draws the selfie again`);
    assert.doesNotMatch(html, /tag-yes-reveal/, `${label}: a hidden selfie step rides along`);
    assert.match(html, /Yes means one quick selfie on the day/, `${label}: the line under the question no longer says the selfie is on the day`);
  }
  assert.doesNotMatch(read('app/[slug]/_components/rsvp-widget.tsx'), /<SelfieCapture|offerSelfie\s*=/, 'the reply card can draw a camera again');
});

test('2 · not askable (no Papic, Papic closed, mode_b, or the couple declined) → no question at all', async () => {
  const html = await card({ askTagging: false });
  assert.ok(!html.includes(FACE_TAGGING_QUESTION), 'the question is asked where face tagging is not on offer');
  assert.doesNotMatch(html, /name="face_tagging"/);
});

test('2 · 🏷 THE INVITATION ASKS, THE DAY TAKES THE SELFIE: the save strips every face field a crafted post carries', async () => {
  const { stripInviteFaceFields } = await import('@/lib/face-tagging-wish');
  const fd = new FormData();
  for (const [k, v] of [['face_tagging', 'yes'], ['delete_selfie', '1'], ['selfie_ref', 'r2://x'], ['selfie_refs', 'a,b'], ['selfie_vector', '[1]'], ['selfie_anything', 'x'], ['biometric_consent', '1'], ['age_affirmation', '1'], ['rsvp_status', 'attending']] as [string, string][]) fd.set(k, v);
  stripInviteFaceFields(fd);
  assert.deepEqual([...fd.keys()].sort(), ['delete_selfie', 'face_tagging', 'rsvp_status'], 'a face field survives the invitation’s save');
  const door = read('app/[slug]/invite/actions.ts');
  const strip = door.indexOf('stripInviteFaceFields(formData);');
  assert.ok(strip > -1 && strip < door.indexOf('return submitRsvp(eventId, guestId, formData);'), 'the invitation’s save no longer strips face fields before submitRsvp');
  assert.match(read('app/[slug]/invite/reply/page.tsx'), /askTagging=\{faceTagging\.askable\}/);
});

test('2 · both reply cards ask only where face tagging is on offer — one gate, lib/face-tagging-gate.ts', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /askTagging=\{faceTaggingAskable\}/, 'the Event Hub card no longer honours the gate');
  const gate = read('lib/face-tagging-gate.ts');
  assert.match(gate, /askable: faceTaggingAskable\(\{ papicActive, mode, papicClosed \}\)/, 'the ask no longer needs Papic active, face tagging on and Papic open');
});

// ═══ 3 · No asks nothing more — and nothing rides along ════════════════════

test('3 · submitRsvp stores the answer and takes no selfie at all', () => {
  const src = read('app/[slug]/actions.ts');
  // `let` since 2026-09-29: an unconfirmed "No" after a selfie changes nothing (no-thanks-deletes-the-selfie.test.ts).
  assert.match(src, /(?:const|let) taggingWish = parseFaceTaggingAnswer\(formData\.get\(FACE_TAGGING_FIELD\)\)/, 'the answer is not read');
  assert.match(src, /\.update\(\{ face_tagging_wanted: taggingWish \}\)/, 'the answer is not stored — the day-of catch cannot honour it');
  const top = src.indexOf('export async function submitRsvp(');
  const strip = src.indexOf('stripInviteFaceFields(formData);', top);
  const wish = src.indexOf('parseFaceTaggingAnswer(formData.get(FACE_TAGGING_FIELD))', top);
  assert.ok(strip > top && strip < wish, 'submitRsvp reads the form before stripping the face fields');
  assert.doesNotMatch(src, /from\('guest_face_enrollments'\)\s*\.insert\(/, 'submitRsvp enrols a face again (it did so weeks before the day)');
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
