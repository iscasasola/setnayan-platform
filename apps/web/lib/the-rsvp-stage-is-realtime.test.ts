/**
 * 🗳 THE RSVP STAGE — owner 2026-09-30 (DECISION_LOG "THE MAKER RE-PLAN — SPEED
 * FIRST…", "RE-PLAN REVISIONS — RSVP STAGE PARTS…", "RSVP ANSWERS: THE COUPLE
 * RENAMES…"), and the relayed hard requirement: *"make sure what we rebuild is
 * fast and realtime and changes instantly."*
 *
 * Five properties, each sabotaged before commit:
 *
 *   A · the stage EXISTS — on the bar between Save the Date and the Invitation,
 *       with its three scenes, each on the real guest page for a SAMPLE guest;
 *   B · the couple's YES / NO words render on the guest RSVP — on the one
 *       scrolling page AND the one-question layout — while the values posted
 *       stay `attending` / `declined`;
 *   C · the stored words survive the one sanitizer the draft and the guest
 *       render share, and nothing else about an answer is stored;
 *   D · the decline screen reads ITS OWN words, never the thank-you's;
 *   E · no RSVP-stage edit path triggers a Maker refresh or a revalidate: every
 *       save on the stage is `held`, batched (`makerLatestWrite`), and the
 *       reply-by save asks its action to revalidate nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { readRsvpWords, rsvpAnswerWord, sanitizeRsvpAskConfig, RSVP_WORD_MAX } from '@/lib/rsvp-ask';
import { RSVP_STAGE_SCENES, rsvpPreviewMessages, rsvpStageCanvasSrc } from '@/lib/rsvp-stage';
import { thankYouWords } from '@/app/[slug]/_lib/thank-you-words';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';

/* ── A · THE STAGE EXISTS, WITH ITS THREE SCENES ───────────────────────────── */

test('A · the bar has the RSVP stage between Save the Date and the Invitation', async () => {
  // ✂ The Maker in 4 (2026-10-02): the stages are Page ▾'s groups, RSVP still between Save the Date and the Invitation.
  const { MAKER_PAGE_STAGES, makerPagePick } = await import(`../${L}/maker-bar`);
  const keys = MAKER_PAGE_STAGES as readonly string[];
  assert.deepEqual(keys.slice(0, 3), ['save_the_date', 'rsvp-stage', 'rsvp'], `Page ▾ reads ${keys.join(' · ')}`);
  assert.equal(makerPagePick('rsvp-stage')?.kind, 'rsvp', 'picking RSVP opens its own page');
});

test('A · three scenes — the form, after they submit, when they decline — each on the real guest page', () => {
  assert.deepEqual(
    RSVP_STAGE_SCENES.map((s) => [s.key, s.label]),
    [
      ['form', 'RSVP'],
      ['thanks', 'After they submit'],
      ['decline', 'When they decline'],
    ],
  );
  assert.equal(rsvpStageCanvasSrc('/ana-and-ben', 'form'), '/ana-and-ben/invite/reply?editor=1');
  assert.equal(rsvpStageCanvasSrc('/ana-and-ben', 'thanks'), '/ana-and-ben/invite/enter?editor=1&as=attending');
  assert.equal(rsvpStageCanvasSrc('/ana-and-ben', 'decline'), '/ana-and-ben/invite/enter?editor=1&as=declined');
  assert.equal(rsvpStageCanvasSrc(null, 'form'), null, 'no address, no canvas — said, never a blank frame');
});

test('A · the shell draws the stage for its bar item, and the launch page builds it lazily', () => {
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /selection\.key === 'rsvp-stage' \? \(\s*<div[^>]*data-maker-rsvp-layer/, 'the shell has no layer for the RSVP stage');
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(page, /rsvpStage=\{rsvpStage\}/, 'the launch page does not hand the stage to the shell');
  assert.match(page, /import \{[^}]*\bMakerRsvpStage\b[^}]*\} from '\.\/_components\/details-lazy'/, 'the stage must come through details-lazy');
  // Raw, not comment-stripped: the chunk's NAME is a comment (`webpackChunkName`).
  const lazy = readFileSync(join(ROOT, `${L}/details-lazy.tsx`), 'utf8');
  assert.match(lazy, /MakerRsvpStage = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/maker-rsvp-stage'\)/);
  const stage = read(`${L}/maker-rsvp-stage.tsx`);
  assert.match(stage, /<MakerRsvpSettings[\s\S]*?scene=\{scene\}/, 'the stage must draw the ONE settings component, by scene');
  // The sample guest: a VERIFIED host's `?editor=1`, never the param alone.
  for (const f of ['app/[slug]/invite/reply/page.tsx', 'app/[slug]/invite/enter/page.tsx']) {
    const src = read(f);
    assert.match(src, /asksForHostCanvas\(search\)[\s\S]{0,200}loadHostMembership\(/, `${f}: the canvas is not host-verified`);
    assert.match(src, /canvas \? <RsvpCanvasBridge|\{canvas && wordKeys \? \(/, `${f}: the canvas bridge is not mounted`);
  }
});

/* ── B · THE COUPLE'S WORDS ON THE GUEST RSVP ──────────────────────────────── */

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

async function renderReply(props: Record<string, unknown>) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../app/[slug]/_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: {
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
        plus_one_allowed: false,
        qr_token: 't',
        photo_source: null,
        photo_url: null,
      },
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      replyLocked: false,
      ask: {},
      ...props,
    } as never),
  );
}

/** The label that carries the radio of `value`, and its words. */
function answerLabel(html: string, value: string): string {
  const m = new RegExp(`<label[^>]*>(?:(?!</label>).)*?value="${value}"(?:(?!</label>).)*?</label>`, 's').exec(html);
  return m?.[0] ?? '';
}

for (const oneAtATime of [false, true]) {
  test(`B · the couple's YES / NO words render — ${oneAtATime ? 'one question at a time' : 'one scrolling page'} — and the values posted do not change`, async () => {
    const html = await renderReply({ oneAtATime, answerWords: { attending: 'Count me in', declined: 'Sadly can’t make it' } });
    const yes = answerLabel(html, 'attending');
    const no = answerLabel(html, 'declined');
    assert.match(yes, /Count me in/, 'the YES answer does not carry the couple’s words');
    assert.match(no, /Sadly can’t make it/, 'the NO answer does not carry the couple’s words');
    assert.doesNotMatch(html, /Joyfully accepts|Regretfully declines/, 'today’s words are still printed beside the couple’s');
    assert.match(yes, /name="rsvp_status" value="attending"/, 'the YES radio no longer posts `attending`');
    assert.match(no, /name="rsvp_status" value="declined"/, 'the NO radio no longer posts `declined`');
  });
}

test('B · nothing typed = today’s words, byte for byte (and a wake keeps its own)', async () => {
  const html = await renderReply({});
  assert.match(answerLabel(html, 'attending'), /Joyfully accepts/);
  assert.match(answerLabel(html, 'declined'), /Regretfully declines/);
  assert.equal(rsvpAnswerWord({}, 'attending', true), 'Will be there');
  assert.equal(rsvpAnswerWord({ attending: 'I’ll be there' }, 'attending', true), 'I’ll be there');
});

test('B · both guest RSVP render sites pass the couple’s words', () => {
  assert.match(read('app/[slug]/invite/reply/page.tsx'), /answerWords=\{readRsvpWords\(event\.rsvp_ask_config\)\}/);
  assert.match(read('app/[slug]/_components/site-body.tsx'), /answerWords=\{readRsvpWords\(event\.rsvp_ask_config\)\}/);
});

test('B · on the Maker canvas every question is drawn, a switched-off one hidden and marked (so a switch shows on the tap)', async () => {
  const canvas = await renderReply({ previewEveryQuestion: true, ask: { meal: false }, oneAtATime: false });
  assert.match(canvas, /<div data-rsvp-step="true" data-rsvp-ask="meal" hidden="">/, 'an off question is not drawn hidden on the canvas');
  assert.match(canvas, /data-rsvp-ask="dietary"(?![^>]*hidden)/, 'an on question is hidden on the canvas');
  const guest = await renderReply({ ask: { meal: false } });
  assert.doesNotMatch(guest, /data-rsvp-ask|id="meal_preference"/, 'a guest’s page draws an off question, or the canvas marks');
});

/* ── C · STORED: WORDS ONLY ────────────────────────────────────────────────── */

test('C · the words survive the shared sanitizer; junk, blanks and unknown keys do not', () => {
  const clean = sanitizeRsvpAskConfig({
    meal: false,
    words: {
      attending: '  Count   me in ',
      declined: '',
      thanksHeading: 'See you there!',
      bogus: 'x',
      declineMessage: 42,
      declineHeading: 'x'.repeat(500),
    },
  });
  assert.deepEqual(clean, {
    meal: false,
    words: { attending: 'Count me in', thanksHeading: 'See you there!', declineHeading: 'x'.repeat(RSVP_WORD_MAX.declineHeading) },
  });
  assert.deepEqual(sanitizeRsvpAskConfig({ words: { declined: '   ' } }), {}, 'an all-blank words object is dropped');
  assert.deepEqual(readRsvpWords(null), {});
  // The draft stores the column through the SAME sanitizer.
  assert.match(read('lib/hub-draft.ts'), /case 'rsvp_ask_config':\s*return isPlainObject\(raw\) \? sanitizeRsvpAskConfig\(raw\) : undefined;/);
});

/* ── D · THE DECLINE SCREEN READS ITS OWN WORDS ────────────────────────────── */

test('D · a declining guest reads “When they decline”, never the thank-you’s words', () => {
  const words = {
    thanksHeading: 'See you there!',
    thanksMessage: 'Keep your ticket handy.',
    declineHeading: 'You’ll be missed',
    declineMessage: 'Thank you for telling us.',
  };
  assert.deepEqual(thankYouWords({ status: 'declined', words, ownHeadline: 'Thank you, Ana — you\'ll be missed' }), {
    heading: 'You’ll be missed',
    message: 'Thank you for telling us.',
    keys: { heading: 'declineHeading', message: 'declineMessage' },
  });
  assert.deepEqual(thankYouWords({ status: 'attending', words, ownHeadline: 'See you on the 18th, Ana!' }).heading, 'See you there!');
  // Unset: today's headline and no message — for each screen, separately.
  const onlyThanks = { thanksHeading: 'See you there!' };
  assert.deepEqual(thankYouWords({ status: 'declined', words: onlyThanks, ownHeadline: 'Thank you, Ana' }), {
    heading: 'Thank you, Ana',
    message: null,
    keys: { heading: 'declineHeading', message: 'declineMessage' },
  });
  assert.equal(thankYouWords({ status: 'maybe', words, ownHeadline: 'Thank you' }).keys, null);
  assert.match(read('app/[slug]/invite/enter/page.tsx'), /thankYouWords\(\{ status, words: rsvpWords, ownHeadline, name: firstName \}\)/);
  // `{name}` fills each guest's name (the approved prototype, "After they submit").
  assert.equal(thankYouWords({ status: 'declined', words: { declineHeading: 'We’ll miss you, {name}.' }, ownHeadline: 'x', name: 'Maria' }).heading, 'We’ll miss you, Maria.');
  assert.equal(thankYouWords({ status: 'attending', words: { thanksHeading: 'See you, {name}!' }, ownHeadline: 'x', name: null }).heading, 'See you!');
});

test('D · the canvas preview speaks each screen’s own word keys', () => {
  const msgs = rsvpPreviewMessages({ words: { declineHeading: 'Missed!' }, meal: false, oneAtATime: true }, false);
  const words = Object.fromEntries(msgs.filter((m) => m.t === 'words').map((m) => [(m as { key: string }).key, (m as { text: string }).text]));
  assert.equal(words['rsvp:declineHeading'], 'Missed!');
  assert.equal(words['rsvp:thanksHeading'], '', 'an unset heading goes back to the page’s own');
  assert.equal(words['rsvp:attending'], 'Joyfully accepts', 'an unset answer is today’s words');
  const ask = msgs.find((m) => m.t === 'rsvpAsk') as { ask: Record<string, boolean>; oneAtATime: boolean };
  assert.equal(ask.ask.meal, false);
  assert.equal(ask.oneAtATime, true);
});

/* ── E · NO RSVP-STAGE EDIT REFRESHES OR REVALIDATES THE MAKER ─────────────── */

/** The stage branch of the settings panel — from `if (stage) {` in `save` to its `return;`. */
function stageSaveBranch(src: string): string {
  const at = src.indexOf('if (stage) {');
  assert.ok(at > 0, 'the settings panel has no stage save branch');
  return src.slice(at, src.indexOf('start(async () => {', at));
}

test('E · every save the RSVP stage makes is held, batched, and asks for the bar — never a refresh', () => {
  const panel = read(`${L}/maker-rsvp-ask.tsx`);
  const branch = stageSaveBranch(panel);
  assert.match(branch, /announceRsvpPreview\(next\);[\s\S]*makerSave\(/, 'the canvas must be told BEFORE the save goes');
  assert.match(branch, /makerLatestWrite\(canvasWriteKey\(RSVP_DRAFT_TYPE\)/, 'the stage save is not batched');
  assert.match(branch, /\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true \}/, 'the stage save is not held');
  assert.match(branch, /fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\)/, 'the Apply count must come back with the save');
  const liveAt = panel.indexOf('function LiveReplyByField(');
  const live = panel.slice(liveAt, panel.indexOf('\nfunction ', liveAt + 1) > 0 ? panel.indexOf('\nfunction ', liveAt + 1) : undefined);
  assert.ok(live.length > 100, 'the stage reply-by field is gone');
  assert.match(live, /makerLatestWrite\(/, 'the reply-by save is not batched');
  assert.match(live, /\{ held: true,/, 'the reply-by save is not held');
  assert.match(live, /fd\.set\('maker_quiet', '1'\)/, 'the reply-by save lets its action revalidate');
  for (const f of [`${L}/maker-rsvp-stage.tsx`]) {
    const src = read(f);
    assert.doesNotMatch(src, /router\.refresh|useRouter|revalidatePath|requestMakerRefresh|location\.reload/, `${f} refreshes the Maker`);
  }
  for (const part of [branch, live]) {
    assert.doesNotMatch(part, /router\.refresh|revalidatePath|location\.reload/, 'a stage edit path refreshes the Maker');
  }
});

test('E · a quiet reply-by save revalidates nothing; a plain one still does', () => {
  const actions = read('app/dashboard/[eventId]/actions.ts');
  const body = actions.slice(actions.indexOf('export async function updatePaxSettings('), actions.indexOf('type PreviewConflictsResult'));
  assert.match(
    body,
    /if \(formData\.get\('maker_quiet'\) !== '1'\) \{\s*revalidatePath\([^)]*\);\s*revalidatePath\([^)]*\);\s*\}\s*return \{ ok: true \};/,
    'updatePaxSettings revalidates outside the quiet guard',
  );
});

test('E · the canvas never reloads for an edit — the frames are kept, and edits are posted into them', () => {
  const stage = read(`${L}/maker-rsvp-stage.tsx`);
  assert.match(stage, /window\.addEventListener\(RSVP_PREVIEW_EVENT/, 'the stage does not listen for the panel’s changes');
  assert.match(stage, /win\.postMessage\(m, origin\)/, 'the stage does not post the change into the frame');
  // A frame's `src` depends on the address and the scene only — never on a stamp or the config.
  assert.match(stage, /src=\{\(frameSrc \? frameSrc\(s\.key\) : rsvpStageCanvasSrc\(publicLandingUrl, s\.key\)\) \?\? undefined\}/);
  assert.doesNotMatch(stage, /key=\{`?[^}]*(stamp|renderStamp|Date\.now)/, 'a frame is keyed on something that moves on every save');
});
