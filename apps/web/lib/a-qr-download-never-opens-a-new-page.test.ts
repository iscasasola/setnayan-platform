import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
  // (roster-tabs.tsx, the old tab row, was retired with Maker PR 4f — 2026-10-07.)
  'app/dashboard/[eventId]/guests/_components/guests-screen.tsx', // the Guests screen (List · Map · Setup)
  // ⤷ 2026-09-30: the card's own QR left (owner, the Fable guest card); the
  // card saves the guest's Digital ticket instead — `Save ticket`, below.
  'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx', // the guest card
  'app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx', // the card's ticket · Save ticket
  'app/dashboard/[eventId]/guests/invite/_components/share-link-panel.tsx', // Guest list's Share tab join-link QR
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
  // The guest card's Save ticket is a client component, so it mounts
  // SaveFileLink itself (the sweep below keeps every mount client-side).
  const MUST_USE_SAVE_FILE_LINK = [
    'app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx',
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

test('the guest card saves the ticket with ONE button, through SaveFileLink', () => {
  // ⤷ 2026-09-30 (owner, frame F): "One button: Save ticket … so there is no
  // separate Download QR any more." The server card draws no save control of
  // its own — the client ticket view does.
  const card = stripComments(read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx'));
  assert.doesNotMatch(card, /Download QR|<SaveFileLink/, 'the card grew its own download again');
  const parts = stripComments(read('app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx'));
  assert.match(parts, /<SaveFileLink[\s\S]{0,400}Save ticket/, 'the full ticket view has no Save ticket');
});

/*
  🔑 SaveFileLink's children are a FUNCTION of its saving state. A function
  cannot cross from a server component to a client one — React throws
  "Functions cannot be passed directly to Client Components" and the whole
  PAGE fails. That shipped once: the guest list crashed in production
  (digest 3329950423, 2026-09-27) because two server components wrote
  `<SaveFileLink>{() => …}</SaveFileLink>`. So SaveFileLink may be MOUNTED
  only from a file that is itself 'use client'. Swept, not listed, so a new
  caller is caught without anyone updating this file.
*/
test('SaveFileLink is mounted only from client components', () => {
  const APP = join(__dirname, '..', 'app');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || name === '.next') continue;
        walk(full);
      } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
        const raw = readFileSync(full, 'utf8');
        const src = stripComments(raw);
        if (!src.includes('<SaveFileLink')) continue;
        // 'use client' must be the first statement; comments may precede it.
        const isClient = /^(?:\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*))*\s*['"]use client['"]/.test(raw);
        if (!isClient) offenders.push(full.slice(APP.length + 1));
      }
    }
  };
  walk(APP);
  assert.deepEqual(offenders, [], `server components mounting SaveFileLink (a function child cannot cross to the client): ${offenders.join(', ')}`);
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
