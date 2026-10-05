/**
 * capture-theme-samples.ts — photograph the curated sample Event Hub in every
 * ready theme, for the Maker's Details theme gallery (owner 2026-09-28,
 * DECISION_LOG "THE THEME GALLERY SHOWS A CLEAN SAMPLE EVENT HUB").
 *
 *   BASE=https://www.setnayan.com pnpm capture:theme-samples          # every ready theme
 *   BASE=https://www.setnayan.com pnpm capture:theme-samples vintage  # one
 *
 * Writes `public/theme-samples/<id>.webp` and its row in
 * `lib/theme-sample-stills.manifest.json`: `look` (the theme's code-side hash —
 * `theme-sample-stills-are-current.test.ts` fails when it moves) and `sample`
 * (a hash of the sample's own Classic invitation, drawn by the sample print
 * door — so the next capture can see the sample's content changed).
 *
 * ⛔ ONLY AGAINST A SERVER WITH THE REAL SAMPLE. The page is the pinned
 * `is_sample` row (`/maria-and-jose`); a server without it 404s, and this
 * script then refuses to write anything. Local dev with only the anon key
 * cannot render it (the page reads through the admin client) — capture from
 * production once the `theme=`-on-the-sample change is live there.
 *
 * Same geometry as the tile: a phone (390 × 760 CSS px) at 2×, stored at 360 px
 * wide — a tile draws it at up to ~180 px, so 2× is exactly sharp.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { chromium } from '@playwright/test';

import { INVITE_THEMES, isInviteThemeId, type InviteThemeId } from '../lib/invite-themes';
import { SAMPLE_HUB_PATH, sampleHubTileSrc, type ThemeStillManifest } from '../lib/theme-sample-stills';
import { doorCssOf, themeLookHash } from '../lib/theme-sample-stills-hash';

const WEB = join(__dirname, '..');
const OUT = join(WEB, 'public', 'theme-samples');
const MANIFEST = join(WEB, 'lib', 'theme-sample-stills.manifest.json');
const BASE = process.env.BASE;
const W = 390;
const H = 760;
const STORED_W = 360;

async function main() {
  if (!BASE) throw new Error('Set BASE to a server with the real sample, e.g. BASE=https://www.setnayan.com');
  const only = process.argv.slice(2);
  const ids = (Object.keys(INVITE_THEMES) as InviteThemeId[]).filter(
    (id) => INVITE_THEMES[id].ready && (!only.length || only.includes(id)),
  );
  for (const id of only) if (!isInviteThemeId(id)) throw new Error(`No such theme: ${id}`);

  // The sample's content, as the sample print door draws it — refuses without the real sample.
  const probe = await fetch(`${BASE}/api/hub-print/invitation?sample=1&mode=screen&theme=house`, { redirect: 'follow' });
  if (!probe.ok) throw new Error(`The sample print door answered ${probe.status} — this server has no sample (or the change is not live).`);
  const sample = createHash('sha256').update(await probe.text()).digest('hex').slice(0, 16);

  const manifest: ThemeStillManifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    for (const id of ids) {
      // 🎨 `none`: each theme in its OWN colours — what the gallery shows an empty board (2026-10-05).
      const res = await page.goto(`${BASE}${sampleHubTileSrc(id, 'none')}`, { waitUntil: 'networkidle' });
      if (!res || !res.ok()) throw new Error(`${SAMPLE_HUB_PATH} in ${id} answered ${res?.status()} — nothing written.`);
      await page.waitForTimeout(1500); // the hero's entrance settles
      const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
      const webp = await sharp(shot).resize({ width: STORED_W }).webp({ quality: 72 }).toBuffer();
      writeFileSync(join(OUT, `${id}.webp`), webp);
      manifest[id] = { look: themeLookHash(id, doorCssOf(id, WEB)), sample, capturedAt: new Date().toISOString() };
      console.log(`[theme stills] ${id}: ${(webp.length / 1024).toFixed(1)} KB`);
    }
  } finally {
    await browser.close();
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
