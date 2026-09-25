import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * A QR DOWNLOAD MUST SAVE, NEVER NAVIGATE — owner, 2026-09-25: *"When we try
 * to download the QR code, when that button is pressed. it should just save
 * and not open a new page."*
 *
 * `target="_blank"` and `window.open(` are the two ways a "download" control
 * can turn into a navigation on THIS repo's other surfaces (the "Print sheet"
 * / "Preview as guest" links on the Invitation and Custom-QR pages use both
 * legitimately — they open a different PAGE on purpose). Neither belongs on a
 * control whose only job is to hand back a file, and a bare `<a download>`
 * is not enough either: iOS Safari and the Capacitor iOS shell can both
 * ignore the `download` attribute on a same-origin GET and navigate to the
 * file instead — indistinguishable, from the chair holding the phone, from
 * "opens a new page". `SaveFileLink` (app/_components/save-file-link.tsx)
 * exists to close that gap with fetch → blob → object-URL / the native share
 * sheet; this guard is what keeps every QR download on the Guest list and its
 * drawer going through it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Every surface with a QR "download" control on the Guest list or its drawer. */
const GUEST_LIST_QR_SURFACES = [
  'app/dashboard/[eventId]/guests/_components/roster-tabs.tsx', // QR codes (PDF)
  'app/dashboard/[eventId]/guests/_components/guest-detail-body.tsx', // the drawer's own QR
  'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx', // mounts the drawer body
  'app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx', // Guest list's Share tab join-link QR
  'app/_components/qr-actions.tsx', // the shared Download · NFC · Copy strip
  'app/_components/save-file-link.tsx', // the mechanism itself
];

test('no QR download control on the Guest list or its drawer navigates instead of saving', () => {
  for (const rel of GUEST_LIST_QR_SURFACES) {
    const src = stripComments(read(rel));
    assert.doesNotMatch(src, /target\s*=\s*["']_blank["']/, `${rel} opens a new tab for a download`);
    assert.doesNotMatch(src, /window\.open\(/, `${rel} calls window.open`);
  }
});

test('the Guest list + drawer QR downloads all go through SaveFileLink, not a bare <a download>', () => {
  const MUST_USE_SAVE_FILE_LINK = [
    'app/dashboard/[eventId]/guests/_components/roster-tabs.tsx',
    'app/dashboard/[eventId]/guests/_components/guest-detail-body.tsx',
    'app/_components/qr-actions.tsx',
  ];
  for (const rel of MUST_USE_SAVE_FILE_LINK) {
    const src = stripComments(read(rel));
    assert.ok(
      src.includes("from '@/app/_components/save-file-link'"),
      `${rel} does not import SaveFileLink`,
    );
    assert.ok(src.includes('<SaveFileLink'), `${rel} imports SaveFileLink but never mounts it`);
  }
});

test('SaveFileLink itself: fetch → blob → save/share, never a raw cross-origin navigation', () => {
  const src = stripComments(read('app/_components/save-file-link.tsx'));
  assert.ok(src.includes("'use client'"), 'SaveFileLink must be a client component to intercept the click');
  assert.ok(src.includes('preventDefault()'), 'the click is not intercepted — a browser that ignores `download` will navigate');
  assert.ok(
    src.includes("from '@/lib/save-to-device'"),
    'SaveFileLink does not use the shared fetch→blob→share helper',
  );
  // The <a> keeps href/download as the no-JS fallback — removing them would
  // make a scripting-off visit unable to get the file at all.
  assert.match(src, /href=\{href\}/);
  assert.match(src, /download=\{filename\}/);
});
