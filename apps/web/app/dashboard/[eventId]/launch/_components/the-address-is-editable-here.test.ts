/**
 * the-address-is-editable-here.test.ts
 *
 * Owner, 2026-09-23, with the `<h2>` on `/launch` selected: *"should be
 * editable here. and verified if it is available."*
 *
 * 🔑 NOTHING NEW WAS BUILT. RULE 0: `SlugField` and `updateEventSlug` have
 * shipped on the invitation page for months — a 300ms-debounced check against
 * `/api/slugs/check`, suggestions when a word is taken, and `findSlugConflict`
 * behind the save, which is the ONE availability answer for the namespace that
 * weddings, shops and people all share at `setnayan.com/{word}`. Drawing a
 * second address field here would have been a second opinion about who owns
 * `/maria-and-jomar`, and the two would eventually disagree.
 *
 * 🪤 WHAT MOUNTING IT SOMEWHERE ELSE BROKE. All seven of the action's redirects
 * named `/dashboard/{id}/invitation` literally. On `/launch` that is a save
 * that succeeds and teleports: the couple presses Save, the address is right,
 * and the page they were working on is gone. It reads as a bug either way —
 * and the failure redirects are worse, because the error copy arrives on a page
 * that has no idea what it is about.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const NOW = new Date('2026-11-28T10:00:00+08:00').getTime();
const WEB = process.cwd();
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

async function paint(opts: { slug: string | null; wired: boolean }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubStage } = await import('./hub-stage');
  const control = await import('@/lib/event-hub-control');
  const { PUBLIC_SITE_PAGES } = await import('@/lib/public-site-pages');

  const read = {
    measured: true,
    eventDate: '2026-12-12',
    eventEndDate: null,
    clearedAt: null,
    timezone: 'Asia/Manila',
    slug: opts.slug,
  };
  const guests = { shared: true, measured: true, invited: 90, replied: 61 };
  const standing = control.resolveHubStanding(read, NOW);

  return renderToStaticMarkup(
    React.createElement(HubStage, {
      slug: read.slug,
      standing,
      facts: control.resolveHubFacts(read, guests, NOW),
      livePhase: standing.stage,
      initialPhase: standing.stage,
      stages: PUBLIC_SITE_PAGES.map((p) => ({ phase: p.phaseParam, blurb: p.blurb })),
      editHref: '/dashboard/E1/website/editor',
      rolesByPhase: {},
      armedRole: null,
      ...(opts.wired
        ? { eventId: 'E1', slugAction: async () => {} }
        : {}),
    }),
  );
}

test('the address on /launch is an input the couple can type in, pre-filled with their own', async () => {
  const html = await paint({ slug: 'maria-and-jomar', wired: true });
  assert.match(html, /setnayan\.com\/maria-and-jomar/, 'the heading still reads the address');
  assert.match(html, /name="slug"/, 'and there is a field to change it');
  assert.match(
    html,
    /id="slug"[^>]*value="maria-and-jomar"/,
    'pre-filled with the current address — an empty box asks them to retype what they have',
  );
});

test('a couple who has NOT picked an address yet gets an empty box, not a missing one', async () => {
  // 🪤 `slug` is nullable here and the heading says "Your one link, once you set
  // it". That sentence is the whole reason the field must render in that state:
  // it is the one moment the couple is actually being asked to act.
  const html = await paint({ slug: null, wired: true });
  assert.match(html, /Your one link, once you set it/);
  assert.match(html, /name="slug"/, 'the field is missing exactly when it is most needed');
});

test('⛔ the stage still paints when nothing is wired — a test may mount it bare', async () => {
  const html = await paint({ slug: 'maria-and-jomar', wired: false });
  assert.match(html, /setnayan\.com\/maria-and-jomar/);
  assert.doesNotMatch(html, /name="slug"/, 'no field without a server action to receive it');
});

test('⛔ a save on /launch lands on /launch — the action is bound to a NAME', () => {
  const page = src('app', 'dashboard', '[eventId]', 'launch', 'page.tsx');
  assert.match(
    page,
    /updateEventSlug\.bind\(null,\s*eventId,\s*'launch'\)/,
    "the launch page must claim its own landing, or the couple is sent to the invitation page",
  );
  const inv = src('app', 'dashboard', '[eventId]', 'invitation', 'page.tsx');
  assert.match(inv, /updateEventSlug\.bind\(null,\s*eventId,\s*'invitation'\)/);

  // 🔒 A NAME, NOT A PATH. A bound argument is encoded and handed to the
  // browser; redirecting to one as a path is an open redirect waiting to be
  // replayed. The map refuses an unknown key structurally.
  const ret = src('lib', 'slug-return.ts');
  assert.match(ret, /export type SlugReturn = 'invitation' \| 'launch'/);
  assert.doesNotMatch(
    ret,
    /return\s+to\b|redirect\(to\)/,
    'slugReturnPath must build the URL, never pass its argument through',
  );
});

test('⛔ no landing inside updateEventSlug names a page literally', () => {
  const actions = src('app', 'dashboard', '[eventId]', 'invitation', 'actions.ts');
  const start = actions.indexOf('export async function updateEventSlug');
  assert.ok(start > 0);
  const body = actions.slice(start, actions.indexOf('\nexport ', start + 10));
  assert.ok(body.length > 200, 'failed to isolate the action body');
  assert.doesNotMatch(
    body,
    /\/dashboard\/\$\{eventId\}\/(invitation|launch)/,
    'a hard-coded landing here is a save that teleports on whichever page it is NOT',
  );
  const lands = [...body.matchAll(/redirect\(\s*`?\$\{?back\}?/g)];
  assert.ok(lands.length >= 4, `expected every refusal to land via \`back\`, saw ${lands.length}`);
  assert.match(body, /revalidatePath\(back\)/);
});

test('⛔ availability is asked ONCE, of the one answer — not re-implemented here', () => {
  const field = src('app', 'dashboard', '[eventId]', 'invitation', '_components', 'slug-field.tsx');
  assert.match(field, /\/api\/slugs\/check\?slug=/, 'the live check goes to the shared endpoint');
  const actions = src('app', 'dashboard', '[eventId]', 'invitation', 'actions.ts');
  assert.match(actions, /findSlugConflict\(admin, requested, \{ eventId \}\)/, 'and the save asks it too');
  // The stage must not grow its own idea of what is free.
  const stage = src('app', 'dashboard', '[eventId]', 'launch', '_components', 'hub-stage.tsx');
  assert.doesNotMatch(stage, /slugs\/check|findSlugConflict|SLUG_FORMAT/, 'a second opinion in the making');
});

test('⛔ a check that could not be answered SAYS so, and keeps Save off', () => {
  // 🔴 It used to be silence. A non-ok response or a dropped connection left the
  // previous verdict standing, the spinner stopped, and Save never lit — a
  // couple typing a free address saw a grey button and no reason at all.
  const field = src('app', 'dashboard', '[eventId]', 'invitation', '_components', 'slug-field.tsx');
  assert.match(field, /\|\s*\{ status: 'unverified' \}/, 'the state must exist');
  assert.match(field, /else \{\s*setCheck\(\{ status: 'unverified' \}\);/, 'a non-ok answer is not no answer');
  assert.match(field, /catch \{\s*setCheck\(\{ status: 'unverified' \}\);/, 'nor is a thrown one');
  assert.match(field, /We couldn&rsquo;t check that address/, 'and it has to reach the reader');
  // Save is lit only by a positive verdict, so 'unverified' cannot arm it.
  assert.match(
    field,
    /const canSave = check\?\.status === 'available' && value !== initialSlug;/,
    'Save must require an affirmative answer, never the absence of a refusal',
  );
});
