/**
 * A8·F-5 (final check 25 Nov). "Live Watch channels" sat in the Setup menu while its page answers 404 with the flag
 * off (`app/admin/live-studio-channels/page.tsx`: `if (!liveStudioRoamEnabled()) notFound()`). The view keeps its
 * home (so `admin-pages.test.ts` "every admin page on disk has a home" still holds) but carries `notInMenus` from the
 * SAME flag, and the Setup dropdown drops such views. Runs with the flag unset, CI's default.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('flag off: the Live Watch view keeps its home but no menu offers it', async () => {
  assert.equal(process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED ?? '', '', 'this test needs the flag unset');
  const { ADMIN_MERGED_PAGES } = await import('./admin-pages');
  const view = ADMIN_MERGED_PAGES.flatMap((p) => p.views).find((v) => v.key === 'live-watch');
  assert.ok(view, 'the view still has its home');
  assert.equal(view!.notInMenus, true);
});

test('the menu flag reads the same variable as the page gate', () => {
  const pages = readFileSync(resolve(web, 'lib/admin/admin-pages.ts'), 'utf8');
  const roam = readFileSync(resolve(web, 'lib/live-studio-roam.ts'), 'utf8');
  assert.match(roam, /envFlagEnabled\(process\.env\.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED\)/);
  assert.match(pages, /notInMenus: !envFlagEnabled\(process\.env\.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED\)/);
});

test('the Setup dropdown drops a view marked notInMenus', () => {
  const rows = stripComments(readFileSync(resolve(web, 'app/admin/_components/admin-tab-rows.tsx'), 'utf8'));
  assert.match(rows, /const SETUP_OPTIONS = [\s\S]*?p\.views\.filter\(\(v\) => !v\.notInMenus\)/);
});
