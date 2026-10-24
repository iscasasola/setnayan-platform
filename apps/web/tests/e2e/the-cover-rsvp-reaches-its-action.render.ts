/**
 * Renderer for `the-cover-rsvp-reaches-its-action.spec.ts` — prints, as JSON on stdout:
 *   · `pages`: the REAL guest page body (`SiteBody`, `lib/site-body-fixture-render.ts`) of the fixture invitation for a
 *     guest with a key and for the event's host, on a full colour ground (cale-ice's shape);
 *   · `glide`: the REAL `CoverRsvpGoes` (the foot's in-page glide), bundled for the browser with esbuild.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..');

async function main() {
  const { renderSiteBodyFixture } = await import('../../lib/site-body-fixture-render');
  const { fixtureStranger, fixtureWidgets, siteBodyFixtureProps } = await import('../../lib/site-body-fixture');
  const widgets = fixtureWidgets({ hero: { ground: { kind: 'color', color: '#3a4a5a', shape: 'full' } } });
  const eventId = siteBodyFixtureProps().event.event_id;
  const host = { capability: 'owner', ownerUserId: 'lab-host', ownerEventId: eventId, maySiteEdit: true } as const;
  const pages: Record<string, string> = {
    guest: await renderSiteBodyFixture({ guestStages: true, widgets }),
    host: await renderSiteBodyFixture({ identity: fixtureStranger(), widgets, heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg', ownerCapability: host as never,
      /* 🗳 The host's OWN guest row, not yet answered (owner bug 2026-10-24): the host's Reply card is theirs — it reads
         their row and opens the plain reply page, never the Maker's sample. A host with no row gets no card. */
      hostOwnGuestId: '00000000-0000-4000-8000-00000000a002', hostOwnRsvp: 'pending' }),
  };
  const fromTsx = createRequire(createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/package.json'));
  const esbuild = fromTsx('esbuild') as { buildSync: (o: Record<string, unknown>) => { outputFiles: { text: string }[] } };
  const out = esbuild.buildSync({
    stdin: {
      contents: `
        import { createElement } from 'react';
        import { createRoot } from 'react-dom/client';
        import { CoverRsvpGoes } from './app/[slug]/_components/cover-rsvp-goes';
        const host = document.createElement('span');
        document.body.appendChild(host);
        createRoot(host).render(createElement(CoverRsvpGoes));`,
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
  process.stdout.write(JSON.stringify({ pages, glide: out.outputFiles[0]!.text }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
