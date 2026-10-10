/**
 * 🎚 scrub-fixture-page.tsx — writes THE REAL GUEST PAGE as static pages a real browser can play: `SiteBody` itself
 * (`app/[slug]/_components/site-body.tsx`), drawn for the fixture invitation through `lib/site-body-fixture-render.ts`
 * (read that file's docblock for what the render is and is not). Used by `scripts/scrub-browser-check.mjs` (16): the
 * cover as hand-over zero ON THE REAL PAGE'S OWN MARKUP — its groups, its chapters, its `space-y-12`, its pinned bar.
 *
 *   tsx scripts/scrub-fixture-page.tsx <out-dir> <island.js>
 *
 * WRITES, into <out-dir> (every page is a Pro event: Scrub is an Event Hub Pro arrangement):
 *   fixture-today.html             the fixture page AS IT IS TODAY — the cover stored to leave by Scrub, "Scrub out"
 *                                  NOT offered (`lib/scrub-out-offered.ts`). No script of ours.
 *   fixture-cover-plain.html       the same stored page with "Scrub out" OFFERED, and no script of ours: what a guest
 *                                  with no script, or who asked for less motion, is given. It must LOOK like today's.
 *   fixture-cover.html             …offered, and armed by the page's own island (`hub-scrub.tsx`).
 *   fixture-cover-reveal.html      …the same, with the Reveal's mark on the page before the island mounts.
 *   fixture-cover-scene.html       …and the Schedule stored to leave by Scrub too (it is on Details: another tab).
 *   fixture-cover-scene-details.html   …the same page OPENED ON DETAILS (the cover's tab is not the one shown).
 *
 * 🚪 THE DOOR. "Scrub out" is a constant and it is off; `SiteBody` takes no prop for it and this script must not need
 * one. So, FOR THIS PROCESS ONLY, the module that holds the constant is handed to the page with the constant read
 * from a switch of this script's (through the `Module._load` door the fixture helper itself uses). Nothing is written
 * to any file of the app, and nothing under `app/` or `lib/` can reach this door: it is this script's own.
 * (`lib/scrub-out-ships-dark.test.ts` (4): the lab's doors are used under `app/dev/` and `scripts/` only.)
 *
 * WHAT IS NOT REAL: the document shell. The fixture render is the body `SiteBody` returns; the page around it here is
 * this script's — the app's stylesheet compiled by the caller for these pages only (`tailwindcss`, the app's own
 * config), the look's root class (`sn-editorial`, as `guest-look-scope.tsx` writes it), no fonts, no layout chrome,
 * no hydration. The island is mounted by the check's own bundle (`scripts/scrub-check-island.tsx`), as on its other pages.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* THE DOOR — before anything that draws the guest page is loaded. */
let offered = false;
{
  const Mod = require('node:module') as { _load: (request: string, parent: unknown, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  let handed: Record<string, unknown> | null = null;
  Mod._load = function (this: unknown, request: string, parent: unknown, ...rest: unknown[]) {
    const real = load.call(this, request, parent, ...rest);
    if (!/(?:^|\/)scrub-out-offered$/.test(request)) return real;
    if (!handed) {
      handed = {};
      for (const key of Object.keys(real as object)) {
        Object.defineProperty(handed, key, { enumerable: true, get: () => (key === 'SCRUB_OUT_OFFERED' ? offered : (real as Record<string, unknown>)[key]) });
      }
      if (!('SCRUB_OUT_OFFERED' in handed)) throw new Error('scrub-fixture-page: lib/scrub-out-offered.ts no longer exports SCRUB_OUT_OFFERED — this door opens nothing');
    }
    return handed;
  };
}

/* After the door: the fixture helper installs its own seam as it loads (the database client, the island's count). */
const { renderSiteBodyFixtureFull } = require('../lib/site-body-fixture-render') as typeof import('../lib/site-body-fixture-render');
const { fixtureWidgets } = require('../lib/site-body-fixture') as typeof import('../lib/site-body-fixture');
const { LAB_SCRUB_COVER, LAB_SCRUB_SAMPLE } = require('../app/dev/maker-lab/lab-scrub') as typeof import('../app/dev/maker-lab/lab-scrub');

const [, , outDir, island] = process.argv;
if (!outDir || !island) {
  console.error('usage: tsx scripts/scrub-fixture-page.tsx <out-dir> <island.js>');
  process.exit(2);
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

type Page = { file: string; offered: boolean; widgets: ReturnType<typeof fixtureWidgets>; activeTab?: string; script: 'none' | 'island' | 'island-under-reveal' };
const cover = () => fixtureWidgets({ hero: LAB_SCRUB_COVER });
const coverAndScene = () => fixtureWidgets({ hero: LAB_SCRUB_COVER, schedule: LAB_SCRUB_SAMPLE.schedule });
const PAGES: Page[] = [
  { file: 'fixture-today.html', offered: false, widgets: cover(), script: 'none' },
  { file: 'fixture-cover-plain.html', offered: true, widgets: cover(), script: 'none' },
  { file: 'fixture-cover.html', offered: true, widgets: cover(), script: 'island' },
  { file: 'fixture-cover-reveal.html', offered: true, widgets: cover(), script: 'island-under-reveal' },
  { file: 'fixture-cover-scene.html', offered: true, widgets: coverAndScene(), script: 'island' },
  { file: 'fixture-cover-scene-details.html', offered: true, widgets: coverAndScene(), activeTab: 'details', script: 'island' },
];

async function main() {
  for (const page of PAGES) {
    offered = page.offered;
    const drawn = await renderSiteBodyFixtureFull({ proWatermarkHidden: true, widgets: page.widgets, ...(page.activeTab ? { activeTab: page.activeTab } : {}) });
    offered = false;
    if (drawn.complaints.length) throw new Error(`scrub-fixture-page: ${page.file} — the page complained while rendering: ${drawn.complaints[0]}`);
    const cells = count(drawn.html, 'class="hub-cover-cell');
    /* Fail loudly: a page that was meant to hand its cover over and does not is not a page this check may play. */
    if (page.offered !== (cells === 1)) throw new Error(`scrub-fixture-page: ${page.file} — ${cells} cover cell(s) drawn with "Scrub out" ${page.offered ? 'offered' : 'not offered'}`);
    const scripts =
      page.script === 'none'
        ? ''
        : `${page.script === 'island-under-reveal' ? `<script>document.documentElement.setAttribute('data-reveal-up', '');</script>` : ''}<script src="file://${island}"></script>`;
    writeFileSync(
      join(outDir, page.file),
      `<!doctype html><html lang="en"><head><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="file://${join(outDir, 'fixture.css')}">
<style>#line{position:fixed;left:0;right:0;top:50%;border-top:1.5px dashed rgba(194,78,36,.6);pointer-events:none;z-index:99}</style></head>
<body><div id="line"></div><div class="sn-editorial contents">${drawn.html}</div>
${scripts}
</body></html>`,
    );
    console.log('wrote', page.file, '·', drawn.html.length, 'bytes ·', count(drawn.html, 'class="hub-page-cell"'), 'page pair(s) ·', cells, 'cover cell ·', drawn.mounts.HubScrub, 'island mount(s)');
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
