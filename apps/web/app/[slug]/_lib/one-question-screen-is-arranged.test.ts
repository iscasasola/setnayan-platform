/**
 * ONE QUESTION PER SCREEN IS ARRANGED BY THE RULES (owner 2026-09-29, on the
 * live RSVP page with "Ask one question at a time" on: *"ask one question per
 * screen is not neatly arranged. there are rules for like this, where the
 * progress bar should be, where the logo, and questions."*).
 *
 * What he saw: the couple's mark, then the whole invitation (eyebrow · names ·
 * date · guest · reply-by), THEN mid-card a row with "1 of 8" at one edge and
 * the dots at the other, then the question. The rules, as recorded
 * (`prototypes/rsvp_variants_2026-09-27.html` § SWITCH ON; DECISION_LOG
 * 2026-08-10 "one question each … the field label already IS the title"):
 *
 *   1 · PROGRESS IS ONE UNIT — the bar and its "2 of 8" together; Back beside
 *       it, not part of it; never the two halves of the count a row apart.
 *   2 · PROGRESS SITS UNDER THE MARK, ABOVE THE QUESTION — on the RSVP page it
 *       is DoorShell's `lead` (crest → progress → header → form); on the Event
 *       Hub's sheet it is the form's first child.
 *   3 · THE INVITATION'S FACTS ARE FIRST-SCREEN ONLY, folding to one line.
 *   4 · THE QUESTION IS THE HEADING; the primary action comes LAST.
 *   5 · SWITCH OFF IS UNTOUCHED.
 *
 * Rendered where it can be; the walker's DOM moves run only in a browser, so
 * the places it moves things to are read as source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { RSVP_CANVAS_GUEST } from '@/lib/simulated-guest-preview';

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
const WALKER = read('[slug]/_components/rsvp-one-at-a-time.tsx');
const REPLY = read('[slug]/invite/reply/page.tsx');

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

async function card(extra: Record<string, unknown>) {
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return html(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: { ...RSVP_CANVAS_GUEST },
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      offerSelfie: false,
      ...extra,
    } as never),
  );
}

/** The element whose opening tag carries `marker`, through its matching close. */
function element(markup: string, marker: string): string {
  const at = markup.indexOf(marker);
  assert.ok(at > -1, `${marker} is not drawn`);
  const open = markup.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(markup.slice(open))![1]!;
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = open;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return markup.slice(open, re.lastIndex);
  }
  throw new Error(`${marker}: unclosed <${tag}>`);
}

// ═══ 1 · progress is one unit ════════════════════════════════════════════

test('1 · the bar and its "2 of 8" are ONE unit, Back beside it — never split across the row', async () => {
  const { RsvpStepProgress } = await import('../_components/rsvp-one-at-a-time');
  const row = await html(React.createElement(RsvpStepProgress, { index: 1, total: 8, onBack: () => {} }));
  const unit = element(row, 'data-rsvp-progress-unit');
  assert.match(unit, /role="progressbar"/, 'the bar left the unit');
  assert.match(unit, /2<!-- --> of <!-- -->8|2 of 8/, 'the "2 of 8" left the unit — the owner saw it at one edge and the dots at the other');
  assert.equal((unit.match(/h-1 flex-1 rounded-full/g) ?? []).length, 8, 'one segment per question');
  assert.equal((unit.match(/rounded-full bg-ink"/g) ?? []).length, 2, 'the bar fills to the screen the guest is on');
  assert.doesNotMatch(unit, /Back/, 'Back is a control beside the progress, not part of it');
  assert.doesNotMatch(row, /justify-between/, 'a justify-between row pushes the count and the bar to opposite edges again');
  assert.match(row, /aria-label="Question 2 of 8"/);
});

test('1 · on the first screen Back keeps its place, invisible — nothing shifts when it appears', async () => {
  const { RsvpStepProgress } = await import('../_components/rsvp-one-at-a-time');
  const first = await html(React.createElement(RsvpStepProgress, { index: 0, total: 8, onBack: () => {} }));
  const back = element(first, '‹ Back');
  assert.match(back, /disabled=""/);
  assert.match(back, /disabled:invisible/, 'Back must hold its column (invisible), not vanish (a jump)');
  assert.doesNotMatch(back, /disabled:opacity-0|[" ]hidden[ "=]/);
});

// ═══ 2 · progress under the mark, above the question ═════════════════════

test('2 · the RSVP page: crest → progress → the invitation → the question, in that order', async () => {
  const { DoorShell } = await import('../../_components/door/door-shell');
  const { hubDoorSkin } = await import('../invite/_components/hub-door-skin');
  const page = await html(
    React.createElement(
      DoorShell,
      {
        eyebrow: 'You’re invited',
        title: 'Indalecio & Claire',
        meta: '18 December 2026',
        width: 'lg',
        skin: hubDoorSkin({ mark: null, monogram: 'IC' }),
        lead: React.createElement('div', { 'data-rsvp-progress-slot': '' }),
      },
      React.createElement('form', null, React.createElement('legend', null, 'Will you be there?')),
    ),
  );
  const at = ['data-door-mark', 'data-rsvp-progress-slot', 'data-door-header', 'You’re invited', 'Will you be there?'].map(
    (k) => page.indexOf(k),
  );
  assert.ok(at.every((i) => i > -1), `something is missing: ${at.join(',')}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `out of order (mark · progress · header · question): ${at.join(',')}`);
  // …and the page really hands the slot to DoorShell, inside the walker's scope.
  assert.match(REPLY, /lead=\{oneAtATime \? <div data-rsvp-progress-slot="" \/> : undefined\}/);
  assert.match(REPLY, /<RsvpScope on=\{oneAtATime\}>\s*<DoorShell/);
  assert.match(REPLY, /<div data-rsvp-scope="" className="contents">/);
});

test('2 · a door without a lead is byte-identical in order — the slot adds nothing when absent', async () => {
  const { DoorShell } = await import('../../_components/door/door-shell');
  const bare = await html(React.createElement(DoorShell, { title: 'A door' }));
  assert.doesNotMatch(bare, /data-rsvp/);
});

test('2 · the walker puts the progress IN that slot, and falls back to the top of the form', () => {
  assert.match(WALKER, /const scope = f\.closest<HTMLElement>\('\[data-rsvp-scope\]'\) \?\? f;/);
  assert.match(WALKER, /setLead\(scope\.querySelector<HTMLElement>\('\[data-rsvp-progress-slot\]'\)\)/);
  assert.match(WALKER, /\{lead \? \(progress \? createPortal\(progress, lead\) : null\) : progress\}/);
});

test('2 · on every reply form the walker mounts FIRST — above the flash, the card head and every question', async () => {
  const shapes: [string, Record<string, unknown>][] = [
    ['Event Hub sheet', { flash: { tone: 'error', text: 'FLASH' } }],
    ['RSVP page', { doorAction: async () => {}, termsOnSend: true, flash: { tone: 'error', text: 'FLASH' } }],
    [
      'only what is missing',
      { gate: { missing: ['meal', 'mobile'], coupleMarked: true }, guest: { ...RSVP_CANVAS_GUEST, rsvp_status: 'attending' }, flash: { tone: 'error', text: 'FLASH' } },
    ],
  ];
  for (const [name, extra] of shapes) {
    const out = await card({ oneAtATime: true, ...extra });
    const walker = out.indexOf('[data-one-at-a-time] [data-rsvp-away]');
    const firstAfterForm = out.indexOf('>', out.indexOf('<form')) + 1;
    assert.ok(walker > -1, `${name}: the walker is not mounted`);
    assert.ok(walker - firstAfterForm < 20, `${name}: something is drawn above the progress`);
    for (const later of ['FLASH', 'data-rsvp-step', '<header']) {
      const i = out.indexOf(later);
      if (i > -1) assert.ok(walker < i, `${name}: ${later} sits above the progress`);
    }
  }
});

// ═══ 3 · the invitation's facts are first-screen only ════════════════════

test('3 · the invitation folds after the first screen, to one line — on the page and on the card', async () => {
  // The rules exist, and only the walker's own attribute switches them on.
  assert.match(WALKER, /\[data-rsvp-past-first\] \[data-rsvp-context\],\[data-rsvp-past-first\] \[data-door-header\]\{display:none!important\}/);
  assert.match(WALKER, /\[data-rsvp-past-first\] \[data-rsvp-context-line\]\{display:block!important\}/);
  assert.match(WALKER, /scopeRef\.current\?\.toggleAttribute\('data-rsvp-past-first', clamped > 0\)/);
  // The page: whose reply this is, and the reply-by / saved line, are first-screen only…
  assert.match(REPLY, /\{firstScreenOnly\(\s*<div className="flex flex-wrap items-baseline justify-between gap-x-3">\s*<p className="font-serif text-lg text-ink" data-reply-for="">/);
  assert.match(REPLY, /\{firstScreenOnly\(hasAnswered \? \(/);
  // …and the one line that replaces them is hidden until the walker says so (no script = no line).
  assert.match(REPLY, /<p hidden data-rsvp-context-line=""/);
  // The Event Hub card's letterpress head is first-screen only.
  const out = await card({ oneAtATime: true, guest: { ...RSVP_CANVAS_GUEST, rsvp_status: 'attending' } });
  assert.match(out, /<header class="space-y-3" data-rsvp-context="">/);
  assert.match(out, /<div class="space-y-6" data-rsvp-context=""><p class="flex items-center gap-2.5/, 'the "your place is reserved" block repeats on every screen');
});

// ═══ 4 · the question is the heading; the primary action is last ═════════

test('4 · each screen\'s question is its heading', async () => {
  const out = await card({ oneAtATime: true, previewEveryQuestion: true, doorAction: async () => {}, termsOnSend: true, ask: {} });
  for (const q of ['Who are you bringing?', 'Meal preference', 'Dietary notes', 'A song to get you dancing (optional)', 'A note to the couple (optional)', 'How the couple can reach you']) {
    const at = out.indexOf(q);
    assert.ok(at > -1, `${q} is not drawn`);
    const tag = out.slice(out.lastIndexOf('<', at), at);
    assert.match(tag, /font-serif text-xl/, `"${q}" is a small label, not the screen's heading`);
  }
});

test('4 · the primary action is LAST: Next is appended after every question; the foot holds nothing after it', async () => {
  assert.match(WALKER, /f\.appendChild\(next\);/, 'the Next foot no longer follows the questions');
  const { RsvpStepNext } = await import('../_components/rsvp-one-at-a-time');
  const foot = await html(React.createElement(RsvpStepNext, { awaitingTap: false, onNext: () => {} }));
  assert.equal((foot.match(/<button/g) ?? []).length, 1, 'a second control in the foot — Back belongs with the progress');
  assert.match(foot, /class="button-primary[^"]*"[^>]*>Next<\/button>$/, 'the primary is not the last thing in the foot');
  // The answer screen: the tap is the answer (the approved drawing's "Tap one to continue").
  const tap = await html(React.createElement(RsvpStepNext, { awaitingTap: true, onNext: () => {} }));
  assert.doesNotMatch(tap, /<button/);
  assert.match(tap, /Tap one to continue/);
  // Pinned: sticky above the phone's home bar, one height for every question area.
  assert.match(WALKER, /\[data-rsvp-next-slot\]\{position:sticky;bottom:0;[^}]*padding-bottom:max\(\.75rem,env\(safe-area-inset-bottom\)\)\}/);
  assert.match(WALKER, /\[data-one-at-a-time\]:not\(\[data-rsvp-last\]\) \[data-rsvp-here\]\{min-height:/);
  // …and on the last screen the Send is the last control of the last step.
  const out = await card({ oneAtATime: true, doorAction: async () => {}, termsOnSend: true });
  const tail = out.slice(out.lastIndexOf('data-rsvp-step'));
  assert.ok(tail.lastIndexOf('type="submit"') > tail.lastIndexOf('<input'), 'a control sits after Send');
});

// ═══ 5 · switch off is untouched ═════════════════════════════════════════

test('5 · with the switch OFF nothing of this renders — the scrolling page is as it was', async () => {
  for (const extra of [{}, { doorAction: async () => {}, termsOnSend: true }, { guest: { ...RSVP_CANVAS_GUEST, rsvp_status: 'attending' } }]) {
    const out = await card({ oneAtATime: false, previewEveryQuestion: true, ask: {}, ...extra });
    assert.doesNotMatch(out, /data-rsvp-context|data-one-at-a-time|font-serif text-xl leading-snug/);
    assert.match(out, /<label for="meal_preference" class="block text-sm font-medium text-ink">/);
  }
  assert.match(REPLY, /oneAtATime && node \? <div data-rsvp-context="">\{node\}<\/div> : node/);
});
