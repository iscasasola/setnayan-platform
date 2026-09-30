/**
 * A GUEST ANSWERS YES OR NO — owner, verbatim, 2026-09-30: *"for now. let us
 * fix the RSVP remove the maybe"* (spec corpus DECISION_LOG 2026-09-30 "RSVP
 * ANSWERS … THE MIDDLE ANSWER IS OPTIONAL" — the couple gets a switch later;
 * until then the middle answer is simply not offered).
 *
 *   1 · the RSVP card draws exactly two answers — scroll layout AND
 *       one-question-per-screen, celebratory AND solemn wording;
 *   2 · a guest ALREADY saved as 'maybe' still loads: two answers, nothing
 *       preselected, and the answer is required so Save cannot post it empty;
 *   3 · the ask-to-join form offers two answers and refuses a posted 'maybe';
 *   4 · `submitRsvp` refuses a NEW 'maybe' before anything is written, and both
 *       pages the refusal lands on turn `?rsvp=choose` into a sentence.
 *
 * The couple's own Guest list tools are deliberately NOT covered: they still
 * see and set 'maybe' — it is their bookkeeping.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { REQUEST_ANSWERS, readRequestAnswers } from '@/lib/guest-requests';

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
    rsvp_status: 'pending',
    meal_preference: null,
    dietary_restrictions: null,
    guest_note: null,
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

/** Every attendance radio on the card, as its opening tag. */
const answers = (html: string) =>
  (html.match(/<input[^>]*name="rsvp_status"[^>]*>/g) ?? []).filter((t) => /type="radio"/.test(t));
const valueOf = (tag: string) => tag.match(/value="([^"]*)"/)?.[1];

// ═══ 1 · THE CARD ═════════════════════════════════════════════════════════

/* 🎨 The RSVP scene's styles (reply card · question · ticket) are ONE answer
   list drawn three ways — so the two-answer rule is held in every style. */
const RSVP_STYLES = [null, 'question', 'ticket'] as const;

for (const sceneStyle of RSVP_STYLES) {
  for (const oneAtATime of [false, true]) {
    for (const solemn of [false, true]) {
      const layout = `${sceneStyle ?? 'reply-card'} · ${oneAtATime ? 'one-question-per-screen' : 'scroll'} · ${solemn ? 'solemn' : 'celebratory'}`;
      test(`1 · the RSVP card offers exactly two answers — ${layout}`, async () => {
        const html = await renderCard({ oneAtATime, sceneStyle, words: { ...WORDS, solemn } });
        const radios = answers(html);
        assert.deepEqual(radios.map(valueOf), ['attending', 'declined'], `answers drawn: ${radios.join(' ')}`);
        assert.doesNotMatch(html, /Undecided/, 'the middle answer is still worded on the card');
        if (!solemn) {
          assert.match(html, /Joyfully accepts/);
          assert.match(html, /Regretfully declines/);
        }
      });
    }
  }

  test(`1 · the couple's own YES / NO words show in the ${sceneStyle ?? 'reply-card'} style`, async () => {
    const html = await renderCard({ sceneStyle, answerWords: { attending: 'Count me in', declined: 'Sadly not' } });
    assert.match(html, /Count me in/);
    assert.match(html, /Sadly not/);
    assert.doesNotMatch(html, /Joyfully accepts/, 'the usual word still shows beside the couple’s own');
    assert.deepEqual(answers(html).map(valueOf), ['attending', 'declined'], 'renaming an answer changed what it posts');
  });
}

// ═══ 2 · A GUEST ALREADY SAVED AS MAYBE ═══════════════════════════════════

for (const sceneStyle of RSVP_STYLES) {
  for (const oneAtATime of [false, true]) {
    test(`2 · an existing 'maybe' row still loads — two answers, none preselected, answer required (${sceneStyle ?? 'reply-card'} · ${oneAtATime ? 'one-at-a-time' : 'scroll'})`, async () => {
      const html = await renderCard({ oneAtATime, sceneStyle }, { rsvp_status: 'maybe' });
      const radios = answers(html);
      assert.deepEqual(radios.map(valueOf), ['attending', 'declined']);
      for (const r of radios) {
        assert.doesNotMatch(r, /checked/, `a 'maybe' guest had an answer preselected: ${r}`);
        assert.match(r, /required/, `a 'maybe' guest could Save with no answer and be dropped: ${r}`);
      }
    });
  }
}

test('2 · a guest who already answered yes still sees it preselected (the required rule is maybe-only)', async () => {
  const html = await renderCard({}, { rsvp_status: 'attending' });
  const yes = answers(html).find((t) => valueOf(t) === 'attending') ?? '';
  assert.match(yes, /checked/);
  assert.doesNotMatch(yes, /required/);
});

// ═══ 3 · THE ASK-TO-JOIN FORM ═════════════════════════════════════════════

test('3 · the ask-to-join form offers exactly two answers', async () => {
  assert.deepEqual(REQUEST_ANSWERS.map((a) => a.value), ['attending', 'declined']);
  assert.deepEqual(REQUEST_ANSWERS.map((a) => a.label), ['Joyfully accepts', 'Regretfully declines']);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RequestForm } = await import('../../join/[eventId]/_components/request-form');
  const html = renderToStaticMarkup(
    React.createElement(RequestForm as never, { action: async () => {}, ask: {}, organizer: 'the couple' } as never),
  );
  assert.deepEqual(answers(html).map(valueOf), ['attending', 'declined']);
});

test("3 · the ask-to-join form refuses a posted 'maybe'", () => {
  const fd = new Map<string, string>([
    ['name', 'Carla Dizon'],
    ['rsvp_status', 'maybe'],
    ['contact_email', 'carla@example.com'],
    ['terms', 'on'],
  ]);
  const r = readRequestAnswers({ get: (k) => fd.get(k) ?? null }, {});
  assert.deepEqual(r, { ok: false, error: 'missing_answer' });
});

// ═══ 4 · THE SERVER ACTION ════════════════════════════════════════════════

test("4 · submitRsvp refuses a NEW 'maybe' before it writes anything, and keeps an unchanged one", () => {
  const src = read('[slug]/actions.ts');
  const body = src.slice(src.indexOf('export async function submitRsvp'));
  const refusal = body.search(
    /if \(!replyLocked && status === 'maybe' && before\?\.rsvp_status !== 'maybe'\) \{\s*if \(toInvite && evRsvp\?\.slug\) redirect\(`\$\{inviteReplyPath\(evRsvp\.slug\)\}\?rsvp=choose`\);\s*redirect\(evRsvp\?\.slug \? `\/\$\{evRsvp\.slug\}\?rsvp=choose` : '\/'\);/,
  );
  assert.ok(refusal > 0, "submitRsvp no longer refuses a guest's new 'maybe' with ?rsvp=choose");
  const firstWrite = body.search(/\.from\('guests'\)\s*\.update\(/);
  assert.ok(firstWrite > 0, 'could not find the guest write');
  assert.ok(refusal < firstWrite, "the 'maybe' refusal runs after the guest row is written");
});

test('4 · both pages the refusal lands on say why (no silent bounce)', () => {
  for (const rel of ['[slug]/page.tsx', '[slug]/invite/reply/page.tsx']) {
    const src = read(rel);
    assert.match(
      src,
      /search\.rsvp === 'choose'\s*\?\s*\{\s*tone: 'error' as const,\s*text: 'Please choose whether you will be there/,
      `${rel} does not render ?rsvp=choose`,
    );
  }
});
