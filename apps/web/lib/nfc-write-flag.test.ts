/**
 * nfc-write-flag.test.ts — the per-phone test switch opts ONE phone in, and
 * nothing else turns it on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNfcTestOptIn } from './nfc-write-flag';

test('?nfc-test=1 opts this phone in and remembers it', () => {
  assert.deepEqual(resolveNfcTestOptIn('?nfc-test=1', null), { on: true, store: '1' });
  assert.deepEqual(resolveNfcTestOptIn('?tab=qr&nfc-test=1', null), { on: true, store: '1' });
});

test('?nfc-test=0 opts it back out and forgets it', () => {
  assert.deepEqual(resolveNfcTestOptIn('?nfc-test=0', '1'), { on: false, store: 'clear' });
});

test('without the parameter, only a stored "1" counts', () => {
  assert.deepEqual(resolveNfcTestOptIn('', '1'), { on: true, store: 'keep' });
  assert.deepEqual(resolveNfcTestOptIn('', null), { on: false, store: 'keep' });
  assert.deepEqual(resolveNfcTestOptIn('?nfc-test=true', null), { on: false, store: 'keep' });
  assert.deepEqual(resolveNfcTestOptIn('?nfc-test=yes', 'yes'), { on: false, store: 'keep' });
  assert.deepEqual(resolveNfcTestOptIn('', 'true'), { on: false, store: 'keep' });
});

test('the switch is captured at the root, so it works from any page', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const layout = readFileSync(join(web, 'app/layout.tsx'), 'utf8');
  assert.equal(layout.split('<NfcTestSwitch />').length - 1, 1, 'mounted exactly once in the root layout');
});
