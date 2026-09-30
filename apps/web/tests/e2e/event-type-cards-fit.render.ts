/**
 * Renderer for `event-type-cards-fit.spec.ts` — prints the REAL
 * `EventTypePhotoPicker` markup as JSON on stdout. Run by the spec in a `tsx`
 * child process (Playwright's transform cannot server-render imported JSX).
 *
 * The roster carries the longest shipped names and the long admin taglines the
 * owner's screenshot showed ("Time with friends or…", "The lamay — the…").
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { EventTypeRow } from '../../app/dashboard/(account)/create-event/_components/event-types';

// 🪤 NOT TIDINESS TO REMOVE: tsconfig's `"jsx": "preserve"` makes `tsx` compile
// the component to the CLASSIC runtime (bare `React.createElement`), so React
// must be global BEFORE the component loads — hence the dynamic import below.
// Precedent: `app/pay/[reference]/_components/one-stage-at-a-time.test.ts`.
(globalThis as { React?: typeof React }).React = React;

const TYPES: EventTypeRow[] = [
  ['wedding', 'Wedding', 'The day you say “I do.”'],
  ['gender_reveal', 'Gender Reveal', 'Pink or blue?'],
  ['birthday', 'Birthday', 'Another year, celebrated.'],
  ['hangout', 'Hangout', 'Time with friends or barkada — two or more, for a meal, coffee, or a movie night.'],
  ['wake', 'Wake', 'The lamay — the nights of viewing, through to the funeral and the burial.'],
  ['debut', 'Debut', 'Her grand eighteenth.'],
  ['travel', 'Travel', 'The trip you’ll always remember.'],
  ['corporate', 'Corporate', 'Where your brand shines.'],
  ['christening', 'Christening', 'A blessing to remember.'],
  ['graduation', 'Graduation', 'Moments worth gathering for.'],
  ['anniversary', 'Anniversary', 'Years together, honoured.'],
  ['tournament', 'Tournament', 'Game day, elevated.'],
  ['reunion', 'Reunion', 'Old friends, one table.'],
  ['gala_night', 'Gala Night', 'An evening in black tie.'],
  ['simple_event', 'Simple Event', 'Anything else worth gathering for.'],
].map(([key, label, description]) => ({
  key,
  label,
  description,
  emoji: '✨',
  enabled: true,
  onboardingHref: null,
}));

void (async () => {
  const { EventTypePhotoPicker } = await import(
    '../../app/dashboard/(account)/create-event/_components/event-type-photo-picker'
  );
  const html = renderToStaticMarkup(
    React.createElement(EventTypePhotoPicker, {
      types: TYPES,
      onSelect: () => {},
      // The greyed Wedding tile carries its own (longer) reason line.
      unavailableReasons: { wedding: 'Already planning Maria & Jose Santos' },
    }),
  );
  process.stdout.write(JSON.stringify({ html, count: TYPES.length }));
})();
