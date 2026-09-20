/**
 * "Write to NFC" launch flag.
 *
 * OFF by default. The button that writes a QR's link onto an NFC sticker is
 * built against the Web NFC spec but cannot be proven from a session — it needs
 * one real Android phone and one blank sticker. The flag lets the PR merge and
 * deploy safely; the owner flips it to `true` after the first confirmed tap.
 *
 * Only the NFC button is behind it. Download and Copy link on the same strip
 * are not — they work everywhere today.
 *
 * NEXT_PUBLIC_ because the reader is a client component; the value is inlined
 * at build time, so it is passed as the literal expression per lib/env-flag.ts.
 */
import { envFlagEnabled } from './env-flag';

export function isNfcWriteEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_NFC_WRITE_ENABLED);
}

// ── Per-phone test switch ──────────────────────────────────────────────────
//
// The owner has only an iPhone, and iPhone writes tags only INSIDE the app,
// which loads the live site — where the flag is OFF. Turning the flag on for
// everyone to test one phone would ship an unproven button to every user.
//
// So one phone can opt in by opening a link with `?nfc-test=1` (inside the
// app: `setnayan://vendor-dashboard/customers?nfc-test=1`), and opt out with
// `?nfc-test=0`. The choice lives in that phone's localStorage only. It
// exposes nothing new: the button writes the viewer's OWN public links onto
// their OWN sticker, and the desk reads tags for an event the viewer already
// runs.

export const NFC_TEST_PARAM = 'nfc-test';
export const NFC_TEST_STORAGE_KEY = 'setnayan:nfc-test';

/**
 * Pure: what this phone's opt-in is, given the page's query string and what
 * is stored. `store` says what to persist ('keep' = leave storage alone).
 */
export function resolveNfcTestOptIn(
  search: string,
  stored: string | null,
): { on: boolean; store: '1' | 'clear' | 'keep' } {
  const v = new URLSearchParams(search).get(NFC_TEST_PARAM);
  if (v === '1') return { on: true, store: '1' };
  if (v === '0') return { on: false, store: 'clear' };
  return { on: stored === '1', store: 'keep' };
}
