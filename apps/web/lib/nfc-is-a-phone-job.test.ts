/**
 * nfc-is-a-phone-job.test.ts — writing a tag belongs on a phone, and a
 * desktop is told so in those words rather than being called unsupported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nfcDeviceKind, nfcWrongDeviceCopy } from './nfc-tag';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';

test('a phone is a phone, by user-agent or by touch', () => {
  assert.equal(nfcDeviceKind({ coarsePointer: true, maxTouchPoints: 5, userAgent: IPHONE, screenWidth: 393 }), 'phone');
  assert.equal(nfcDeviceKind({ coarsePointer: true, maxTouchPoints: 5, userAgent: ANDROID, screenWidth: 412 }), 'phone');
  // iPadOS claims to be a Mac; touch + a tablet-sized screen gives it away.
  assert.equal(nfcDeviceKind({ coarsePointer: true, maxTouchPoints: 5, userAgent: IPAD, screenWidth: 1024 }), 'phone');
});

test('a laptop is a desktop, even a touchscreen one that is too wide', () => {
  assert.equal(nfcDeviceKind({ coarsePointer: false, maxTouchPoints: 0, userAgent: MAC, screenWidth: 1512 }), 'desktop');
  assert.equal(nfcDeviceKind({ coarsePointer: true, maxTouchPoints: 10, userAgent: MAC, screenWidth: 1920 }), 'desktop');
  // A desktop Chrome pretending nothing: no touch, no coarse pointer.
  assert.equal(nfcDeviceKind({ coarsePointer: false, maxTouchPoints: 0, userAgent: '', screenWidth: 1280 }), 'desktop');
});

test('each device is told the right thing, and never a bare "unsupported"', () => {
  const desktop = nfcWrongDeviceCopy('desktop', false);
  assert.match(desktop, /phone/i);
  assert.match(desktop, /computer has no NFC writer/i);
  assert.doesNotMatch(desktop, /unsupported/i);
  const iphone = nfcWrongDeviceCopy('phone', true);
  assert.match(iphone, /Setnayan app/);
  const android = nfcWrongDeviceCopy('phone', false);
  assert.match(android, /Chrome/);
  assert.notEqual(desktop, iphone);
  assert.notEqual(iphone, android);
});

test('the sheet asks the device, and says "Do this on your phone"', () => {
  const src = readFileSync(join(WEB, 'app/_components/nfc-write-button.tsx'), 'utf8');
  assert.match(src, /nfcDeviceKind\(readDeviceEnv\(\)\)/);
  assert.match(src, /Do this on your phone/);
  assert.match(src, /nfcWrongDeviceCopy\(device, isIosBrowser\(\)\)/);
});
