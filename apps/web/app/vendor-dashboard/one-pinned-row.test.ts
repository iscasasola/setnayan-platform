/**
 * GUARD — ONE BACK CONTROL AND A VISIBLE TITLE ON EVERY SUPPLIER PAGE (final check B18 · B5-26; drawing
 * `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html` § B18, approved by the owner 25 Nov).
 *
 * Every supplier page with a way back wears the one shipped pinned row, `ToolPin` (`_components/tool-page.tsx`): on a
 * phone a 40 round ‹ in a 44 press and the title at 22 bold; from the tablet line "‹ Label" and the title at 26. The grey
 * "← Today" / "← Shop" boxes, the "‹ Your requests" link and the screen-reader-only titles are gone from these pages.
 * Where each ‹ goes is still `lib/page-home.ts` (`pageBackLink`). Pages that rise as a layer (the card maker, Tell us
 * what you do, Team's sections, Theft Watch, Track record) are named by the layer's head instead.
 *
 * Sabotage: put a page back on `<PageMasthead>` or an `sr-only` h1 (1 red) · draw the pill `BackButton` beside the row
 * (1 red) · hide the row's title (`sr-only` on its h1) (1 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (f: string) => stripComments(readFileSync(join(import.meta.dirname, f), 'utf8'));

/** The page (route on disk) → the file that draws its pinned row, and the title it reads. */
const PAGES: ReadonlyArray<readonly [route: string, file: string, title: string]> = [
  ['/vendor-dashboard/profile', 'profile/_components/details-screen.tsx', '"Your details"'],
  ['/vendor-dashboard/settings', 'settings/settings-view.tsx', '"Settings"'],
  ['/vendor-dashboard/team', 'team/_components/helpers-view.tsx', '"Team"'],
  ['/vendor-dashboard/services/their-work', 'services/their-work/page.tsx', '"Their work"'],
  ['/vendor-dashboard/spaces', 'spaces/page.tsx', '"Spaces"'],
  ['/vendor-dashboard/deep-search', 'deep-search/page.tsx', '"Deep Search"'],
  ['/vendor-dashboard/packages', 'packages/page.tsx', '"Packages"'],
  ['/vendor-dashboard/collections/albums', 'collections/albums/page.tsx', '"Albums by event"'],
  ['/vendor-dashboard/partnerships', 'partnerships/page.tsx', '"Partnerships"'],
  ['/vendor-dashboard/services/requests', 'services/requests/_components/your-requests-view.tsx', '"Your requests"'],
  ['/vendor-dashboard/services/requests/[requestId]', 'services/requests/_components/request-detail-view.tsx', '{title}'],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('B18 · each page draws the one pinned row with its own route and a title', () => {
  for (const [route, file, title] of PAGES) {
    const code = read(file);
    assert.match(code, new RegExp(`<ToolPin route="${esc(route)}"[^>]*title=${esc(title)}`), `${file}: no pinned row for ${route}`);
    assert.equal((code.match(/<ToolPin\b/g) ?? []).length, 1, `${file}: more than one pinned row`);
  }
});

test('B18 · no second title and no old back beside the row', () => {
  for (const [, file] of PAGES) {
    const code = read(file);
    assert.doesNotMatch(code, /<PageMasthead\b/, `${file}: the title is screen-reader only again`);
    assert.doesNotMatch(code, /<h1\b/, `${file}: a second title beside the pinned row`);
    assert.doesNotMatch(code, /<BackButton\b/, `${file}: the grey back box is back`);
    assert.doesNotMatch(code, /icon=\{<ChevronLeft[^}]*\}[^>]*label="Your requests"/, `${file}: the "‹ Your requests" link is back`);
  }
  for (const page of ['profile/page.tsx', 'settings/page.tsx', 'team/page.tsx']) {
    assert.doesNotMatch(read(page), /<BackButton\b/, `${page}: a second back above the screen`);
  }
});

test('B18 · the row’s title is seen, not screen-reader only, at the drawing’s sizes', () => {
  const pin = read('_components/tool-page.tsx');
  const fn = pin.slice(pin.indexOf('export function ToolPin'), pin.indexOf('export function ToolSection'));
  const h1 = fn.match(/<h1 className="([^"]+)">\s*\{title\}/);
  assert.ok(h1, 'the pinned row draws no title');
  assert.doesNotMatch(h1[1]!, /sr-only|hidden/, 'the title is hidden');
  assert.match(h1[1]!, /text-\[22px\] font-bold/);
  assert.match(h1[1]!, /tab:text-\[26px\]/);
  assert.match(fn, /<BackButton route=\{route\} params=\{params\} variant="tool"/, 'the ‹ is not the shared tool back');
});

test('B18 · a request’s ‹ still goes to Your requests (the map, not a typed link)', async () => {
  const { pageBackLink } = await import('@/lib/page-home');
  assert.deepEqual(pageBackLink('/vendor-dashboard/services/requests/[requestId]', { requestId: 'r1' }), {
    href: '/vendor-dashboard/services/requests',
    label: 'Your requests',
  });
  assert.equal(pageBackLink('/vendor-dashboard/services/their-work')?.href, '/vendor-dashboard/shop', 'Their work’s ‹ moved');
  assert.equal(pageBackLink('/vendor-dashboard/spaces')?.href, '/vendor-dashboard/shop', 'Spaces’ ‹ moved');
  assert.equal(pageBackLink('/vendor-dashboard/collections/albums')?.href, '/vendor-dashboard/collections', 'Albums’ ‹ moved');
});
