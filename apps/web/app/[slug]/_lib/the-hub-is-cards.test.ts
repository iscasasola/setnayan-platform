/**
 * THE HUB IS CARDS (owner 2026-09-21: "doesn't look like the event hub we
 * planned" — canvas "3 · Scrolled, replied").
 *
 * Protects: the hub's sections render inside the `.sn-hub-cards` wrapper on
 * BOTH the stranger's and the guest's page, the card look lives in one CSS
 * block, and the programme is NEVER shortened on the Event Hub — before the
 * day or on it. Owner, 2026-09-25 (DECISION_LOG "THE EVENT HUB SCHEDULE AND
 * GUEST LIST EXTEND IN PLACE"): *"event schedule on the event hub should not
 * be see other schedule it will extend as needed."* This test used to pin the
 * pre-day "All N moments" card; the design moved, so the property moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const C = join(__dirname, '..', '_components');
const read = (p: string) => readFileSync(p, 'utf8');

test('both pages wrap the hub sections in the card wrapper', () => {
  const body = stripComments(read(join(C, 'site-body.tsx')));
  assert.equal(
    body.split('<div className="sn-hub-cards space-y-4">{publicWidgetNodes}</div>').length - 1,
    2,
    "the stranger's two Details branches",
  );
  // The guest's sections go through the Scroll · Scrub scenes (owner
  // 2026-09-24) INSIDE the card wrapper — the wrapper is still the direct parent
  // of whatever the map produces when no section scrubs.
  assert.match(
    body,
    /<div className="sn-hub-cards space-y-4">\s*<HubScenes widgets=\{plan\.hideableInOrder\}[^>]*>\s*\{plan\.hideableInOrder\.map/,
    "the guest's hub",
  );
  assert.match(
    body,
    /const publicWidgetNodes = \(\s*<HubScenes widgets=\{plan\.publicSafeWidgets\}/,
    "the stranger's hub goes through the same scenes",
  );
});

test('the card look is one CSS block', () => {
  const css = read(join(__dirname, '..', '..', 'globals.css'));
  // A scene inside an Auto run (Phase 5, `hub-auto-run.tsx`) sits one level
  // deeper than `.hub-scenes > .hub-scene`, so it is its own arm of the SAME rule.
  assert.match(css, /\.sn-hub-cards > section,\s*\.sn-hub-cards > div > section,\s*\.hub-scenes > \.hub-scene > section,\s*\.hub-arun > \.hub-scene > section \{[^}]*border-radius: var\(--m-r-md\);/);
  assert.match(css, /\.sn-hub-cards \.pahina-eyebrow > span\[aria-hidden\]:first-child \{\s*display: none;/);
});

test('the Event Hub never shortens the programme — every moment, before the day and on it', () => {
  for (const f of ['hideable-widget-render.tsx', 'public-hideable-widget.tsx']) {
    const src = stripComments(read(join(C, f)));
    const at = src.indexOf('<ScheduleWidget');
    assert.ok(at >= 0, `${f}: still mounts the programme`);
    const call = src.slice(at, src.indexOf('/>', at));
    assert.doesNotMatch(call, /\bcompact\b/, `${f}: the hub programme extends in place, never compact`);
  }
  const body = stripComments(read(join(C, 'site-body.tsx')));
  const live = body.slice(body.indexOf('aria-label="Day-of schedule"'), body.indexOf('aria-label="Day-of schedule"') + 400);
  assert.doesNotMatch(live, /\bcompact\b/, 'on the day the run of show is never shortened');
});
