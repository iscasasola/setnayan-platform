/**
 * a-rejection-reaches-the-vendor.test.ts — the supplier finds out WHY.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 * Before MB21 an admin's only refusal was `retireAsset`. It hid the photo and
 * said nothing, and this editor went on reading "draft (pending review)" —
 * forever, for a photo nobody was going to review again. A decision was made,
 * written to the database, and never reached the one person who could act on
 * it. Same defect class as the couple with 180 guests being told their wedding
 * was empty: A LOG LINE NEVER CHANGED A PIXEL.
 *
 * ── BOTH ENDS AND THE LINE BETWEEN THEM ─────────────────────────────────────
 *   1. THE RENDER: `<RejectionNotice>` painted with renderToStaticMarkup, and
 *      the reviewer's actual words read out of the HTML.
 *   2. THE MOUNT: pinned by source, and it must read `selected.rejected_at` /
 *      `selected.rejection_reason` — hard-coding either is RED.
 *   3. THE MEASUREMENT: the page must SELECT both columns, and the admin action
 *      must WRITE both (the DB CHECK pairs them, so writing one alone is a
 *      refused UPDATE, not a partial success).
 *
 * SABOTAGE PERFORMED AND UNDONE DURING VERIFICATION — see the session report.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const EDITOR = path.join(HERE, 'stylist-library-editor.tsx');
const PAGE = path.join(HERE, '..', 'page.tsx');
const ADMIN_ACTIONS = path.join(
  HERE, '..', '..', '..', 'admin', 'moodboard-library', 'actions.ts',
);

const read = (f: string) => stripComments(fs.readFileSync(f, 'utf8'));

function windowOf(src: string, from: string, until: RegExp): string {
  const start = src.indexOf(from);
  assert.notEqual(start, -1, `anchor missing from source: ${from}`);
  const rest = src.slice(start + from.length);
  const m = rest.match(until);
  return from + (m && m.index !== undefined ? rest.slice(0, m.index) : rest);
}

async function paint(
  rejectedAt: string | null,
  reason: string | null,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RejectionNotice } = await import('./rejection-notice');
  return renderToStaticMarkup(
    React.createElement(RejectionNotice, { rejectedAt, reason }),
  );
}

/* ── 1 · THE RENDER ───────────────────────────────────────────────────── */

test('⭐ THE GUARD · the reviewer’s reason is PAINTED, in the hard-block voice', async () => {
  // 🔑 SABOTAGE PERFORMED AND UNDONE: the `{sentence}` expression was replaced
  // with the fixed string "This photo was not published". The column was still
  // written, still selected, still passed in — and the supplier learned
  // nothing, exactly as before MB21. This test went RED; nothing else did.
  const html = await paint(
    '2026-09-05T00:00:00.000Z',
    'there’s a phone number on the sign behind the cake',
  );
  assert.ok(
    html.includes(
      'We couldn’t publish this: there’s a phone number on the sign behind the cake.',
    ),
    `the exact reason must reach the pixel: ${html}`,
  );
  // And it says the door is not closed — a refusal with no way forward is the
  // wall this whole screen was built to avoid being.
  assert.match(html, /Nothing is deleted/);
});

test('a photo that was NOT rejected paints nothing at all', async () => {
  assert.equal(await paint(null, null), '');
  assert.equal(await paint(null, 'a stale reason'), '');
});

test('a rejection with an unreadable reason still names the state', async () => {
  // The DB CHECK makes a blank reason unrepresentable, but a render that leans
  // on a constraint it cannot see is how "pending review forever" happened.
  const html = await paint('2026-09-05T00:00:00.000Z', '   ');
  assert.match(html, /We couldn’t publish this photo\./);
  assert.ok(!/couldn’t publish this: \./.test(html));
});

/* ── 2 · THE MOUNT ────────────────────────────────────────────────────── */

test('⭐ THE GUARD · the editor MOUNTS the notice with the selected row’s reason', () => {
  // Sabotage run: `reason={null}`. Every render test above stayed GREEN and the
  // supplier saw a red box with no words in it. This test went RED.
  const src = read(EDITOR);
  assert.match(
    src,
    /<RejectionNotice\s+rejectedAt=\{selected\.rejected_at\}\s+reason=\{selected\.rejection_reason\}\s*\/>/,
    'the notice must be mounted with the selected asset’s own rejection',
  );
  assert.match(src, /import \{ RejectionNotice \} from '\.\/rejection-notice'/);
});

test('the status line stops saying "pending review" about a rejected photo', () => {
  // The specific lie this session removes.
  const src = read(EDITOR);
  const header = windowOf(src, 'selected.asset_subtype ? ` · ${selected.asset_subtype}` : \'\'', /<\/header>/);
  assert.match(header, /selected\.rejected_at/);
  assert.match(header, /not published/);
});

test('the supplier’s own list shows which photo was refused', () => {
  const src = read(EDITOR);
  const list = windowOf(src, 'assets.map((a) => (', /RIGHT: editor/);
  assert.match(list, /a\.rejected_at/);
});

/* ── 3 · THE MEASUREMENT, AT BOTH ENDS OF THE WIRE ────────────────────── */

test('the supplier page SELECTS both halves of the rejection', () => {
  const src = read(PAGE);
  assert.match(src, /rejected_at, rejection_reason/);
  assert.match(src, /rejected_at: r\.rejected_at/);
  assert.match(src, /rejection_reason: r\.rejection_reason/);
  // 🛑 AND NOT `screen_findings`. That column holds the screen's internals and
  // the raw transcript — an admin's view of a supplier's photo, not theirs.
  assert.ok(
    !/screen_findings/.test(src),
    'the supplier page must not read the screening internals',
  );
});

test('the admin action writes BOTH halves, and approving clears BOTH', () => {
  // The DB CHECK pairs them, so writing or clearing one alone is a REFUSED
  // update — an admin's Publish that silently does nothing.
  const src = read(ADMIN_ACTIONS);
  const reject = windowOf(src, 'export async function rejectAsset(', /\nexport /);
  assert.match(reject, /rejected_at: now/);
  assert.match(reject, /rejection_reason: trimmed/);
  assert.match(reject, /retired_at: now/, 'a refusal must also take it off the shelf');
  assert.match(reject, /if \(!trimmed\)/, 'a blank reason is refused with a sentence');

  const approve = windowOf(src, 'export async function approveAsset(', /\n\/\*\*|\nexport /);
  assert.match(approve, /rejected_at: null/);
  assert.match(approve, /rejection_reason: null/);
});

test('rejection and retirement stay DIFFERENT columns', () => {
  // `retired_at` is reversible housekeeping with no judgement attached.
  // Collapsing them would make an ordinary un-publish read to the supplier as
  // an accusation.
  const src = read(ADMIN_ACTIONS);
  const retire = windowOf(src, 'export async function retireAsset(', /\nexport /);
  assert.ok(
    !/rejection_reason/.test(retire),
    'retiring a photo must not fabricate a rejection',
  );
  assert.ok(!/rejected_at/.test(retire));
});
