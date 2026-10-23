/**
 * Renderer for `the-spotlight-ring-wraps-its-target.spec.ts` — prints, as JSON on stdout:
 *   · `tours`: EVERY spotlight tour in `lib/tours.ts`, as the first run walks it (`spotlightSteps(…, true)`) — read
 *     here, so a step another PR adds is walked too, with nobody editing the spec;
 *   · `engine`: the REAL `SpotlightTour` (`app/_components/spotlight-tour.tsx`), bundled for the browser with esbuild,
 *     exposed as `window.__spot.mount(steps, inMaker)`.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot bundle the app's JSX).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..');

async function main() {
  const { TOURS } = await import('../../lib/tours');
  const { spotlightSteps } = await import('../../lib/spotlight-steps');
  const { HOST_PAGE_TOURS } = await import('../../lib/host-page-tours');
  /* Mounted INSIDE the Maker (the engine's Maker pause is not for them) — `inMaker` at every real mount site. */
  const inMaker = new Set<string>([HOST_PAGE_TOURS.maker]);
  const tours = Object.entries(TOURS)
    .filter(([, t]) => (t as { spotlight?: unknown }).spotlight)
    .map(([key, t]) => {
      const s = (t as { spotlight: { steps: ReadonlyArray<{ anchor: string; title: string; welcome?: boolean; go?: boolean }> } }).spotlight;
      return {
        key,
        inMaker: inMaker.has(key),
        steps: spotlightSteps(s.steps as never, true).map((st) => ({ anchor: st.anchor, title: st.title, welcome: !!st.welcome, go: !!st.go })),
      };
    });
  const fromTsx = createRequire(createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/package.json'));
  const esbuild = fromTsx('esbuild') as { buildSync: (o: Record<string, unknown>) => { outputFiles: { text: string }[] } };
  const out = esbuild.buildSync({
    stdin: {
      contents: `
        import { createElement } from 'react';
        import { createRoot } from 'react-dom/client';
        import { SpotlightTour } from './app/_components/spotlight-tour';
        let root = null;
        window.__spot = {
          mount(host, steps, inMaker) {
            if (root) root.unmount();
            root = createRoot(host);
            root.render(createElement(SpotlightTour, {
              tourKey: 'lab', steps, inMaker, record: false, restart: true, name: 'Isabel',
              finale: { title: 'Done', body: 'Done', button: 'Done' },
              completeAction: async () => {}, onClose: () => {},
            }));
          },
        };`,
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
  process.stdout.write(JSON.stringify({ tours, engine: out.outputFiles[0]!.text }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
