/**
 * one-letter-and-its-own-motion.test.ts — owner, 2026-09-27:
 *
 *   ✍ *"font should be a drop down. and they can interchange whichever text
 *      they highlight to be on that font. they can take 1 letter and change
 *      the font."*
 *   🎞 *"each element can have a transition and animation. Transition in and
 *      out. Animation During. we already discussed this."* (model: the
 *      2026-09-23 hero-canvas editor prototype)
 *
 * Held here, each assertion seen to fail once:
 *   R1 a one-letter run renders on the GUEST page, as a span, server-side;
 *   R2 when the text changes, a run is never moved onto OTHER letters — it
 *      follows its own surviving letters when the old words are known
 *      (`was`, owner 2026-09-28 "can't it adapt?" — `element-runs-adapt.test.ts`),
 *      and is dropped when they are not;
 *   R3 with no selection a choice styles the whole element;
 *   R4 hostile input is dropped (no CSS text, no out-of-range offsets);
 *   M1 In and During play TOGETHER, and choosing one never clears the other;
 *   M2 under "Plays once" there is no Out; under "Follows the scroll" there is;
 *   M3 a hostile motion value is dropped;
 *   P  Play has a twin keyframe to swap to (a CSS animation restarts only on a new name).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  hubElementDeclarations,
  hubElementMotionDeclarations,
  hubTextHash,
  sanitizeHubElementMotion,
  sanitizeHubElements,
  withElementChoice,
  withElementMotion,
  withRunChoice,
} from './element-style';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, type HubLiveState } from './hub-draft';
import type { InvitationWidgetRow } from './invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

async function renderCard(elements: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../app/[slug]/_components/pahina-masthead');
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Cale & Ice',
      eventDate: '2026-12-18',
      card: { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: '3:00 PM', hubHref: '#', hubLabel: 'Open' },
      elements: sanitizeHubElements(elements),
    }),
  );
}

// The card's names read "Cale" · "and" · "Ice" — its textContent, which the
// canvas measures offsets in, is the three joined.
const NAMES_TEXT = 'CaleandIce';

/* ── ✍ RUNS ─────────────────────────────────────────────────────────────── */

test('R1 · a ONE-LETTER run renders on the guest page, server-side, exactly where it was made', async () => {
  const html = await renderCard({
    names: { runs: [{ start: 7, end: 8, font: 'script', color: '#8a1c2b' }], of: hubTextHash(NAMES_TEXT) },
  });
  // Offset 7 is the "I" of "Ice" (after "Cale" + "and").
  assert.match(
    html,
    /<span class="block"><span data-el-run="" style="font-family:var\(--font-script\), cursive;color:#8a1c2b">I<\/span>ce<\/span>/,
    html,
  );
  assert.equal((html.match(/data-el-run/g) ?? []).length, 1, 'exactly one letter carries the run');
});

test('R1 · a run across a word in the invitation line, and in the date', async () => {
  const line = 'invite you to celebrate their wedding';
  const html = await renderCard({
    line: { runs: [{ start: 14, end: 23, font: 'cinzel' }], of: hubTextHash(line) },
  });
  assert.match(html, /invite you to <span data-el-run="" style="font-family:var\(--font-cinzel\), Georgia, serif">celebrate<\/span> their wedding/);
});

test('R2 · when the text CHANGES and the old words are unknown, its runs are dropped — never moved onto other letters', async () => {
  const html = await renderCard({
    names: { runs: [{ start: 7, end: 8, font: 'script' }], of: hubTextHash('MariaandJose') },
  });
  assert.doesNotMatch(html, /data-el-run/);
  // And the sheet re-anchors to the text the NEW selection was made on.
  const older = sanitizeHubElements({ names: { runs: [{ start: 0, end: 1, font: 'script' }], of: hubTextHash('Old') } });
  const next = withRunChoice(older, 'names', { start: 2, end: 3, of: hubTextHash(NAMES_TEXT) }, 'color', '#112233');
  assert.deepEqual(next?.names?.runs, [{ start: 2, end: 3, color: '#112233' }], 'a run made on old text never survives beside new ones');
});

test('R2 · when the text CHANGES and the old words are known, a run follows ITS letter on the guest page', async () => {
  // Made on "CaleandIvy" (the second name was Ivy); the page now says Cale & Ice.
  const was = 'CaleandIvy';
  const html = await renderCard({ names: { runs: [{ start: 0, end: 1, font: 'script' }, { start: 7, end: 10, color: '#8a1c2b' }], of: hubTextHash(was), was } });
  // The "C" kept its letter and its style; of "Ivy" only the "I" survives in "Ice".
  assert.match(html, /<span data-el-run="" style="font-family:var\(--font-script\), cursive">C<\/span>ale/, html);
  assert.match(html, /<span data-el-run="" style="color:#8a1c2b">I<\/span>ce/, html);
  assert.equal((html.match(/data-el-run/g) ?? []).length, 2);
});

test('R3 · with NO selection, a choice styles the whole element; with one, only the range', () => {
  const whole = withElementChoice(null, 'names', 'font', 'cinzel');
  assert.deepEqual(whole, { names: { font: 'cinzel' } });
  const part = withRunChoice(null, 'names', { start: 0, end: 1, of: hubTextHash(NAMES_TEXT) }, 'font', 'cinzel');
  assert.deepEqual(part, { names: { runs: [{ start: 0, end: 1, font: 'cinzel' }], of: hubTextHash(NAMES_TEXT) } });
  // The sheet chooses between the two by whether a range is selected — and a
  // run takes only font · colour · size (the Text tab's other rows, 2026-09-27,
  // are the whole part's: weight, spacing, alignment are never per-letter).
  const SHEET = stripComments(read('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx'));
  assert.match(
    SHEET,
    /range && \(field === 'font' \|\| field === 'color' \|\| field === 'size'\)\s*\?\s*withRunChoice\(latest\.current\.elements, target\.el, range, field, [^)]*\)\s*:\s*withElementChoice\(/,
  );
});

test('R4 · hostile runs are dropped — no CSS text, no out-of-range offsets, no forged hash', () => {
  const out = sanitizeHubElements({
    names: {
      of: hubTextHash(NAMES_TEXT),
      runs: [
        { start: -1, end: 2, font: 'script' },
        { start: 0, end: 1e9, font: 'script' },
        { start: 1, end: 1, font: 'script' },
        { start: 2, end: 3, font: 'Comic Sans', color: 'red;background:url(x)', size: 'huge' },
        { start: 3, end: 4, color: '#ABCDEF' },
        { start: 3.5, end: 4, font: 'script' },
      ],
    },
    line: { of: 'not-a-hash', runs: [{ start: 0, end: 1, font: 'script' }] },
    // The mark has no words, so it can carry no run.
    mark: { of: hubTextHash('x'), runs: [{ start: 0, end: 1, font: 'script' }] },
  });
  assert.deepEqual(out, { names: { runs: [{ start: 3, end: 4, color: '#abcdef' }], of: hubTextHash(NAMES_TEXT) } });
});

/* ── 🎞 MOTION ──────────────────────────────────────────────────────────── */

test('M1 · In and During play TOGETHER — two comma-separated animations, and one never clears the other', () => {
  let els = withElementMotion(null, 'names', 'in', 'rise');
  els = withElementMotion(els, 'names', 'during', 'drift');
  // 🔁 The shipped `rise` is READ as Fade + Move from below (2026-10-04).
  assert.deepEqual(els?.names?.motion, { in: { fade: true, move: 'below' }, during: 'drift' }, 'choosing During cleared In');
  const decl = Object.fromEntries(hubElementMotionDeclarations(els?.names?.motion));
  // (the name is written LAST in each slot — see `MotionSlot`)
  assert.match(decl.animation ?? '', / none el-in-rise, 7s ease-in-out 0s infinite alternate el-during-drift, /);
  // Drift moves `translate`, In moves `transform` — they compose.
  const CSS = read('app/globals.css');
  assert.match(CSS, /@keyframes el-during-drift \{[^}]*translate: 0 0;[^}]*\}/);
  assert.match(CSS, /@keyframes el-in-rise\s*\{[^}]*transform:/);
});

test('M2 · under "Plays once" there is no Out; under "Follows the scroll" Out runs on the exit range', () => {
  // 🔁 Shipped values are read as the four effects; Duration slow is Speed Gentle.
  assert.deepEqual(sanitizeHubElementMotion({ in: 'rise', out: 'lift', duration: 'slow' }), {
    in: { fade: true, move: 'below' },
    speed: 'gentle',
  });
  const scroll = sanitizeHubElementMotion({ in: 'fade', out: 'lift', timeline: 'scroll', duration: 'slow', delay: 'long' });
  assert.deepEqual(
    scroll,
    { in: { fade: true }, out: { fade: true, move: 'above' }, timeline: 'scroll' },
    'Duration and Delay do not apply to a scrolled element',
  );
  const once = Object.fromEntries(hubElementMotionDeclarations(sanitizeHubElementMotion({ in: 'rise' })!));
  assert.doesNotMatch(once.animation ?? '', /el-out-/);
  // 🔑 A timed element STATES its timeline, so a scene's `view()` cannot take it over.
  assert.match(once['animation-timeline'] ?? '', /^auto, /);
  const scrolled = Object.fromEntries(hubElementMotionDeclarations(scroll!));
  assert.match(scrolled.animation ?? '', /el-in-fade, .* el-out-lift$/);
  assert.equal(scrolled['animation-timeline'], 'view(), view()');
  assert.equal(scrolled['animation-range'], 'entry 0% cover 30%, exit 0% exit 100%');
  // The sheet only offers Goes out when the element follows the scroll (the
  // Motion section's rows live in `part-inspector.tsx`).
  const TAB = stripComments(read('app/dashboard/[eventId]/website/editor/_components/part-inspector.tsx'));
  assert.match(TAB, /\{scroll \? \(\s*<div data-motion-step="out">/);
});

test('M3 · a hostile motion value is dropped — only closed-set keys ever reach CSS', () => {
  assert.equal(sanitizeHubElementMotion({ in: 'bounce', during: 'spin', timeline: 'sideways', out: 'explode' }), null);
  // Ken Burns / Parallax are for a photo; no element here is one.
  assert.equal(sanitizeHubElementMotion({ during: 'kenburns' }), null);
  const els = sanitizeHubElements({ heading: { motion: { in: 'rise; } body { display:none' } } });
  assert.equal(els, null);
});

test('P · Play swaps to a twin keyframe — every In has one, and the bridge swaps names', () => {
  const CSS = read('app/globals.css');
  for (const kf of ['el-in-rise', 'el-in-fade']) {
    assert.match(CSS, new RegExp(`@keyframes ${kf}\\s*\\{`));
    assert.match(CSS, new RegExp(`@keyframes ${kf}-p\\s*\\{`), `${kf} has no -p twin, so Play cannot restart it`);
  }
  const BRIDGE = stripComments(read('app/[slug]/_components/editor-bridge.tsx'));
  assert.match(BRIDGE, /names\[i\]!\.endsWith\('-p'\) \? names\[i\]!\.slice\(0, -2\) : `\$\{names\[i\]\}-p`/);
});

test('✍ the canvas measures offsets in the SAME text the guest page cuts — and hashes that text', () => {
  const BRIDGE = stripComments(read('app/[slug]/_components/editor-bridge.tsx'));
  assert.match(BRIDGE, /pre\.selectNodeContents\(part\);/);
  assert.match(BRIDGE, /of: hubTextHash\(whole\)/);
  assert.match(BRIDGE, /if \(!HUB_ELEMENT_RUN_KEYS\.includes\(el\)\) return null;/);
});

test('Pro · a run or a motion is Pro at Apply; taking one off is free', () => {
  const widget = (config: unknown): InvitationWidgetRow => ({
    widget_id: 'w-hero', event_id: 'e1', widget_type: 'hero', display_order: 1, is_visible: true,
    is_always_on: true, tier: 'basic', config_json: config, created_at: '', updated_at: '', mode: 'auto',
  });
  const live: HubLiveState = { events: {}, widgets: [widget({})] };
  const withRun = mergeHubDraft(emptyHubDraft(), {
    widgets: { hero: { canvas: { elements: { names: { runs: [{ start: 0, end: 1, font: 'script' }], of: hubTextHash(NAMES_TEXT) } } } } },
  });
  assert.equal(planHubDraftApply(withRun, live, false).refused.length, 1, 'a free couple applied a run');
  const withMotion = mergeHubDraft(emptyHubDraft(), { widgets: { hero: { canvas: { elements: { names: { motion: { in: { fade: true, move: 'below' } } } } } } } });
  assert.equal(planHubDraftApply(withMotion, live, false).refused.length, 1, 'a free couple applied a motion');
  const liveRun: HubLiveState = { events: {}, widgets: [widget({ canvas: { elements: { names: { motion: { in: 'rise' } } } } })] };
  const off = mergeHubDraft(emptyHubDraft(), { widgets: { hero: { canvas: {} } } });
  assert.equal(planHubDraftApply(off, liveRun, false).refused.length, 0, 'taking a motion off is free');
});
