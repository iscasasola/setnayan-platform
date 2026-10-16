/**
 * 🚫 THE HOST'S OWN EVENT HUB HAS NO HOST STRIP — AND THE PHONE KEEPS ITS SEE AS.
 *
 * Owner, 2026-10-15, on the live Event Hub, of the strip "Your Event Hub — as a
 * guest sees it" · Edit · Preview ▾: *"Remove it."* The couple's own page looks
 * exactly like a guest's; editing is from the dashboard (Home's "Edit your Event
 * Hub"). Approved design: `Setnayan/prototypes/host_preview_after_ribbon_2026-10-15_fable.html`.
 * The owner's picks: the STRIP only (the host-voiced body lines stay —
 * `host-body-variant.test.ts`), and See as on a phone YES.
 *
 * What this holds, and how:
 *   0. RENDERED — the REAL `SiteBody` (`lib/site-body-fixture-render.ts`), drawn
 *      for a signed-in host of the fixture event: no strip, no landmark, no
 *      words — and still the host's body (no stranger's "Get inside"), while
 *      the same page for a stranger keeps its door. (On the commit before this
 *      one the host render could not even finish: the strip's Preview ▾ asked
 *      for the app router — the strip WAS drawn.)
 *   1. NO HOST CHROME ON /[slug] — every non-test source under `app/[slug]` is
 *      read (comments stripped) for the strip's component, its marker, its
 *      landmark and its words. Zero, and the scan proves it read real files.
 *   2. THE STRIP'S MODULES ARE GONE — not merely unmounted, so nothing can
 *      re-mount them with one line.
 *   3. THE ONE GAP IS FILLED — the strip's Preview ▾ was the phone's only See as.
 *      The hold-▶ preview's row (`data-stage-exit-preview`, phone only) now holds
 *      exactly ONE See as PickMenu beside "Exit preview", reading the Maker's one
 *      `setSeeAs`, and NO second stage control (the stage is picked before ▶ is
 *      held). Exit returns See as to "You"; a canvas that reloads for a pick is
 *      told at once that it is a guest's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { SEE_AS, seeAsDrawingLine } from '@/lib/see-as';
import { renderSiteBodyFixtureFull } from '@/lib/site-body-fixture-render';
import { fixtureStranger, siteBodyFixtureProps } from '@/lib/site-body-fixture';
import type { OwnerCapability } from './site-identity';

const SLUG = join(import.meta.dirname, '..');
const WEB = join(SLUG, '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

test('0 · RENDERED: a signed-in host’s own page draws no host strip — and is still the host’s page, not a stranger’s', async () => {
  const eventId = siteBodyFixtureProps().event.event_id;
  const host: OwnerCapability = { capability: 'owner', ownerUserId: 'lab-host', ownerEventId: eventId, maySiteEdit: true };
  for (const phase of ['rsvp', 'event'] as const) {
    const asHost = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), lifecyclePhase: phase, phasesEnabled: true, ownerCapability: host });
    const asStranger = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), lifecyclePhase: phase, phasesEnabled: true });
    assert.deepEqual(asHost.complaints, [], `${phase}: React complained drawing the host’s page`);
    assert.ok(asHost.html.length > 10_000, `${phase}: the host render is ${asHost.html.length} bytes — not the page`);
    for (const [what, re] of [
      ['the strip’s landmark', /aria-label="Host controls"/],
      ['the strip’s marker', /data-owner-ribbon/],
      ['the strip’s words', /as a guest sees it/],
      ['the strip’s Preview ▾', /data-owner-phase-menu/],
    ] as const) {
      assert.doesNotMatch(asHost.html, re, `${phase}: a signed-in host is drawn ${what}`);
    }
    // Strip only (owner pick): the host body stays — the host meets no stranger’s door; the stranger still does.
    assert.doesNotMatch(asHost.html, /Get inside/, `${phase}: the host is handed the stranger’s door — the host body is gone`);
    assert.match(asStranger.html, /Get inside/, `${phase}: the stranger lost the door — the comparison is blind`);
  }
});

test('1 · no host strip on /[slug]: its component, its marker, its landmark and its words are nowhere on the page', () => {
  const files = walk(SLUG);
  const body = files.find((f) => f.endsWith(join('_components', 'site-body.tsx')));
  assert.ok(files.length > 50 && body, `the scan read ${files.length} files and no site-body.tsx — it is blind, not clean`);
  const hits: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const [what, re] of [
      ['the strip', /<OwnerRibbon\b|\bbuildOwnerRibbon\(/],
      ['its Preview ▾', /<OwnerPhaseMenu\b|data-owner-phase-menu/],
      ['its marker', /data-owner-ribbon/],
      ['its landmark', /aria-label="Host controls"/],
      ['its words', /as a guest sees it/],
    ] as const) {
      if (re.test(src)) hits.push(`${f.slice(WEB.length + 1)}: ${what}`);
    }
  }
  console.log(`  host-strip scan: ${files.length} files under app/[slug], ${hits.length} hits`);
  assert.deepEqual(hits, [], `a signed-in host sees owner chrome on /[slug] again:\n  ${hits.join('\n  ')}`);
});

test('2 · the strip’s modules are gone, not just unmounted', () => {
  for (const rel of [
    'app/[slug]/_components/owner-ribbon.tsx',
    'app/[slug]/_components/owner-phase-menu.tsx',
    'lib/owner-ribbon.ts',
  ]) {
    assert.equal(existsSync(join(WEB, rel)), false, `${rel} is back`);
  }
  assert.doesNotMatch(readFileSync(join(WEB, 'lib/see-as.ts'), 'utf8'), /SEE_AS_YOU/, 'the strip’s own "You" row is back in lib/see-as.ts');
});

const TOOLS = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/stage-tools.tsx'), 'utf8'));

/** The hold-▶ preview's row: from its marker to the shell it is portalled into. */
function previewRow(): string {
  const from = TOOLS.indexOf('data-stage-exit-preview=""');
  const to = TOOLS.indexOf('shellEl,', from);
  assert.ok(from > 0 && to > from, 'the hold-▶ preview’s row moved — re-anchor this test');
  return TOOLS.slice(from, to);
}

test('3 · the hold-▶ preview’s row: Exit preview, and exactly ONE See as ▾ — phone only, no second stage control', () => {
  const row = previewRow();
  const menus = row.match(/<PickMenu\b/g)?.length ?? 0;
  const seeAs = row.match(/<PickMenu\s+label="See as"/g)?.length ?? 0;
  console.log(`  hold-▶ row: ${menus} PickMenu, ${seeAs} labelled See as`);
  assert.match(row, /label="Exit preview" onClick=\{exitPreview\}/, '"Exit preview" left the row');
  assert.equal(seeAs, 1, 'the row does not hold exactly one See as ▾');
  assert.equal(menus, 1, 'the row holds a second dropdown — the stage is picked before ▶ is held, never in the preview');
  assert.doesNotMatch(row, /makerPagePick|onPickPage|MAKER_PAGE_STAGES/, 'a stage control is in the preview');
  // Phone only, like the row itself: a desktop has its one dropdown above the preview.
  assert.match(row, /className="pointer-events-none absolute inset-x-0 z-\[31\] flex justify-center gap-2 px-3 lg:hidden"/);
  // The same rows and the same Maker state as the desktop's dropdown — never a second mechanism.
  assert.match(row, /\{ key: SEE_AS_EDITING\.key, label: SEE_AS_EDITING\.label \},\s*\.\.\.SEE_AS\.map\(/);
  assert.match(row, /maker\.setSeeAs\?\.\(next\)/);
  assert.match(row, /setWhyRef\.current\(seeAsDrawingLine\(next\)\)/, 'a pick no longer says whose eyes the page is being drawn with');
  // The 44-px floor, and the dropdown reads as the button it is.
  assert.match(row, /className="pointer-events-auto min-h-11 /);
  // Exactly one See as anywhere in the stage tools.
  assert.equal(TOOLS.match(/label="See as"/g)?.length ?? 0, 1, 'See as is drawn twice in the stage tools');
});

test('3 · Exit preview gives the page back to the couple; a canvas reloaded for a pick stays a guest’s', () => {
  const exit = TOOLS.slice(TOOLS.indexOf('const exitPreview = useCallback('), TOOLS.indexOf('}, []);', TOOLS.indexOf('const exitPreview = useCallback(')));
  assert.ok(exit.length > 100, 'exitPreview was not found');
  assert.match(exit, /if \(seeAsNow\.current\.seeAs !== null\) seeAsNow\.current\.set\?\.\(null\);/, 'leaving the preview keeps a guest’s eyes on the editing canvas');
  assert.match(
    TOOLS,
    /if \(d\?\.source !== 'setnayan-site' \|\| d\.t !== 'ready'\) return;\s*stageCanvasOf\(e\.source, stage\)\?\.postMessage\(\{ source: 'setnayan-editor', t: 'guest', on: true \}/,
    'a canvas redrawn for a See as pick takes the Maker’s taps again in the preview',
  );
});

test('3 · the line said while the canvas redraws names whose eyes, in the prototype’s words', () => {
  assert.deepEqual(
    [...SEE_AS.map((s) => seeAsDrawingLine(s.key)), seeAsDrawingLine(null)],
    [
      'Drawing it as a guest who hasn’t replied…',
      'Drawing it as a guest who replied Yes…',
      'Drawing it as a guest who declined…',
      'Drawing it as a signed-out visitor…',
      'Back to your own view…',
    ],
  );
});
