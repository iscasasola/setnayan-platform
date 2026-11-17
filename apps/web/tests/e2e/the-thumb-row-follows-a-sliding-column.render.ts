/**
 * Renderer for `the-thumb-row-follows-a-sliding-column.spec.ts` — prints, as JSON on stdout, the REAL account thumb row
 * (`AccountThumbRow`, People's "Find or invite" row and Memories') with a field and a main verb. Its host is the column
 * `followColumn` measures; the fixed row reads the column's edges from `--gs-left` / `--gs-right` from 701.
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
import Module from 'node:module';

// The row's CSS modules cannot load outside Next: each class maps to itself (precedent:
// `the-page-never-scrolls-sideways.render.ts`). The row's PLACE — what this spec measures — is in Tailwind classes on
// the fixed element, which the app's compiled stylesheet carries.
(Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions['.css'] = (m) => {
  const classes = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? k : undefined) });
  m.exports = { __esModule: true, default: classes };
};

async function main() {
  const React = await import('react');
  /* tsx compiles the app's JSX to React.createElement, so React must be a global here (as the unit tests set it). */
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AccountThumbRow, ThumbField } = await import('../../app/dashboard/(account)/_components/account-thumb-row');
  const h = React.createElement;
  const row = renderToStaticMarkup(
    h(AccountThumbRow, {
      data: { 'data-people-thumb': 'people' },
      field: h(ThumbField, { words: 'Find or invite', children: h('input', { placeholder: 'Find or invite', className: 'min-w-0 flex-1 bg-transparent' }) }),
      action: h('button', { type: 'button', className: 'h-11 w-11 rounded-full bg-terracotta' }, '+'),
    }),
  );
  process.stdout.write(JSON.stringify({ row }));
}

void main();
