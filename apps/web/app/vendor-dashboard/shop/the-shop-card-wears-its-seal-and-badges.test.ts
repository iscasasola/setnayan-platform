/**
 * 🏅 THE SHOP'S OWN CARD WEARS THE APP-DRAWN SEAL AND BADGES (owner 17 Nov 2026, "badges and seal is still not visible";
 * the only seal he saw was the one baked into the cover photo).
 *
 * The public shop hero (`/v/[slug]`) and the Find card already draw the Setnayan Verified seal from data, and the
 * public gallery draws each card's J3 medals. The supplier's own Shop header and Shop › Services cards drew neither —
 * so the shop could not see what couples see. This guard holds both:
 *   1. the Shop header draws `ImageBadge` from `verifiedBadge()` when verified, the earned milestone/award circles
 *      (`shopBadges`, the same filter as the public hero), and the honest next step when none are earned yet;
 *   2. every Shop › Services card draws `CardBadgeRow` from the SAME read the public page makes
 *      (`readShopSeals` → `readCardBadges`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (p: string) => stripComments(readFileSync(path.join(here, p), 'utf8'));

test('the Shop header draws the app seal, the earned circles and the next step', () => {
  const cover = read('_components/shop-cover.tsx');
  assert.match(cover, /badgeImageOf\(verifiedBadge\(\)\)/, 'the Verified seal is the app-drawn ImageBadge');
  assert.match(cover, /data-shop-cover-seal="verified"/);
  assert.match(cover, /\(d\.earned \?\? \[\]\)\.map\(/, 'the earned circles are drawn');
  assert.match(cover, /d\.earned && d\.earned\.length === 0 && d\.nextBadge/, 'nothing earned → the next step is said');
  const page = read('page.tsx');
  assert.match(page, /shopBadges\(\{ \.\.\.facts, verified: false \}\)\.filter\(\(b\) => b\.kind === 'milestone' \|\| b\.kind === 'award'\)/);
  assert.match(page, /nextBadge: shelfNextBadgeLine\(badges\)/, 'the header’s next step is the Completed bookings tile’s own goal');
  assert.doesNotMatch(page, /nextBadgeShort\(/, 'a second ladder is back in the header');
  assert.match(page, /earned: data\.earned/);
});

test('each Shop › Services card draws its medals from the public read', () => {
  const m = read('../services/_components/services-manager.tsx');
  assert.match(m, /readShopSeals\(profile\.vendor_profile_id, shopVerified\)/);
  assert.match(m, /readCardBadges\(createAdminClient\(\), \{/);
  assert.match(m, /<CardBadgeRow badges=\{cardBadges\.byCard\[svc\.vendor_service_id\]!\}/);
});
