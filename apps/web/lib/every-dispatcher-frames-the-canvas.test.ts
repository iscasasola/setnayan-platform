/**
 * every-dispatcher-frames-the-canvas.test.ts — BOTH DOORS, NOT JUST THE ONE.
 *
 * 🔴 WHY THIS EXISTS: the canvas frame was written inside ONE dispatcher and
 * shipped that way. `site-body.tsx` renders widgets down two paths —
 * `HideableWidgetRender` for a guest, and `PublicHideableWidget` for an
 * anonymous visitor on an open-browse event. A couple who arranged their page
 * would have seen it; a stranger following their link would have seen the page
 * unarranged. Nothing red, nothing different in the dashboard, and the only
 * way to notice is to open your own link signed out.
 *
 * 🔑 IT FINDS DISPATCHERS BY WHAT THEY DO, NOT BY A LIST OF TWO NAMES. A guard
 * that named the two files would pass forever while a third one was added
 * beside them — which is exactly the shape of the bug it is guarding. So it
 * enumerates every component under `app/[slug]/_components` that switches on
 * `widget.widget_type`, and requires each to go through the shared frame.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = join(__dirname, '..', 'app', '[slug]', '_components');

/** Every file that dispatches on a widget type — the definition of "a door". */
function dispatchers(): { file: string; src: string }[] {
  const out: { file: string; src: string }[] = [];
  for (const file of readdirSync(COMPONENTS)) {
    if (!file.endsWith('.tsx')) continue;
    const src = readFileSync(join(COMPONENTS, file), 'utf8');
    if (/switch\s*\(\s*widget\.widget_type\s*\)/.test(src)) out.push({ file, src });
  }
  return out;
}

test('⭐ precondition: there really are two doors, and the sweep finds them', () => {
  const found = dispatchers().map((d) => d.file).sort();
  assert.deepEqual(
    found,
    ['hideable-widget-render.tsx', 'public-hideable-widget.tsx'],
    'if this list changed, the new door needs the frame too — that is the point',
  );
});

test('⛔ EVERY dispatcher puts its output through the shared canvas frame', () => {
  const found = dispatchers();
  assert.ok(found.length >= 2, 'precondition: more than one door exists');
  for (const { file, src } of found) {
    assert.match(
      src,
      /import \{ HubCanvasFrame \} from '\.\/hub-canvas-frame';/,
      `${file} does not import the shared frame — a couple's arrangement would not reach this path`,
    );
    // 🪤 ANCHORED ON THE OPENING TAG AND THE WIDGET, NOT ON THE WHOLE
    // ATTRIBUTE LIST. The first version ended the pattern at `}>`, so adding a
    // second, entirely correct prop (`mediaUrls`) turned this red — a guard
    // that fails when the code gets BETTER teaches the next session to weaken
    // it. The property is "this door wraps its own widget in the frame";
    // everything else the frame takes is none of this guard's business.
    assert.match(
      src,
      /<HubCanvasFrame\s+widget=\{props\.widget\}/,
      `${file} imports the frame but does not wrap with it`,
    );
  }
});

test('⛔ nobody re-implements the frame beside it', () => {
  // Two copies of this rule would drift, and the drift is invisible until a
  // guest opens the page. One frame or none.
  for (const { file, src } of dispatchers()) {
    assert.doesNotMatch(
      src,
      /hasHubCanvas|hubCanvasVars|sanitizeHubCanvas/,
      `${file} reaches for the contract directly instead of using the frame`,
    );
  }
});

test('⛔ the frame still refuses a null child and an un-arranged couple', async () => {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
/*
  🪤 THE FRAME IS LOOSENED FOR `createElement`, AND IT TOOK TWO RED CI RUNS TO
  GET RIGHT. `react/no-children-prop` (an ERROR here) forbids `{ children }` in
  the props object; `HubCanvasFrame`'s props type REQUIRES `children`, so moving
  it to the third argument left the props object incomplete and tsc refused the
  overload. Lint and tsc each rejected the other's fix.

  In JSX there is no tension — `<HubCanvasFrame …>{child}</HubCanvasFrame>`
  satisfies both — but these guards are `.ts`, not `.tsx`. So the component is
  cast to a loose function type for the harness only: children go as arguments
  (lint) and the props object no longer owes a `children` (tsc).

  ⚠ The lesson is not the cast. It is that fixing ONE of the two checks and
  pushing burned a fifty-minute round trip; they have to be run together.
*/
const Frame = HubCanvasFrame as unknown as React.FunctionComponent<Record<string, unknown>>;

  const row = (config: unknown) =>
    ({ widget_id: 'W1', event_id: 'E1', widget_type: 'countdown', config_json: config } as never);

  // A widget that hid itself must not become an empty animated box.
  assert.equal(
    renderToStaticMarkup(
      React.createElement(Frame, { widget: row({ canvas: { preset: 'calm' } }) }, null),
    ),
    '',
    'a null child renders nothing at all — no wrapper div',
  );

  // A couple who arranged nothing gets markup identical to having no frame.
  const bare = renderToStaticMarkup(
    React.createElement(Frame, { widget: row(null) }, React.createElement('p', null, 'hi')),
  );
  assert.equal(bare, '<p>hi</p>', 'no wrapper, no classes — byte-identical to before the canvas existed');

  // And one who did arrange gets the frame.
  const framed = renderToStaticMarkup(
    React.createElement(
      Frame,
      { widget: row({ canvas: { preset: 'cinematic' } }) },
      React.createElement('p', null, 'hi'),
    ),
  );
  assert.match(framed, /class="hub-canvas [^"]*hub-tl-scrub/);
  assert.match(framed, /<p>hi<\/p>/);
});
