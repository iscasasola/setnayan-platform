/**
 * 📋💾 WHERE A PERSON MUST COPY, A COPY BUTTON · WHERE THEY KEEP A PHOTO, A SAVE BUTTON (owner 27 Nov 2026, R1:
 * "Add Copy buttons wherever people must copy: addresses, phone and email, GCash and bank details, booking and
 * receipt refs, event codes, error codes" · "Photos need Save buttons, because long-press save goes away").
 *
 * Text is not selectable app-wide (`no-text-selection-app-wide.test.ts`), so each spot below lost the way people
 * used to copy or save. Each keeps its button — a refactor that drops one turns this red.
 * Spots that already had a Copy or Save before 27 Nov are held by their own tests and not repeated here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const ROOT = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

/** file → what must be in it (a Copy / Save mount, by a greppable anchor). */
const COPY: Record<string, RegExp[]> = {
  // Receipt numbers — every receipt page draws this slip.
  'app/receipts/_components/receipt-slip.tsx': [/<CopyButton value=\{number\} label="Copy receipt no\." \/>/],
  // Error codes.
  'app/error.tsx': [/<CopyButton value=\{error\.digest\} label="Copy reference" \/>/],
  'app/[slug]/error.tsx': [/<CopyButton value=\{error\.digest\} label="Copy reference" \/>/],
  'app/vendor-dashboard/error.tsx': [/<CopyButton value=\{error\.digest\} label="Copy reference" \/>/],
  'app/admin/error.tsx': [/<CopyButton[\s\S]{0,300}label="Copy error"/],
  // Supplier phone / email.
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx': [/<CopyButton value=\{\(ev\.contact_phone \?\? ev\.contact_email\) as string\}/],
  'app/admin/verify/page.tsx': [/<CopyButton value=\{application\.vendor\.contact_email\}/, /<CopyButton value=\{application\.vendor\.contact_phone\}/],
  'app/admin/accounts/_surfaces/vendors-surface.tsx': [/<CopyButton value=\{v\.contact_email\}/],
  'app/admin/users/[userId]/page.tsx': [/<CopyButton value=\{email\} label="Copy email" \/>/],
  // Venue address.
  'app/vendor-dashboard/clients/[eventId]/page.tsx': [/<CopyButton value=\{brief\.event\.venue_address\} label="Copy address" \/>/],
  'app/dashboard/[eventId]/vendors/_components/fact-sheets.tsx': [/<CopyButton value=\{slot\.booked\.address\} label="Copy address" \/>/],
  // Payment details and references.
  'app/proposals/[publicId]/page.tsx': [/<CopyButton value=\{m\.account_number\} label="Copy account no\." \/>/],
  'app/admin/payments/_components/desk.tsx': [/<CopyButton value=\{o\.public_id\} label="Copy order ID" \/>/, /<CopyButton value=\{p\.reference_number\} label="Copy payment ref" \/>/],
};

const SAVE: Record<string, RegExp[]> = {
  // Every shared photo viewer without a Share of its own gets a Save.
  'app/_components/gallery/photo-viewer.tsx': [/const ownSave = photo\.kind === 'photo' && !actions\.some\(\(a\) => a\.key === 'share' \|\| a\.key === 'save'\);/, /saveImageToDevice\(photo\.src,/],
  'app/papic/guest/_components/my-shots-sheet.tsx': [/<LightboxSaveButton url=\{viewing\.url\}/],
  // QR codes that are pictures, not links.
  'app/dashboard/[eventId]/event-qr/page.tsx': [/<SaveFileLink[\s\S]{0,200}filename="setnayan-crew-qr\.svg"/],
  'app/proposals/[publicId]/page.tsx': [/<SaveFileLink href=\{m\.qr_display_url\}/],
  'app/dashboard/[eventId]/_components/vendor-direct-pay.tsx': [/<SaveFileLink href=\{shownUrl\}/],
  'app/dashboard/[eventId]/vendors/_components/own-pay-ways.tsx': [/<SaveFileLink href=\{big\.qrUrl\}/],
};

test('every spot where a person must copy keeps its Copy button', () => {
  for (const [rel, anchors] of Object.entries(COPY)) {
    const src = read(rel);
    for (const a of anchors) assert.match(src, a, `${rel}: lost its Copy (${a})`);
    assert.match(src, /from '@\/app\/_components\/copy-button'/, `${rel}: Copy is not the shared CopyButton`);
  }
});

test('every photo a person keeps has a Save button', () => {
  for (const [rel, anchors] of Object.entries(SAVE)) {
    const src = read(rel);
    for (const a of anchors) assert.match(src, a, `${rel}: lost its Save (${a})`);
  }
});

test('no failure line still sends a person to press and hold — the long-press callout is gone', () => {
  for (const rel of ['app/_components/gallery/lightbox-save-button.tsx', 'app/[slug]/_components/story/save-all-own-photos.tsx']) {
    assert.doesNotMatch(read(rel), /press and hold/i, `${rel} tells a person to press and hold, which does nothing now`);
  }
});
