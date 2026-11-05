/**
 * Renderer for `the-veil-hides-the-cover-words.spec.ts` — prints, as JSON on stdout:
 *   · `pages`: the REAL guest page body (`SiteBody`, `lib/site-body-fixture-render.ts`) of the fixture invitation, its
 *     names carrying a Build in of their own (so a line WITH one and lines WITHOUT one are both on the cover), with no
 *     Cover Scene ground and with a colour ground;
 *   · `hold`: the hold's own inline script (`VEIL_HOLD_SCRIPT`, `lib/hub-veil.ts`) — what `RevealMount` writes wherever
 *     an opening is mounted.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
async function main() {
  const { renderSiteBodyFixture } = await import('../../lib/site-body-fixture-render');
  const { fixtureWidgets } = await import('../../lib/site-body-fixture');
  const { VEIL_HOLD_SCRIPT } = await import('../../lib/hub-veil');
  const elements = { names: { motion: { in: { fade: true, move: 'below' } } } };
  const grounds: Record<string, unknown> = {
    plain: { elements },
    ground: { elements, ground: { kind: 'color', color: '#3a4a5a', shape: 'full' } },
  };
  const pages: Record<string, string> = {};
  for (const [name, hero] of Object.entries(grounds)) {
    pages[name] = await renderSiteBodyFixture({ widgets: fixtureWidgets({ hero }) });
  }
  process.stdout.write(JSON.stringify({ pages, hold: VEIL_HOLD_SCRIPT }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
