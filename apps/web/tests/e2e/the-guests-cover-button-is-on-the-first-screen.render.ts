/**
 * Renderer for `the-guests-cover-button-is-on-the-first-screen.spec.ts` — prints, as JSON on stdout:
 *   · `pages`: the REAL guest page body (`SiteBody`, `lib/site-body-fixture-render.ts`) of the fixture invitation (Maria &
 *     Jose) for a guest with a key in each reply state the cover's button draws — not replied (`ask`), coming and complete
 *     (`going`), coming with two of the couple's switched-on answers still owed (`more`, "You're coming ✓ · 2 more
 *     answers") — on no ground and on a Full colour ground;
 *   · `fit`: the REAL `FirstScreenDoor` in its RSVP-button mode (`foot rsvp`), bundled for the browser with esbuild, so
 *     the spec runs the shipped fit on the shipped markup under the app's compiled CSS.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..');

async function main() {
  const { renderSiteBodyFixture } = await import('../../lib/site-body-fixture-render');
  const { fixtureWidgets, FIXTURE_EVENT } = await import('../../lib/site-body-fixture');
  const { buildSimulatedGuestIdentity } = await import('../../lib/simulated-guest-preview');
  const grounds: Record<string, unknown> = { plain: null, full: { kind: 'color', color: '#3a4a5a', shape: 'full' } };
  const states = {
    ask: { seeAs: 'pending', moreAnswers: 0 },
    going: { seeAs: 'replied', moreAnswers: 0 },
    more: { seeAs: 'replied', moreAnswers: 2 },
  } as const;
  const pages: Record<string, string> = {};
  for (const [g, ground] of Object.entries(grounds)) {
    for (const [s, st] of Object.entries(states)) {
      const identity = { ...buildSimulatedGuestIdentity({ slug: FIXTURE_EVENT.slug, seeAs: st.seeAs }), moreAnswers: st.moreAnswers };
      pages[`${g}:${s}`] = await renderSiteBodyFixture({ identity, ...(ground ? { widgets: fixtureWidgets({ hero: { ground } }) } : {}) });
    }
  }
  /* 📷 …and a PHOTO cover (a hero photo, no Cover Scene ground): its 4:5 plate under the date is the first part to give way. */
  for (const [s, st] of Object.entries(states)) {
    const identity = { ...buildSimulatedGuestIdentity({ slug: FIXTURE_EVENT.slug, seeAs: st.seeAs }), moreAnswers: st.moreAnswers };
    pages[`photo:${s}`] = await renderSiteBodyFixture({ identity, heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg' });
  }
  const fromTsx = createRequire(createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/package.json'));
  const esbuild = fromTsx('esbuild') as { buildSync: (o: Record<string, unknown>) => { outputFiles: { text: string }[] } };
  const out = esbuild.buildSync({
    stdin: {
      contents: `
        import { createElement } from 'react';
        import { createRoot } from 'react-dom/client';
        import { FirstScreenDoor } from './app/[slug]/_components/first-screen-door';
        /* As \`pahina-masthead.tsx\` mounts it: once, in the foot that holds the guest's RSVP button. */
        for (const foot of document.querySelectorAll('[data-cover-foot]')) {
          if (!foot.querySelector('a[data-cover-rsvp]')) continue;
          for (const old of foot.querySelectorAll(':scope > span[hidden]')) old.remove();
          const host = document.createElement('span');
          foot.appendChild(host);
          createRoot(host).render(createElement(FirstScreenDoor, { foot: true, rsvp: true }));
        }`,
      resolveDir: WEB,
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  process.stdout.write(JSON.stringify({ pages, fit: out.outputFiles[0]!.text }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
