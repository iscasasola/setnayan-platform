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
 *   6 · THE MARK PLAYS (owner, same thread: *"can we also animate this?"*) — a
 *       layered logo plays through the ONE player, behind the hero's own gate,
 *       from the crest OUTSIDE the form, so stepping never replays it.
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
  assert.match(unit, />2(?:<!-- -->)? of (?:<!-- -->)?8<\/p>/, 'the "2 of 8" left the unit — the owner saw it at one edge and the dots at the other');
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
  // The door that carries a lead says so — that is how the walker reaches the header it folds.
  assert.match(page, /<main[^>]*data-door-lead=""/);
  // …and the page really hands the slot to DoorShell.
  assert.match(REPLY, /lead=\{oneAtATime \? <div data-rsvp-progress-slot="" \/> : undefined\}/);
});

test('2 · a door without a lead is byte-identical in order — the slot adds nothing when absent', async () => {
  const { DoorShell } = await import('../../_components/door/door-shell');
  const bare = await html(React.createElement(DoorShell, { title: 'A door' }));
  assert.doesNotMatch(bare, /data-rsvp|data-door-lead/);
});

test('2 · the walker puts the progress IN that slot, and falls back to the top of the form', () => {
  assert.match(WALKER, /const scope = f\.closest<HTMLElement>\('\[data-rsvp-scope\],\[data-door-lead\]'\) \?\? f;/);
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
  assert.match(REPLY, /<FirstScreenOnly on=\{oneAtATime\}>\s*<div className="flex flex-wrap items-baseline justify-between gap-x-3">\s*<p className="font-serif text-lg text-ink" data-reply-for="">/);
  assert.match(REPLY, /\{hasAnswered \? \(\s*<FirstScreenOnly on=\{oneAtATime\}>\s*<DoorNotice>/);
  assert.match(REPLY, /<FirstScreenOnly on=\{oneAtATime\}>\s*<p className="text-sm text-ink\/70">Please reply by/);
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
  // A guest bringing plus-ones is asked for THEIR OWN meal and notes (each seat's
  // are small labels inside "Who are you bringing?", one screen — #6145).
  for (const q of ['Who are you bringing?', 'Your meal preference', 'Your dietary notes', 'A song to get you dancing (optional)', 'A note to the couple (optional)', 'How the couple can reach you']) {
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
  assert.match(REPLY, /return on \? <div data-rsvp-context="">\{children\}<\/div> : <>\{children\}<\/>;/);
});

// ═══ 6 · the couple's mark plays — once, through the one player ══════════

/** A layered logo as the Maker's Logo page saves it: one layer, draw on then drift. */
const LAYERED =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-logo="layers">' +
  '<g data-logo-layer="ic" data-in="draw" data-during="drift" data-delay="0"><g data-logo-body="100 100">' +
  '<path d="M10 10 L90 90" fill="#6b3e26"/></g></g></svg>';
const STILL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 L90 90"/></svg>';

test('6 · a layered logo PLAYS in the RSVP crest — the shipped player, above the form, never inside it', async () => {
  const { DoorShell } = await import('../../_components/door/door-shell');
  const { hubDoorSkin } = await import('../invite/_components/hub-door-skin');
  const door = (mark: string | null, animate: boolean) =>
    html(
      React.createElement(
        DoorShell,
        { title: 'Indalecio & Claire', width: 'lg', skin: hubDoorSkin({ mark, monogram: 'IC', animate }), lead: React.createElement('div', { 'data-rsvp-progress-slot': '' }) },
        React.createElement('form', null, React.createElement('legend', null, 'Will you be there?')),
      ),
    );
  const plays = await door(LAYERED, true);
  const player = plays.indexOf('data-layered-logo=""');
  assert.ok(player > -1, 'the RSVP crest does not mount the layered-logo player for a layered logo');
  assert.match(plays, /data-door-mark="logo"><span class="inline-flex" style="width:72px;height:72px" data-door-mark-plays=""><div aria-hidden="true" data-layered-logo=""/);
  assert.ok(player < plays.indexOf('data-rsvp-progress-slot') && player < plays.indexOf('<form'), 'the mark is inside the stepping area — every step would replay it');
  assert.doesNotMatch(plays, /data:image\/svg\+xml/, 'a still copy is drawn beside the playing one');
  // Not allowed, or nothing to play → today's still mark.
  for (const [name, out] of [['not owned / switched to still', await door(LAYERED, false)], ['not layered', await door(STILL, true)]] as const) {
    assert.doesNotMatch(out, /data-layered-logo/, `${name}: the player runs anyway`);
    assert.match(out, /data-door-mark="logo"[\s\S]*?<img[^>]*data:image\/svg\+xml/, `${name}: the still logo is gone`);
  }
  // The ONE player, not a new mechanism; reduced motion is its own still fallback.
  const SKIN = read('[slug]/invite/_components/hub-door-skin.tsx');
  assert.match(SKIN, /import \{ LayeredLogoPlayer \} from '@\/app\/_components\/layered-logo-player';/);
  assert.match(read('_components/layered-logo-player.tsx'), /prefers-reduced-motion: reduce/);
});

test('6 · the RSVP page plays the mark exactly when the Event Hub hero would', () => {
  assert.match(REPLY, /eventAnimatedMonogramActive\(admin, event\.event_id as string\)/);
  assert.match(REPLY, /const markPlays = animationOwned && !markAnimationSwitchedOff\(event\.monogram_studio_config\);/);
  assert.match(REPLY, /skin=\{hubDoorSkin\(\{ \.\.\.doorMarkFor\(event\), animate: markPlays \}\)\}/);
  assert.match(REPLY, /rsvp_ask_config, monogram_studio_config, /, 'the "Use Static Image" switch is not read — a still-chosen mark would play');
  // The hero's gate, for comparison: the same two questions.
  const LOADERS = read('[slug]/_lib/loaders.ts');
  assert.match(LOADERS, /ownsAnimatedMonogram && !markAnimationSwitchedOff\(event\.monogram_studio_config\)/);
});
