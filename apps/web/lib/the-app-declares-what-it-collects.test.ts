/**
 * the-app-declares-what-it-collects.test.ts — the iOS app's own declarations
 * must keep matching what we told Apple on the App Privacy page.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * On 2026-09-20, submitting v1.0, the App Store Connect privacy page said
 * "Data Not Linked to You" while `PrivacyInfo.xcprivacy` inside the shipped
 * build declared email, name and photos as LINKED. Two answers to one
 * question, and only a human comparing two screens caught it.
 *
 * 🔑 LOCATION IS THE ONE THAT CAN GO WRONG SILENTLY. The web app DOES collect
 * precise location in one place — Papic capture stamps lat/lon on a photo when
 * the `papic_geo_metadata` control is active (it is), and that route is NOT
 * blocked in the store shell. It never reaches the app only because the iOS
 * project has NO location usage string, so iOS refuses the WebView's request.
 * That is the entire reason we answered "no location" to Apple. The day
 * somebody adds `NSLocationWhenInUseUsageDescription` — a one-line change that
 * looks harmless — that answer becomes false, nobody is told, and the App
 * Privacy page is wrong until a reviewer notices.
 *
 * So: adding a location usage string is allowed, but it must be a deliberate
 * act that also updates the App Store answers. This test is the tripwire.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'mobile');
const INFO_PLIST = join(MOBILE, 'ios/App/App/Info.plist');
const PRIVACY_MANIFEST = join(MOBILE, 'ios/App/App/PrivacyInfo.xcprivacy');

/**
 * What Apple is told on the App Privacy page — the SAME list the manifest
 * declares. Every one app-functionality, no tracking, NO location.
 *
 * ⚠ CHANGED 2026-10-19 (Apple check row #22). The page published 2026-09-20
 * listed only Email, Name and Photos/Videos (all linked). Read against the
 * code, the app also collects a phone number, an account id, in-app messages,
 * other user content, support requests, order records, a supplier's bank
 * proof, religion (with consent), dietary needs/allergies and birth dates —
 * all linked — plus crash and performance reports that are NOT linked (Sentry
 * attaches no user). The manifest now says so, and so does this list.
 * 🔑 THE OWNER MUST ENTER THE SAME ANSWERS IN APP STORE CONNECT → App Privacy
 * before submitting the next build; a manifest change ships only in a NEW
 * BUILD. Until both are done, the two disagree — which is the failure this
 * file exists to catch.
 */
const DECLARED_TO_APPLE = {
  linkedTypes: [
    'EmailAddress',
    'Name',
    'PhotosorVideos',
    'PhoneNumber',
    'UserID',
    'EmailsOrTextMessages',
    'OtherUserContent',
    'CustomerSupport',
    'PurchaseHistory',
    'OtherFinancialInfo',
    'SensitiveInfo',
    'Health',
    'OtherDataTypes',
  ],
  notLinkedTypes: ['CrashData', 'PerformanceData'],
  tracking: false,
  location: false,
} as const;

function plist(path: string): string {
  return readFileSync(path, 'utf8');
}

test('no location permission — the reason we answered "no location" to Apple', () => {
  const info = plist(INFO_PLIST);
  const keys = [...info.matchAll(/<key>(NSLocation[A-Za-z]*)<\/key>/g)].map((m) => m[1]);
  assert.deepEqual(
    keys,
    [],
    `The iOS app now asks for location (${keys.join(', ')}).\n` +
      `That is allowed — but Papic capture DOES stamp lat/lon, and it is reachable in the\n` +
      `shell, so location would now be collected from the app. Before merging this:\n` +
      `  1. App Store Connect → App Privacy → add Precise Location (linked, App Functionality).\n` +
      `  2. Add it to PrivacyInfo.xcprivacy as well.\n` +
      `  3. Update DECLARED_TO_APPLE in this test to match.`,
  );
});

test("the app's privacy manifest still says what we told Apple", () => {
  const manifest = plist(PRIVACY_MANIFEST);
  // Only the VALUE of an NSPrivacyCollectedDataType key — not every string in
  // the file, which also holds Linked/Tracking/Purposes and their values.
  // Each entry: its type and its Linked flag, read from the same <dict>.
  const entries = [
    ...manifest.matchAll(
      /<key>NSPrivacyCollectedDataType<\/key>\s*<string>NSPrivacyCollectedDataType([A-Za-z]+)<\/string>\s*<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<(true|false)\/>/g,
    ),
  ].map((m) => ({ type: m[1]!, linked: m[2] === 'true' }));
  const allTypes = [
    ...manifest.matchAll(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>NSPrivacyCollectedDataType([A-Za-z]+)<\/string>/g),
  ].map((m) => m[1]);
  assert.equal(entries.length, allTypes.length, 'a collected type has no Linked flag right after it');
  assert.deepEqual(
    entries.filter((e) => e.linked).map((e) => e.type).sort(),
    [...DECLARED_TO_APPLE.linkedTypes].sort(),
    'the manifest declares a different set of LINKED data types than Apple is told',
  );
  assert.deepEqual(
    entries.filter((e) => !e.linked).map((e) => e.type).sort(),
    [...DECLARED_TO_APPLE.notLinkedTypes].sort(),
    'the manifest declares a different set of NOT-linked data types than Apple is told',
  );
  // And nothing is declared for tracking.
  const trackingTrue = manifest.match(/NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/g) ?? [];
  assert.equal(trackingTrue.length, 0, 'tracking declared in the manifest, but Apple was told none');
  assert.match(manifest, /NSPrivacyTracking<\/key>\s*<false\/>/);
  assert.equal(DECLARED_TO_APPLE.tracking, false);
  assert.equal(DECLARED_TO_APPLE.location, false);
});

test('every permission the app asks for still has a reason a person can read', () => {
  const info = plist(INFO_PLIST);
  // NFC's key is NFCReaderUsageDescription — it does NOT start with NS, and a
  // pattern that assumed it did counted 4 of the 5 strings.
  const pairs = [...info.matchAll(/<key>((?:NS|NFC)[A-Za-z]*UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g)];
  assert.ok(pairs.length >= 5, `expected the camera/mic/photos/NFC strings, found ${pairs.length}`);
  for (const [, key, text] of pairs) {
    assert.ok((text ?? '').length > 30, `${key} is too vague for App Review: "${text}"`);
    assert.match(text ?? '', /Setnayan/, `${key} should name the app and what it does`);
  }
});
