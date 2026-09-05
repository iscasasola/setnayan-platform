/**
 * a-finding-reaches-the-admin.test.ts — MB21's WHOLE POINT, at the pixel.
 *
 * ── WHY THIS FILE IS THE SESSION ────────────────────────────────────────────
 * A screen that decides "a human should look at this", stores the decision,
 * and draws nothing has changed exactly nothing. The photo still arrives in
 * the admin queue looking byte-identical to a spotless one, and the reviewer
 * approves it in the same half-second as everything else. This repo's own
 * shorthand: A LOG LINE NEVER CHANGED A PIXEL — the guest-read error was bound
 * and sitting in Sentry, and a couple with 180 names was still told their
 * wedding was empty.
 *
 * ── BOTH ENDS AND THE LINE BETWEEN THEM ─────────────────────────────────────
 *   1. THE RENDER is real: `<ScreenFindingsPanel>` is painted with
 *      renderToStaticMarkup and the actual copy is read out of the HTML.
 *   2. THE MOUNT is pinned by source, inside a window anchored on the editor's
 *      selected-asset branch, and it must read `selected.screen_findings` — so
 *      deleting the mount, or hard-coding `findings={null}`, is RED.
 *   3. THE MEASUREMENT is pinned at both ends of the wire: the surface must
 *      SELECT the column, and the vendor action must WRITE it on the same
 *      insert as the row.
 *
 * A correct screen and a correct panel can each pass their own test while the
 * line between them is cut. This file is that line.
 *
 * SABOTAGE PERFORMED AND UNDONE DURING VERIFICATION — see the session report.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import type { ScreenFindings } from '@/lib/moodboard-screen-findings';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const EDITOR = path.join(HERE, 'library-editor.tsx');
const SURFACE = path.join(
  HERE, '..', '..', 'studio', '_surfaces', 'moodboard-library-surface.tsx',
);
const VENDOR_ACTIONS = path.join(
  HERE, '..', '..', '..', 'vendor-dashboard', 'moodboard-library', 'actions.ts',
);

const read = (f: string) => stripComments(fs.readFileSync(f, 'utf8'));

function windowOf(src: string, from: string, until: RegExp): string {
  const start = src.indexOf(from);
  assert.notEqual(start, -1, `anchor missing from source: ${from}`);
  const rest = src.slice(start + from.length);
  const m = rest.match(until);
  return from + (m && m.index !== undefined ? rest.slice(0, m.index) : rest);
}

const FLAGGED: ScreenFindings = {
  outcome: 'flagged',
  hits: [
    { kind: 'unfamiliar_name', label: 'a name', found: 'Aira & Nico' },
    { kind: 'phone_shaped', label: 'a number that reads like a phone number', found: '0917 880 7163' },
  ],
  text: 'Aira & Nico\n0917 880 7163',
  textScreen: 'ran',
  screenedAt: '2026-09-05T00:00:00.000Z',
};

async function paint(findings: ScreenFindings | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ScreenFindingsPanel } = await import('./screen-findings-panel');
  return renderToStaticMarkup(React.createElement(ScreenFindingsPanel, { findings }));
}

/* ── 1 · THE RENDER ───────────────────────────────────────────────────── */

test('⭐ THE GUARD · a flagged photo’s finding is PAINTED, with what was found', async () => {
  // 🔑 SABOTAGE PERFORMED AND UNDONE: the panel's <ul> of hits was deleted
  // while `screen_findings` went on being stored and selected. This test went
  // RED on every assertion below; nothing else in the suite noticed, because
  // the column, the screen and the action were all still correct.
  const html = await paint(FLAGGED);
  assert.match(html, /data-outcome="flagged"/);
  assert.match(html, /Needs a human/);
  assert.ok(html.includes('a name'), `the label must be painted: ${html}`);
  assert.ok(
    html.includes('Aira &amp; Nico'),
    `WHAT was found must be painted, not only that something was: ${html}`,
  );
  assert.ok(html.includes('0917 880 7163'), 'the second hit must paint too');
  // Severity is on the pixel: a reviewer must be able to tell a flag from a
  // block without opening a file.
  assert.match(html, /Flagged/);
});

test('a BLOCKED photo paints its refusal, not a flag', async () => {
  const html = await paint({
    ...FLAGGED,
    outcome: 'blocked',
    hits: [{ kind: 'any_url', label: 'a web address', found: 'bloomandvine.ph' }],
  });
  assert.match(html, /data-outcome="blocked"/);
  assert.match(html, /refused at upload/);
  assert.ok(html.includes('bloomandvine.ph'));
  assert.match(html, /Blocked/);
});

test('🛑 ABSENCE IS STATED, NEVER DRAWN AS CLEANLINESS', async () => {
  // A row uploaded before MB21 has no findings. Telling a reviewer "nothing
  // found" about a photo nobody screened is the false-green this session
  // exists to remove, and it renders identically to a real clean verdict.
  const html = await paint(null);
  assert.match(html, /data-outcome="none"/);
  assert.match(html, /No screen findings recorded/);
  assert.ok(!/Needs a human/.test(html));
});

test('a check that did not run says so, on the photo', async () => {
  const html = await paint({ ...FLAGGED, textScreen: 'unavailable' });
  assert.match(html, /text read did not run/);
});

test('the transcript the judgement was made from is on the page', async () => {
  const html = await paint(FLAGGED);
  assert.match(html, /Text read off the photo/);
  assert.ok(html.includes('0917 880 7163'));
});

/* ── 2 · THE MOUNT ────────────────────────────────────────────────────── */

test('⭐ THE GUARD · the editor MOUNTS the panel with the selected row’s findings', () => {
  // Sabotage run: replaced `findings={selected.screen_findings}` with
  // `findings={null}`. Every render test above stayed GREEN — the component is
  // still perfect, it is just never handed anything. This test went RED.
  const src = read(EDITOR);
  assert.match(
    src,
    /<ScreenFindingsPanel\s+findings=\{selected\.screen_findings\}\s*\/>/,
    'the panel must be mounted with the selected asset’s own findings',
  );
  assert.match(src, /import \{ ScreenFindingsPanel \} from '\.\/screen-findings-panel'/);
});

test('the queue LIST distinguishes a flagged photo from a clean one', () => {
  // Without this the reviewer has to click every photo to find the one that
  // needs them — which in practice means nobody finds it.
  const src = read(EDITOR);
  const list = windowOf(src, 'assets.map((a) => (', /RIGHT: editor/);
  assert.match(list, /a\.screen_findings/, 'the row must read the findings column');
  assert.match(list, /needs review/);
});

test('reject-with-reason sits beside Publish, and carries free text', () => {
  const src = read(EDITOR);
  assert.match(src, /rejectAsset\(selected\.asset_id, reason\)/);
  assert.match(src, /name="rejectReason"/);
  assert.match(src, /<textarea/);
  // 🛑 NOT a yes/no confirm — that is `retireAsset` with a different button,
  // and the reason IS the feature.
  const handler = windowOf(src, 'function handleReject()', /\n  (async )?function /);
  assert.ok(
    !/confirm\(/.test(handler),
    'a yes/no dialog cannot carry the sentence the supplier reads',
  );
});

/* ── 3 · THE MEASUREMENT, AT BOTH ENDS OF THE WIRE ────────────────────── */

test('the admin surface SELECTS the findings column', () => {
  const src = read(SURFACE);
  assert.match(src, /screen_findings/);
  assert.match(src, /rejected_at/);
  assert.match(src, /rejection_reason/);
  assert.match(src, /parseScreenFindings\(r\.screen_findings\)/);
});

test('the finding is WRITTEN on the same insert as the row', () => {
  // A second UPDATE after the insert is a second thing that can fail, and its
  // failure mode is a questionable photo sitting in the queue looking spotless.
  const src = read(VENDOR_ACTIONS);
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^(export )?(async )?function storeScreenedAsset\b/.test(l));
  assert.notEqual(start, -1);
  const end = lines.findIndex((l, i) => i > start && l === '}');
  const store = lines.slice(start, end + 1).join('\n');
  assert.equal(store.split('.insert({').length - 1, 1, 'still exactly one insert');
  assert.match(store, /screen_findings: screen\.findings/);
});

test('SABOTAGE-PROVEN: a flag does NOT block the upload', () => {
  // Sabotage run: `blocked: hits.length > 0` — the shape this file had when
  // every hit WAS a block. This test went RED, and in production every
  // backdrop and stage photograph carrying the couple's names would have been
  // refused at the door.
  const screen = stripComments(
    fs.readFileSync(
      path.join(HERE, '..', '..', '..', '..', 'lib', 'moodboard-gallery-screen.server.ts'),
      'utf8',
    ),
  );
  assert.match(screen, /blocked: outcome === 'blocked'/);
  assert.ok(
    !/blocked: hits\.length > 0/.test(screen),
    'a flag must never refuse an upload',
  );
});

test('the text screen still FAILS OPEN and VISIBLY when the key is unset', () => {
  // Unchanged behaviour, re-pinned because MB21 moved code around it: no key
  // ⇒ the upload proceeds and the caller is handed `textScreen: 'unavailable'`
  // so the SCREEN can say so. A check that silently did not run is the failure
  // this repo keeps re-learning.
  const screen = stripComments(
    fs.readFileSync(
      path.join(HERE, '..', '..', '..', '..', 'lib', 'moodboard-gallery-screen.server.ts'),
      'utf8',
    ),
  );
  assert.match(screen, /if \(!galleryTextScreenConfigured\(\)\) return null;/);
  assert.match(screen, /let textScreen: TextScreenStatus = 'unavailable';/);
  assert.match(screen, /if \(read !== null\) \{\s*\n\s*textScreen = 'ran';/);
  // And the supplier is told, in their own editor.
  const editor = stripComments(
    fs.readFileSync(
      path.join(
        HERE, '..', '..', '..', 'vendor-dashboard', 'moodboard-library',
        '_components', 'stylist-library-editor.tsx',
      ),
      'utf8',
    ),
  );
  assert.match(editor, /textScreen === 'unavailable'/);
});
