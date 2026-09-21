/**
 * every-qr-carries-the-strip.test.ts — every QR that is a LINK carries the one
 * control strip (Download · Write to NFC · Copy link); every QR that is NOT a
 * link carries none of it; and "Tag written" is decided by the tag, not by the
 * browser.
 *
 * ── Why a source guard ──────────────────────────────────────────────────────
 * Before 2026-09-20 each QR surface grew its own subset of controls, and the
 * next surface would have grown a fourth. The strip is one component, so the
 * only way to regress is to stop mounting it — which is what this pins, per
 * file, with the COUNT printed so a sabotage of one mount in a file with two
 * cannot hide behind the other (a file-level match cannot say which component
 * still holds a control; see CLAUDE.md "Traps").
 *
 * 🛡 Mutation-checked: each mount was deleted in turn and the count went red;
 * the payment-QR rule was broken by mounting the strip in the checkout drawer
 * and went red; the read-back rule was broken by setting `kind: 'written'`
 * straight after `write()` resolved and went red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const count = (src: string, needle: string) => src.split(needle).length - 1;

/** File → how many times it mounts the strip. Exactly, not at least. */
const STRIP_MOUNTS: Record<string, number> = {
  // Supplier side
  'app/vendor-dashboard/_components/qr-section.tsx': 1, // Shortlist QR (My Customers)
  'app/vendor-dashboard/invite/page.tsx': 2, // Shortlist + the just-issued Locked QR
  'app/vendor-dashboard/locked-qr/page.tsx': 1, // each pending Locked QR row
  'app/vendor-dashboard/on-the-day/_components/guest-review-qr.tsx': 1, // review QR
  // Couple side
  'app/dashboard/[eventId]/invitation/page.tsx': 2, // per-guest rows, table + list
  'app/dashboard/[eventId]/studio/custom-qr-guest/page.tsx': 1, // branded cards
  // The join-link QR — lives in the panel both the invite page and the
  // guest list's Share tab render, so it is ONE mount, not two.
  'app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx': 1,
  'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx': 1, // scan-to-view
  // The guest's own card in the roster (inspector + drawer render the same body)
  'app/dashboard/[eventId]/guests/_components/guest-detail-body.tsx': 1,
};

/** The guest's own code has its own pair of keepers; it gains the NFC button alone. */
const NFC_ONLY_MOUNTS: Record<string, number> = {
  'app/[slug]/_components/guest-code-keepers.tsx': 1,
};

/**
 * QRs that are NOT links: bank payment payloads (a phone tapping one would do
 * nothing) and the crew pairing QR, whose custom scheme iPhone ignores on a
 * background read. The strip must not appear on any of them.
 */
const NO_STRIP: string[] = [
  'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx',
  'app/pay/[reference]/_components/pay-panel.tsx',
  'app/_components/pabuya/pabuya-method-actions.tsx',
  'app/dashboard/[eventId]/event-qr/page.tsx',
];

test('every link-QR mounts the strip, exactly as many times as it has QRs', () => {
  const report: string[] = [];
  for (const [rel, expected] of Object.entries(STRIP_MOUNTS)) {
    const src = read(rel);
    const mounts = count(src, '<QrActions');
    report.push(`${rel}: ${mounts}/${expected}`);
    assert.equal(mounts, expected, `${rel} mounts <QrActions ${mounts}×, expected ${expected}`);
    assert.ok(src.includes("from '@/app/_components/qr-actions'"), `${rel} must import the strip`);
  }
  for (const [rel, expected] of Object.entries(NFC_ONLY_MOUNTS)) {
    const src = read(rel);
    const mounts = count(src, '<NfcWriteButton');
    report.push(`${rel}: ${mounts}/${expected} (NFC only)`);
    assert.equal(mounts, expected);
  }
  console.log(report.join('\n'));
});

test('a QR that is not a link carries none of the strip', () => {
  for (const rel of NO_STRIP) {
    const src = read(rel);
    assert.equal(count(src, '<QrActions'), 0, `${rel} must not mount the strip`);
    assert.equal(count(src, '<NfcWriteButton'), 0, `${rel} must not mount the NFC button`);
  }
});

test('the strip is Download · Write to NFC · Copy link, in that order', () => {
  const src = read('app/_components/qr-actions.tsx');
  const dl = src.indexOf('<Download');
  const nfc = src.indexOf('<NfcWriteButton');
  const copy = src.indexOf('<CopyButton');
  assert.ok(dl > 0 && nfc > dl && copy > nfc, `order was ${[dl, nfc, copy].join(',')}`);
});

test('"Tag written" is decided by the read-back, never by write() resolving', () => {
  const src = read('app/_components/nfc-write-button.tsx');
  assert.ok(src.includes('Write failed'), 'the failure headline');
  assert.ok(src.includes('Tag written'), 'the success headline');
  assert.ok(src.includes('Not confirmed'), 'the honest middle when no read-back arrives');
  // ONE success point for all three writers (app, web, check). The union type
  // names the state once; exactly one other place may produce it.
  const producers = [...src.matchAll(/kind: 'written'/g)].map((m) => m.index ?? -1);
  assert.equal(producers.length, 2, `'written' appears ${producers.length}× — a second producer is a second door to success`);
  const at = producers[1] ?? -1;
  const before = src.slice(Math.max(0, at - 160), at);
  assert.match(before, /readBackMatches\(found, target\)/, 'the only success sits behind the read-back');
  assert.doesNotMatch(before, /\.write\(/, 'success follows a write() directly');
  // Both writers reach it only through settle(found, …) after a READ.
  assert.equal(count(src, 'settle(found, target)'), 1);
  assert.match(src, /found = await nativeReadOnce\(/);
  assert.match(src, /found = await webReadOnce\(/);
  // The pure half reads no flag and no DOM.
  const pure = read('lib/nfc-tag.ts');
  assert.doesNotMatch(pure, /process\.env/);
  assert.doesNotMatch(pure, /\bwindow\b|\bdocument\b/);
  // And the button asks eligibility, so a non-link never gets an NFC button.
  assert.match(src, /nfcTagEligibility\(/);
});

test('the iOS app is allowed to write tags, and says why it asks', () => {
  const ent = readFileSync(join(WEB, '..', 'mobile/ios/App/App/App.entitlements'), 'utf8');
  assert.match(ent, /com\.apple\.developer\.nfc\.readersession\.formats<\/key>\s*<array>\s*<string>TAG<\/string>/);
  // "NDEF" is refused by App Store upload (ITMS-90778) — TAG covers NDEF sessions.
  assert.doesNotMatch(ent, /<string>NDEF<\/string>/);
  const plist = readFileSync(join(WEB, '..', 'mobile/ios/App/App/Info.plist'), 'utf8');
  assert.match(plist, /<key>NFCReaderUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/);
  const pkg = JSON.parse(readFileSync(join(WEB, '..', 'mobile/package.json'), 'utf8'));
  assert.ok(pkg.dependencies['@capgo/capacitor-nfc'], 'the native plugin ships in the app');
  const spm = readFileSync(join(WEB, '..', 'mobile/ios/App/CapApp-SPM/Package.swift'), 'utf8');
  assert.match(spm, /CapgoCapacitorNfc/, 'cap sync wired it into the iOS package');
  const gradle = readFileSync(join(WEB, '..', 'mobile/android/capacitor.settings.gradle'), 'utf8');
  assert.match(gradle, /capgo-capacitor-nfc/, 'cap sync wired it into the Android build');
});
