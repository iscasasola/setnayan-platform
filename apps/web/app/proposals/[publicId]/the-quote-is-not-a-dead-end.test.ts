/**
 * the-quote-is-not-a-dead-end.test.ts
 *
 * Owner, live on the payment run, 2026-09-20: *"when i click view proposal, it
 * opens the proposal, but when i press back, it doesn't go back."*
 *
 * Two halves, and only together do they mean anything:
 *
 *  1. **The doors in.** Every link to `/proposals/<id>` from a conversation is
 *     a plain `<Link>` — no `target`, no `window.open`, no new browsing
 *     context. That is what makes the browser's own Back button work at all,
 *     and it is a property a single `target="_blank"` added for "convenience"
 *     would silently destroy, with no test failing anywhere else.
 *  2. **The door out.** The page's own control resolves the thread it came
 *     from instead of walking off to the Vendors bench.
 *
 * A source-scanning guard: the page is a server component reading
 * `auth.getUser()` and five Supabase tables, so it cannot be rendered in a unit
 * test. Comments are stripped first — see lib/strip-comments.ts for why a naive
 * regex strip corrupts real code (and why this file must not write its own).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { stripComments } from '../../../lib/strip-comments';

const WEB = path.join(__dirname, '..', '..', '..');
const PAGE_PATH = path.join(__dirname, 'page.tsx');

function read(rel: string): string {
  return stripComments(readFileSync(path.join(WEB, rel), 'utf8'));
}
function page(): string {
  return stripComments(readFileSync(PAGE_PATH, 'utf8'));
}

/**
 * Every file that opens a quote FROM a conversation surface, and the number of
 * `/proposals/<id>` links each one holds. Counted, not merely matched: a second
 * card added beside the first is exactly the kind of door that gets opened in a
 * new tab because "it is only one more".
 */
const DOORS_IN: ReadonlyArray<readonly [string, number]> = [
  ['app/_components/chat-message-stream.tsx', 1],
  ['app/_components/chat-thread-views.tsx', 1],
  ['app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx', 2],
  ['app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/vendor-proposals-card.tsx', 1],
  ['app/vendor-dashboard/clients/[eventId]/page.tsx', 1],
  ['app/vendor-dashboard/proposals/surface.tsx', 1],
];

test('every door into a quote stays in this tab — Back has something to go back to', () => {
  let totalDoors = 0;
  for (const [rel, expected] of DOORS_IN) {
    const src = read(rel);
    const hrefs = src.match(/href=\{`\/proposals\/\$\{[^`]*`\}/g) ?? [];
    assert.equal(
      hrefs.length,
      expected,
      `${rel}: expected ${expected} /proposals links, found ${hrefs.length} — update this guard deliberately, not to go green`,
    );
    totalDoors += hrefs.length;

    // The window a `target` would live in: the JSX tag that carries the href.
    for (const href of hrefs) {
      const at = src.indexOf(href);
      // Back to the opening `<`, forward to the end of the opening tag.
      const tagStart = src.lastIndexOf('<', at);
      const tagEnd = src.indexOf('>', at);
      assert.ok(tagStart !== -1 && tagEnd !== -1, `${rel}: could not bound the tag around ${href}`);
      const tag = src.slice(tagStart, tagEnd);
      assert.ok(
        !/\btarget\s*=/.test(tag),
        `${rel}: a quote link opens a new browsing context — the browser's Back button cannot return from a tab it did not leave`,
      );
    }
  }
  assert.ok(totalDoors >= 7, `expected at least 7 quote doors across the app, counted ${totalDoors}`);
});

test('the page resolves the conversation it was opened from', () => {
  const src = page();
  // The same (event, supplier) pair the workspace uses for its chat deep-link.
  assert.match(src, /from\('chat_threads'\)/, 'the thread is never looked up');
  assert.match(src, /\.select\('thread_id'\)/);
  assert.match(src, /\.eq\('event_id',\s*proposal\.event_id\)/);
  assert.match(src, /\.eq\('vendor_profile_id',\s*proposal\.vendor_profile_id\)/);
  // A refused read must be logged, not swallowed into a silent fallback.
  assert.match(src, /logQueryError\('proposals\/\[publicId\]:backThread'/);
});

test('the back control is built by the one rule, and names where it goes', () => {
  const src = page();
  assert.match(src, /import \{ proposalBackDoor \} from '@\/lib\/proposal-back'/);
  assert.match(
    src,
    /const backDoor = proposalBackDoor\(\{/,
    'the destination is not resolved through the shared rule',
  );
  assert.match(src, /threadId: backThreadId,/, 'the rule is called without the thread it resolved');

  // The rendered control must READ from the rule — both halves.
  assert.match(src, /href=\{backDoor\.href\}/, 'the link ignores the resolved destination');
  assert.match(src, /\{backDoor\.label\}/, 'the label ignores the resolved destination');

  // And must no longer hard-code the bench, which is the bug itself.
  assert.doesNotMatch(
    src,
    /href=\{\s*isVendorSide \|\| !proposal\.event_id/,
    'the hard-coded bench destination is back',
  );
  const backLiterals = src.match(/className="h-4 w-4" \/> Back\b/g) ?? [];
  assert.equal(
    backLiterals.length,
    0,
    `the control says a bare "Back" in ${backLiterals.length} place(s) — it must name its destination`,
  );
});
