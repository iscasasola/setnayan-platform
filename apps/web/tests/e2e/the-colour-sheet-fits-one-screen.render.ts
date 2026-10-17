/**
 * Renderer for `the-colour-sheet-fits-one-screen.spec.ts` — prints, as JSON on stdout, the REAL colour picker's body
 * (`ColourPickerBody`, what `ColourPickerSheet` puts in a sheet) with FIVE Mood Board colours and FIVE recently used,
 * inside each of the two frames it opens in:
 *   · `maker` — the new Maker's one bottom sheet on a phone (`MakerSheet`, never past 62% of the screen);
 *   · `popup` — the centred panel everywhere else (`StudioPopup`, never past 80% of the screen);
 * for each caller shape that ships: Attire › a part's colour (job + "Use the default"), a text colour (the AA line +
 * "Remove this colour"), a background well (its quiet reset) — and, as the ceiling, all of them at once.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
async function main() {
  const React = await import('react');
  /* tsx compiles the app's JSX to React.createElement, so React must be a global here (as the unit tests set it). */
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ColourPickerBody, StudioPopup } = await import('../../app/dashboard/[eventId]/studio/mood-board/_components/colour-picker-sheet');
  const { MakerSheet } = await import('../../app/dashboard/[eventId]/launch/_components/stages-studio-parts');
  const { ActionButton } = await import('../../components/action-button');
  const { X } = await import('lucide-react');
  const h = React.createElement;

  /* The owner's own sheet, 2026-10-17: Dominant #5C0700 and four more; five he picked before. */
  const five = ['#5C0700', '#C9A86A', '#7A1F2B', '#F3E9DC', '#8B7E74'];
  const recent = ['#1F6F78', '#5B4A6B', '#2A3A5E', '#B9C9B0', '#C0C0C0'];
  const quiet = (label: string, mark: string) =>
    h('span', { [mark]: '', className: 'self-start' }, h(ActionButton, { tone: 'neutral', icon: X, label, onClick: () => {}, className: '!h-11' }));
  const none = () => {};
  const shapes: Record<string, { title: string; body: Record<string, unknown> }> = {
    attire: {
      title: 'Principal Sponsors — Shirt',
      body: { job: 'The colour of this part — any colour, not only your five', current: five[0], extra: quiet('Use the default', 'data-mood-board-role-remove') },
    },
    text: {
      title: 'Text colour',
      body: { job: 'The words on this part', current: '#7A1F2B', readsOn: '#F3E9DC', onRemove: none },
    },
    background: {
      title: 'Page colour',
      body: { job: 'Behind every page · the first colour of a blend', current: recent[2], extra: quiet('Follow the Mood Board', 'data-bg-colour-reset') },
    },
    everything: {
      title: 'Principal Sponsors — Shirt',
      body: {
        job: 'The colour of this part — any colour, not only your five',
        current: five[0],
        readsOn: '#F3E9DC',
        extra: quiet('Use the default', 'data-mood-board-role-remove'),
        onRemove: none,
      },
    },
  };
  const out: Record<string, string> = {};
  for (const [name, s] of Object.entries(shapes)) {
    const body = h(ColourPickerBody, { palette: five, recent, slots: true, onPick: none, ...s.body } as never);
    out[`maker:${name}`] = renderToStaticMarkup(h(MakerSheet, { label: s.title, onClose: none }, body));
    out[`popup:${name}`] = renderToStaticMarkup(h(StudioPopup, { label: s.title, onClose: none }, body));
  }
  process.stdout.write(JSON.stringify({ five, recent, pages: out }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
