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
