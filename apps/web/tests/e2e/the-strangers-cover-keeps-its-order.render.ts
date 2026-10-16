/**
 * Renderer for `the-strangers-cover-keeps-its-order.spec.ts` — prints, as JSON on stdout:
 *   · `pages`: the REAL guest page body (`SiteBody`, `lib/site-body-fixture-render.ts`) for a STRANGER of the fixture
 *     invitation (Maria & Jose), with no Cover Scene ground and with a Full / Framed colour ground;
 *   · `door`: the REAL `FirstScreenDoor` (the fit that makes room for "Get inside"), bundled for the browser with
 *     esbuild, so the spec runs the shipped fit on the shipped markup under the app's compiled CSS.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..');

async function main() {
  const { renderSiteBodyFixture } = await import('../../lib/site-body-fixture-render');
  const { fixtureStranger, fixtureWidgets } = await import('../../lib/site-body-fixture');
  const grounds: Record<string, unknown> = {
    plain: null,
    full: { kind: 'color', color: '#3a4a5a', shape: 'full' },
    framed: { kind: 'color', color: '#3a4a5a' },
  };
  const pages: Record<string, string> = {};
  for (const [name, ground] of Object.entries(grounds)) {
    pages[name] = await renderSiteBodyFixture({
      identity: fixtureStranger(),
      ...(ground ? { widgets: fixtureWidgets({ hero: { ground } }) } : {}),
    });
  }
  /* esbuild ships with tsx (the repo's TS runner) — resolved through it, so no new dependency. */
  const fromTsx = createRequire(createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/package.json'));
  const esbuild = fromTsx('esbuild') as { buildSync: (o: Record<string, unknown>) => { outputFiles: { text: string }[] } };
  const out = esbuild.buildSync({
    stdin: {
      contents: `
        import { createElement } from 'react';
        import { createRoot } from 'react-dom/client';
        import { FirstScreenDoor } from './app/[slug]/_components/first-screen-door';
        for (const door of document.querySelectorAll('details[data-get-inside].sn-door-dock')) {
          for (const old of door.querySelectorAll(':scope > span[hidden]')) old.remove();
          const host = document.createElement('span');
          door.appendChild(host);
          createRoot(host).render(createElement(FirstScreenDoor));
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
  process.stdout.write(JSON.stringify({ pages, door: out.outputFiles[0]!.text }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
