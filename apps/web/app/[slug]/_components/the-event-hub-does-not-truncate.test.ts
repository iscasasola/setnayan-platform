/**
 * THE EVENT HUB SHOWS EVERY MOMENT AND EVERY NAME — IT DOES NOT SEND
 * SOMEONE ELSEWHERE TO SEE THE REST.
 *
 * Owner, 2026-09-26, verbatim: "event schedule on the event hub should not
 * be see other schedule it will extend as needed. Same goes to the guest
 * list."
 *
 * Two truncations existed on `/[slug]` (the Event Hub) before this test:
 *
 *   · `ScheduleWidget` (`schedule-widget.tsx`) sliced to the first
 *     `COMPACT_MOMENTS` (3) behind a "All N moments" toggle, when the caller
 *     passed `compact`.
 *   · `EntourageSection` (`entourage-section.tsx`) sliced to the first
 *     `previewGroups` groups behind a "See everyone — N more" link to
 *     `/[slug]/everyone`, when the caller passed `previewHref`.
 *
 * BOTH widgets keep the ability — other surfaces may still want a preview —
 * this guard only asserts that the Event Hub's own callers stopped asking
 * for one. `site-body.tsx` mounts the entourage directly (in BOTH of its
 * subtrees — see `the-entourage-is-mounted-in-both-trees.test.ts`);
 * `hideable-widget-render.tsx` (identified guest) and
 * `public-hideable-widget.tsx` (anonymous) mount the schedule for the
 * non-live "schedule" widget slot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

test('the Event Hub schedule never passes `compact` to ScheduleWidget', () => {
  for (const file of ['hideable-widget-render.tsx', 'public-hideable-widget.tsx']) {
    const src = read(file);
    const at = src.indexOf('<ScheduleWidget');
    assert.ok(at > 0, `${file} no longer mounts <ScheduleWidget> — update this guard`);
    const call = src.slice(at, src.indexOf('/>', at) + 2);
    assert.doesNotMatch(
      call,
      /\bcompact\b/,
      `${file} passes compact to ScheduleWidget again — the Event Hub would ` +
        'truncate to 3 moments behind an "All N moments" toggle',
    );
  }
});

test('ScheduleWidget still supports `compact` for callers that still want it', () => {
  // The owner's instruction was about the Event Hub, not the widget itself —
  // this guard would go red the moment the compact/showAll machinery is
  // deleted rather than merely unused by the Hub's own callers.
  const src = read('schedule-widget.tsx');
  assert.match(src, /compact\?:\s*boolean/, 'the compact prop is gone from ScheduleWidget');
  assert.match(src, /COMPACT_MOMENTS/, 'the truncation constant is gone from ScheduleWidget');
});

test('the Event Hub entourage never passes `previewHref` to EntourageSection', () => {
  const src = read('site-body.tsx');
  const mounts = [...src.matchAll(/<EntourageSection\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(mounts.length, 2, `expected 2 EntourageSection mounts, found ${mounts.length}`);
  for (const mount of mounts) {
    assert.doesNotMatch(
      mount,
      /previewHref/,
      'site-body.tsx passes previewHref to EntourageSection again — the Event ' +
        'Hub would show a "See everyone — N more" link instead of the full list',
    );
  }
  assert.doesNotMatch(
    src,
    /\/everyone/,
    'site-body.tsx still references /[slug]/everyone — the only reference ' +
      'that ever existed there was the removed previewHref',
  );
});

test('EntourageSection still supports a preview for callers that still want one', () => {
  const src = read('entourage-section.tsx');
  assert.match(src, /previewHref\?:\s*string/, 'the previewHref prop is gone from EntourageSection');
  assert.match(
    src,
    /groups\.length === 0\)\s*return null/,
    'entourage-section must still return null on an empty list',
  );
});

test('/[slug]/everyone keeps working for old links, even though nothing on the Hub links to it', () => {
  const page = read(join('..', 'everyone', 'page.tsx'));
  assert.match(page, /<EntourageSection\b/, 'the /everyone route no longer renders the full entourage');
});
