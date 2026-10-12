/**
 * 🎚 scrub-fixture-page.tsx — writes THE REAL GUEST PAGE as static pages a real browser can play: `SiteBody` itself
 * (`app/[slug]/_components/site-body.tsx`), drawn for the fixture invitation through `lib/site-body-fixture-render.ts`
 * (read that file's docblock for what the render is and is not). Used by `scripts/scrub-browser-check.mjs` (16): the
 * cover as hand-over zero ON THE REAL PAGE'S OWN MARKUP — its groups, its chapters, its `space-y-12`, its pinned bar.
 *
 *   tsx scripts/scrub-fixture-page.tsx <out-dir> <island.js> <door.js>
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
 *   fixture-norow-today.html · fixture-cover-norow-plain.html · fixture-cover-norow.html
 *                                  the same three for A GUEST WHOSE REPLY ROW DRAWS NOTHING (no reply status at all:
 *                                  the page has no action to offer them) — the cover's group ends with the cover.
 *   fixture-stranger-today.html · fixture-stranger-cover-plain.html · fixture-stranger-cover.html
 *                                  THE STRANGER'S TREE (the link and no key): the text-only cover, the door after it.
 *   fixture-stranger-photo-today.html · fixture-stranger-photo-cover-plain.html · fixture-stranger-photo-cover.html
 *                                  …and the stranger's photo cover: the last thing in the page's first group.
 *   fixture-stranger-today-fit.html · fixture-stranger-cover-fit.html
 *                                  the text-only stranger's page WITH THE FIRST-SCREEN FIT RUNNING (`first-screen-door.tsx`,
 *                                  mounted by <door.js>): today's page as a short phone draws it, and the wrapped one —
 *                                  THE REAL STRANGER'S PAGE (every stranger's page runs the door's fit).
 *   fixture-stranger-photo-today-fit.html · fixture-stranger-photo-cover-fit.html
 *                                  …the same for the stranger's photo cover (the fit finds no card to fit there).
 *   fixture-photo-today.html · fixture-photo-cover-plain.html · fixture-photo-cover.html
 *                                  📐 THE GUEST'S PHOTO COVER (2026-10-12, "the cover is fitted before it fades"): the
 *                                  guest tree with a hero photo — the cover plate under the names.
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
const { fixtureStranger, fixtureWidgets, siteBodyFixtureProps } = require('../lib/site-body-fixture') as typeof import('../lib/site-body-fixture');
const { LAB_SCRUB_COVER, LAB_SCRUB_SAMPLE } = require('../app/dev/maker-lab/lab-scrub') as typeof import('../app/dev/maker-lab/lab-scrub');

const [outDir, island, doorJs] = (() => {
  const [, , dir, js, door] = process.argv;
  if (!dir || !js || !door) {
    console.error('usage: tsx scripts/scrub-fixture-page.tsx <out-dir> <island.js> <door.js>');
    process.exit(2);
  }
  return [dir, js, door] as const;
})();

const count = (html: string, needle: string) => html.split(needle).length - 1;

type Page = { file: string; offered: boolean; widgets: ReturnType<typeof fixtureWidgets>; activeTab?: string; noRow?: boolean; stranger?: 'text' | 'photo'; photo?: boolean; script: 'none' | 'island' | 'island-under-reveal' | 'door' | 'island-and-door' };
/** The fixture's guest with NO reply status: `resolveArrivalAction` has nothing to say to them, so no row is drawn.
 *  ⚠ A state the guest row's own type does not allow (`rsvp_status` is never null there) — forced here on purpose, as
 *  the one way to draw the guest tree with nothing after its cover: the page must not fade its cover to nothing even
 *  then. Not a claim that a real guest is ever in it. */
const guestWithNoRow = () => {
  const { identity } = siteBodyFixtureProps();
  if (identity.kind !== 'guest') throw new Error('scrub-fixture-page: the fixture identity is no longer a guest');
  return { ...identity, guest: { ...identity.guest, rsvp_status: null } } as unknown as typeof identity;
};
const cover = () => fixtureWidgets({ hero: LAB_SCRUB_COVER });
const coverAndScene = () => fixtureWidgets({ hero: LAB_SCRUB_COVER, schedule: LAB_SCRUB_SAMPLE.schedule });
const PAGES: Page[] = [
  { file: 'fixture-today.html', offered: false, widgets: cover(), script: 'none' },
  { file: 'fixture-cover-plain.html', offered: true, widgets: cover(), script: 'none' },
  { file: 'fixture-cover.html', offered: true, widgets: cover(), script: 'island' },
  { file: 'fixture-cover-reveal.html', offered: true, widgets: cover(), script: 'island-under-reveal' },
  { file: 'fixture-cover-scene.html', offered: true, widgets: coverAndScene(), script: 'island' },
  { file: 'fixture-cover-scene-details.html', offered: true, widgets: coverAndScene(), activeTab: 'details', script: 'island' },
  { file: 'fixture-norow-today.html', offered: false, widgets: cover(), noRow: true, script: 'none' },
  { file: 'fixture-cover-norow-plain.html', offered: true, widgets: cover(), noRow: true, script: 'none' },
  { file: 'fixture-cover-norow.html', offered: true, widgets: cover(), noRow: true, script: 'island' },
  { file: 'fixture-stranger-today.html', offered: false, widgets: cover(), stranger: 'text', script: 'none' },
  { file: 'fixture-stranger-cover-plain.html', offered: true, widgets: cover(), stranger: 'text', script: 'none' },
  { file: 'fixture-stranger-cover.html', offered: true, widgets: cover(), stranger: 'text', script: 'island' },
  { file: 'fixture-stranger-photo-today.html', offered: false, widgets: cover(), stranger: 'photo', script: 'none' },
  { file: 'fixture-stranger-photo-cover-plain.html', offered: true, widgets: cover(), stranger: 'photo', script: 'none' },
  { file: 'fixture-stranger-photo-cover.html', offered: true, widgets: cover(), stranger: 'photo', script: 'island' },
  { file: 'fixture-stranger-today-fit.html', offered: false, widgets: cover(), stranger: 'text', script: 'door' },
  { file: 'fixture-stranger-cover-fit.html', offered: true, widgets: cover(), stranger: 'text', script: 'island-and-door' },
  { file: 'fixture-stranger-photo-today-fit.html', offered: false, widgets: cover(), stranger: 'photo', script: 'door' },
  { file: 'fixture-stranger-photo-cover-fit.html', offered: true, widgets: cover(), stranger: 'photo', script: 'island-and-door' },
  { file: 'fixture-photo-today.html', offered: false, widgets: cover(), photo: true, script: 'none' },
  { file: 'fixture-photo-cover-plain.html', offered: true, widgets: cover(), photo: true, script: 'none' },
  { file: 'fixture-photo-cover.html', offered: true, widgets: cover(), photo: true, script: 'island' },
];

async function main() {
  for (const page of PAGES) {
    offered = page.offered;
    const drawn = await renderSiteBodyFixtureFull({ proWatermarkHidden: true, widgets: page.widgets, ...(page.activeTab ? { activeTab: page.activeTab } : {}), ...(page.noRow ? { identity: guestWithNoRow() } : {}), ...(page.stranger ? { identity: fixtureStranger() } : {}), ...(page.stranger === 'photo' || page.photo ? { heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg' } : {}) });
    if (page.stranger ? !drawn.html.includes('data-get-inside=') : Boolean(page.noRow) === drawn.html.includes('data-arrival-action=')) throw new Error(`scrub-fixture-page: ${page.file} — ${page.stranger ? 'the stranger’s door is missing' : `the reply row is ${page.noRow ? 'drawn for a guest it should not be drawn for' : 'missing'}`}`);
    offered = false;
    if (drawn.complaints.length) throw new Error(`scrub-fixture-page: ${page.file} — the page complained while rendering: ${drawn.complaints[0]}`);
    const cells = count(drawn.html, 'class="hub-cover-cell');
    /* Fail loudly: a page that was meant to hand its cover over and does not is not a page this check may play. */
    if (page.offered !== (cells === 1)) throw new Error(`scrub-fixture-page: ${page.file} — ${cells} cover cell(s) drawn with "Scrub out" ${page.offered ? 'offered' : 'not offered'}`);
    const scripts =
      page.script === 'none'
        ? ''
        : page.script === 'door'
          ? `<script src="file://${doorJs}"></script>`
          : /* (The door's fit first: on the real page it runs in the commit that mounts the island, before the engine's own
               chunk has arrived — so it has fitted the first screen before the hold arms.) */
            `${page.script === 'island-under-reveal' ? `<script>document.documentElement.setAttribute('data-reveal-up', '');</script>` : ''}${page.script === 'island-and-door' ? `<script src="file://${doorJs}"></script>` : ''}<script src="file://${island}"></script>`;
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
