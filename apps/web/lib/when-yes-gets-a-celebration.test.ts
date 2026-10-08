/**
 * apps/web/lib/when-yes-gets-a-celebration.test.ts
 *
 * 🎉 "WHEN YES" GETS A CELEBRATION (PRO) — owner 2026-10-06, DECISION_LOG row of
 * that name; prototype `prototypes/when_yes_celebration_2026-10-06_fable.html`.
 *
 *   1 · THE STORE — the pick lives in `events.rsvp_ask_config.celebration`,
 *       beside the When yes words; absent / junk reads as None.
 *   2 · PICK → DRAFT → APPLY — a free couple may try every effect; Apply names
 *       it and HOLDS it without Event Hub Pro, while the words drafted beside it
 *       still go live; with Pro it goes live; back to None is always free.
 *   3 · THE GUEST — plays ONCE: only after a fresh yes (`?rsvp=ok`), the flag
 *       is taken off the address once it has ended (the reply funnel reads it
 *       first) so a reload never replays it; None draws
 *       nothing; the engine ends and CLEARS on its own clock, and its watchdog
 *       ends it even when frames stop.
 *   4 · THE MAKER — ONE PickMenu (never a pill row), drafted through the
 *       panel's one-object save; guest copy never says "celebration".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { readRsvpCelebration, sanitizeRsvpAskConfig } from './rsvp-ask';
import {
  RSVP_CELEBRATION_ORDER,
  celebrationCanvasShown,
  celebrationColours,
  celebrationDraftIsPro,
  withoutJustReplied,
} from './rsvp-celebration';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, summarizeHubDraft, type HubLiveState } from './hub-draft';
import { hubDraftChangeLines } from './hub-draft-change-lines';
import { hubDraftProEffects } from './hub-pro-effects';
import { CelebrationPlayer } from './celebration-engine';
import { WhenYesCelebration } from '../app/[slug]/_components/when-yes-celebration';

// The components' JSX is compiled to `React.createElement` here (as in the other render tests).
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const live = (config: unknown): HubLiveState => ({ events: { rsvp_ask_config: config }, widgets: [] });
const draftOf = (config: unknown) => mergeHubDraft(emptyHubDraft(), { events: { rsvp_ask_config: config } });

/* ── 1 · the store ─────────────────────────────────────────────────────── */

test('the pick is stored beside the When yes words; absent and junk read as None', () => {
  assert.equal(readRsvpCelebration(null), 'none');
  assert.equal(readRsvpCelebration({}), 'none');
  assert.equal(readRsvpCelebration({ celebration: 'lasers' }), 'none');
  assert.equal(readRsvpCelebration({ celebration: 42 }), 'none');
  for (const kind of RSVP_CELEBRATION_ORDER) assert.equal(readRsvpCelebration({ celebration: kind }), kind);
  const kept = sanitizeRsvpAskConfig({ words: { thanksHeading: 'See you, {name}' }, celebration: 'petals', meal: false });
  assert.deepEqual(kept, { words: { thanksHeading: 'See you, {name}' }, celebration: 'petals', meal: false });
  assert.equal('celebration' in sanitizeRsvpAskConfig({ celebration: 'lasers' }), false, 'junk is dropped, never repaired');
});

test('the effect wears the Mood Board, topped up from the house only when the board is bare', () => {
  assert.deepEqual(celebrationColours(['#5B1A22', '#6B7A3A', '#E0A52B', '#8E2E3C', '#F2C8C2', '#000000']), [
    '#5b1a22',
    '#6b7a3a',
    '#e0a52b',
    '#8e2e3c',
    '#f2c8c2',
  ]);
  assert.equal(celebrationColours([]).length, 5);
  assert.equal(celebrationColours(['#123456'])[0], '#123456');
});

/* ── 2 · pick → draft → Apply ──────────────────────────────────────────── */

test('an effect is Pro to add or change; None, and keeping what is live, never is', () => {
  for (const kind of ['confetti', 'fireworks', 'petals', 'sparklers']) {
    assert.equal(celebrationDraftIsPro({}, { celebration: kind }), true, `${kind} is Pro`);
  }
  assert.equal(celebrationDraftIsPro({}, {}), false);
  assert.equal(celebrationDraftIsPro({}, { celebration: 'none' }), false);
  assert.equal(celebrationDraftIsPro({ celebration: 'confetti' }, {}), false, 'back to None is free');
  assert.equal(celebrationDraftIsPro({ celebration: 'confetti' }, { celebration: 'confetti', meal: false }), false);
  assert.equal(celebrationDraftIsPro({ celebration: 'confetti' }, { celebration: 'petals' }), true);
});

test('a free couple: the drafted effect is HELD at Apply, named, and counted once', () => {
  const plan = planHubDraftApply(draftOf({ celebration: 'confetti' }), live(null), false);
  assert.equal(plan.apply.length, 0, 'nothing else moved, so nothing is written');
  assert.equal(plan.refused.length, 1);
  assert.deepEqual(plan.remaining.events.rsvp_ask_config, { celebration: 'confetti' }, 'it stays in the draft for after Pro');
  const sum = summarizeHubDraft(draftOf({ celebration: 'confetti' }), live(null), false);
  assert.equal(sum.changeCount, 1);
  assert.equal(sum.proCount, 1, 'the Apply ◆');
  const lines = hubDraftChangeLines(draftOf({ celebration: 'confetti' }), live(null), false);
  assert.deepEqual(lines, [{ place: 'RSVP', what: 'When they say yes · Confetti', pro: true, held: true }]);
  const effects = hubDraftProEffects(draftOf({ celebration: 'confetti' }), live(null), false);
  assert.equal(effects.length, 1);
  assert.equal(effects[0]!.what, 'When they say yes · Confetti');
});

test('a free couple: the words drafted BESIDE a held effect still go live — without the effect', () => {
  const drafted = { words: { thanksHeading: 'See you there, {name}' }, celebration: 'sparklers' };
  const plan = planHubDraftApply(draftOf(drafted), live({ meal: false }), false);
  const written = plan.apply.filter((i) => i.kind === 'event' && i.column === 'rsvp_ask_config');
  assert.equal(written.length, 1, 'the free part is written');
  assert.deepEqual(written[0]!.value, { words: { thanksHeading: 'See you there, {name}' } });
  assert.equal(written[0]!.pro, false);
  assert.equal(plan.refused.length, 1);
  assert.deepEqual(plan.remaining.events.rsvp_ask_config, drafted, 'the whole drafted config is kept');
  const lines = hubDraftChangeLines(draftOf(drafted), live({ meal: false }), false);
  assert.equal(lines.length, 1, 'one change, not two — the free part is its twin');
  assert.equal(lines[0]!.what, 'What you ask your guests, When they say yes · Sparklers');
  assert.equal(lines[0]!.held, true);
  // "Remove" on the Pro sheet takes the effect off and KEEPS the words.
  const effect = hubDraftProEffects(draftOf(drafted), live({ meal: false }), false)[0]!;
  assert.deepEqual(effect.remove, { events: { rsvp_ask_config: { words: { thanksHeading: 'See you there, {name}' } } } });
});

test('with Event Hub Pro the effect goes live whole; back to None is free for anyone', () => {
  const owned = planHubDraftApply(draftOf({ celebration: 'fireworks' }), live(null), true);
  assert.equal(owned.refused.length, 0);
  assert.deepEqual(owned.apply.map((i) => i.value), [{ celebration: 'fireworks' }]);
  const back = planHubDraftApply(draftOf({}), live({ celebration: 'fireworks' }), false);
  assert.equal(back.refused.length, 0, 'taking an effect off is never held');
  assert.equal(back.apply.length, 1);
});

/* ── 3 · the guest ─────────────────────────────────────────────────────── */

test('plays only after a fresh yes, and the flag leaves the address so a reload never replays it', () => {
  assert.equal(withoutJustReplied('https://x.test/maria-and-jose/invite/enter?rsvp=ok'), '/maria-and-jose/invite/enter');
  assert.equal(withoutJustReplied('https://x.test/m/invite/enter?k=abc&rsvp=ok#t'), '/m/invite/enter?k=abc#t');
  assert.equal(withoutJustReplied('https://x.test/m/invite/enter'), null, 'a reload has nothing to forget');
  assert.equal(withoutJustReplied('https://x.test/m/invite/enter?rsvp=details'), null, 'a notice the page reads is kept');

  const page = code('app/[slug]/invite/enter/page.tsx');
  const mount = /<WhenYesCelebration[\s\S]*?\/>/.exec(page)?.[0] ?? '';
  assert.ok(mount, 'the thank-you mounts the celebration');
  assert.match(page, /reply === 'yes' \? \(\s*<WhenYesCelebration/, 'only a guest who said yes');
  assert.match(mount, /play=\{!canvas && search\.rsvp === JUST_REPLIED_VALUE\}/, 'only right after the reply, never on the Maker canvas');
  assert.match(mount, /listen=\{canvas\}/);

  const comp = code('app/[slug]/_components/when-yes-celebration.tsx');
  assert.match(
    comp,
    /if \(play && kind !== 'none'\) \{[\s\S]{0,160}?void start\(kind\)\.finally\(\(\) => \{\s*if \(alive\) forgetJustReplied\(\);/,
    'the flag is forgotten once the effect has ended — after the reply funnel has read it',
  );
  assert.match(comp, /e\.source !== window\.parent/, 'only the framing Maker may ask it to play');
  assert.match(comp, /createPortal\(/, 'portalled to <body>');
  assert.match(comp, /pointer-events-none fixed inset-0/, 'one full-screen canvas, never a tap target');
  assert.match(comp, /prefers-reduced-motion: reduce/);
  assert.match(comp, /import\([^)]*'@\/lib\/celebration-engine'\)/, 'the engine is fetched only when there is something to play');
  assert.doesNotMatch(comp, /^import (?!type)[^\n]*celebration-engine/m, 'never a static import of the engine');
});

test('None draws nothing — no canvas, no engine; a pick after a yes draws one canvas', () => {
  assert.equal(celebrationCanvasShown({ kind: 'none', play: true, listen: false }), false);
  assert.equal(celebrationCanvasShown({ kind: 'confetti', play: false, listen: false }), false, 'a reload (no fresh yes) draws nothing');
  assert.equal(celebrationCanvasShown({ kind: 'confetti', play: true, listen: false }), true);
  assert.equal(celebrationCanvasShown({ kind: 'none', play: false, listen: true }), true, 'the Maker sample waits to be told');
  // The server render of every case is empty — the canvas is portalled after mount, so nothing flashes.
  for (const props of [
    { kind: 'none' as const, colours: [], play: true },
    { kind: 'confetti' as const, colours: [], play: true },
  ]) {
    const html = renderToStaticMarkup(React.createElement(WhenYesCelebration, props));
    assert.equal(html, '');
  }
  const comp = code('app/[slug]/_components/when-yes-celebration.tsx');
  assert.match(comp, /const shown = celebrationCanvasShown\(\{ kind, play, listen \}\);/);
  assert.match(comp, /if \(!shown \|\| !mounted\) return null;/);
  // Guest-facing words: the canvas is the ONLY thing it draws — aria-hidden, no text at all.
  const jsx = /createPortal\(([\s\S]*?)document\.body/.exec(comp)?.[1] ?? '';
  assert.match(jsx, /<canvas[\s\S]*aria-hidden="true"[\s\S]*\/>/);
  assert.doesNotMatch(jsx.replace(/data-when-yes-fx=\{kind\}/, ''), /celebrat|website/i, 'guest-facing markup never says it');
});

test('re-saving what is live is no change on the Apply count (key order, NULL ≡ {})', () => {
  assert.equal(summarizeHubDraft(draftOf({}), live(null), false).changeCount, 0);
  assert.equal(summarizeHubDraft(draftOf({ words: { thanksHeading: 'Hi' }, meal: false }), live({ meal: false, words: { thanksHeading: 'Hi' } }), false).changeCount, 0);
  const effect = hubDraftProEffects(draftOf({ celebration: 'petals' }), live(null), false)[0]!;
  assert.deepEqual(effect.remove, { events: { rsvp_ask_config: null } }, 'nothing else drafted — Remove puts back live');
});

/* A canvas the engine can draw on in Node — records clears and fills. */
function fakeCanvas() {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(16) });
        return (...args: unknown[]) => {
          calls.push(String(k));
          void args;
        };
      },
      set: () => true,
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    dataset: {} as Record<string, string>,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 375, height: 700, left: 0, top: 0 }),
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, calls };
}

test('the engine plays once, ends on its own clock and leaves the canvas cleared', { timeout: 8_000 }, async () => {
  const g = globalThis as unknown as { requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown };
  g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16);
  g.cancelAnimationFrame = (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
  const { canvas, calls } = fakeCanvas();
  const player = new CelebrationPlayer(canvas);
  const t0 = performance.now();
  const r = await player.play('confetti', { colours: ['#5b1a22', '#e0a52b'] });
  const took = (performance.now() - t0) / 1000;
  assert.equal(r.watchdog, undefined, 'it ended on its own clock');
  assert.ok(r.frames > 30, `it drew frames (${r.frames})`);
  assert.ok(took >= 2.6 && took < 3.4, `~2.7 s (${took.toFixed(2)})`);
  assert.equal(player.playing, false);
  assert.equal(canvas.dataset.celebrateState, 'idle');
  assert.equal(calls[calls.length - 1], 'clearRect', 'the last thing drawn is a clear');
  const none = await player.play('none', { colours: [] });
  assert.equal(none.frames, 0, 'None draws nothing');
});

test('the watchdog ends it even if frames stop (a hidden tab)', { timeout: 8_000 }, async () => {
  const g = globalThis as unknown as { requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown };
  g.requestAnimationFrame = () => 0; // frames never come
  g.cancelAnimationFrame = () => {};
  const { canvas, calls } = fakeCanvas();
  const player = new CelebrationPlayer(canvas);
  const r = await player.play('sparklers', { colours: ['#5b1a22'], rect: { x: 10, y: 10, w: 80, h: 20 } });
  assert.equal(r.watchdog, true);
  assert.equal(player.playing, false);
  assert.equal(calls[calls.length - 1], 'clearRect', 'nothing is left over the ticket');
});

/* ── 4 · the Maker ─────────────────────────────────────────────────────── */

test('the Maker offers ONE Celebration ▾ PickMenu on When yes, drafted through the one-object save', () => {
  const pick = code('app/dashboard/[eventId]/launch/_components/celebration-pick.tsx');
  assert.match(pick, /<PickMenu\s+label=\{RSVP_CELEBRATION_LABEL\}/, 'one dropdown');
  assert.doesNotMatch(pick, /role="radiogroup"|aria-pressed/, 'never a pill row');
  assert.match(pick, /makerProUsable\(/, 'hidden in the store shell for a couple without Pro');
  assert.match(pick, /'◆ Pro'/);
  assert.match(pick, /'Free'/);
  const panel = code('app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx');
  assert.match(panel, /scene === 'thanks' && celebration \? \(\s*<CelebrationPick/, 'When yes only');
  assert.match(panel, /save\(\{ celebration: next === 'none' \? undefined : next \}/, 'the pick is drafted like every other key');
  const stage = code('app/dashboard/[eventId]/launch/_components/maker-rsvp-stage.tsx');
  assert.match(stage, /frames\.current\.thanks\?\.contentWindow/, 'played on the When yes page');
  assert.match(stage, /window\.addEventListener\(RSVP_CELEBRATE_EVENT/);
});

test('the tapped answer fills with the page’s button colour, the other goes plain — no new setting', () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const base = css.indexOf('.rsvp-form [data-rsvp-answer]:has(:checked) {');
  const painted = css.indexOf('[data-hub-btn-paint] [data-rsvp-answer]:has(:checked) {');
  assert.ok(base > 0, 'the picked answer has its own fill');
  assert.ok(painted > base, 'a host’s Look › Buttons choice comes after it, so it wins');
  assert.match(css.slice(base, base + 160), /background-color: rgb\(var\(--color-mulberry\)\);\s*color: rgb\(var\(--color-cream\)\);/);
  assert.match(css, /\.rsvp-form fieldset:has\(:checked\) \[data-rsvp-answer\]:not\(:has\(:checked\)\) \{\s*background-color: transparent;/);
});
