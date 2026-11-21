/**
 * raw-hex-only-goes-down.test.ts — 🌙 THE SUPPLIER DASHBOARD PAINTS FROM TOKENS; A RAW HEX CAN ONLY BE REMOVED.
 *
 * The supplier dashboard opened to dark on 18 Nov 2026 (owner: "do supplier navy dark next"), in its own navy
 * (`_components/supplier-look.css`, tokens only). A colour typed as a hex in a screen file does not follow the theme —
 * it stays the light value on the navy. Each area's count of raw hex literals may only go DOWN from
 * `raw-hex.baseline.json` (the counter and its rules: `lib/raw-hex-ratchet.ts`).
 *
 * WHAT IS LEFT IN THE BASELINE: `_components/supplier-look.css` itself (the look's own token values — the one place a
 * supplier colour is written), art and the person's own colours (logo and print grounds, QR and camera drawings),
 * print routes that are always light, and status tones that carry their dark pair beside them.
 *
 * TO LOWER A COUNT: `WRITE_HEX_BASELINE=1 pnpm exec tsx --test app/vendor-dashboard/raw-hex-only-goes-down.test.ts`
 * (it refuses to raise any number). Never edit the JSON by hand to go green.
 */
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertHexOnlyGoesDown } from '@/lib/raw-hex-ratchet';

const HERE = dirname(fileURLToPath(import.meta.url));

test('the supplier dashboard: raw hex colours per area only go down', () => {
  // Three areas is the floor here: this tree was already almost hex-free, and `_components` (the look's own token file) always has some.
  assertHexOnlyGoesDown(HERE, join(HERE, 'raw-hex.baseline.json'), '18 Nov 2026', 3);
});
