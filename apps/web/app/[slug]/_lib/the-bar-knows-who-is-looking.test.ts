/**
 * THE BOTTOM BAR IS TOLD WHO IS LOOKING.
 *
 * ── 🔴 THE DEFECT, FOUND BY THE OWNER ON HIS OWN PAGE ──────────────────────
 * Signed in, on his own wedding, the bar's last tab read **"Join"** — the
 * stranger's invitation to add themselves to the guest list — while the owner
 * ribbon on the same screen read "YOUR LIVE SITE". His words: *"story and join
 * seems incorrect. is that correct?"*
 *
 * The cause was one literal. `site-body.tsx` had exactly two calls to
 * `resolveSiteNav`, and they passed `{ kind: 'public' }` and `{ kind: 'guest' }`
 * — never asking. So the resolver's `isCouple` arm ("Manage", and the camera
 * unconditionally because it is their wedding) **could not be reached from
 * anywhere in the application**: shipped, tested, and dead.
 *
 * 🔑 THAT IS WHAT THIS FILE GUARDS — not the label. A test asserting "the
 * couple gets Manage" passes against the resolver in isolation and passed all
 * along. The property that was false is that **the page tells it the truth.**
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { resolveSiteNav } from './site-nav';

function siteBody(): string {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/_components/site-body.tsx'), 'utf8'),
  );
  assert.ok(src.includes('resolveSiteNav('), 'site-body no longer builds the bar — this guard points at nothing');
  return src;
}

test('🔴 the anonymous tree no longer claims every reader is a stranger', () => {
  const src = siteBody();
  /* The literal that caused it. Anywhere in this file it means somebody has
     gone back to asserting the viewer instead of resolving them. */
  assert.ok(
    !/viewer:\s*\{\s*kind:\s*'public'\s*\}\s*,/.test(src),
    "site-body passes a bare `viewer: { kind: 'public' }` again — a signed-in couple is told to Join their own wedding",
  );
  assert.ok(
    // `&& !isEditorCanvas`: in the Maker's canvas the bar is drawn as a GUEST
    // sees it — the host's "Manage" is editor noise there (the Guest bars switch).
    /viewer:\s*ownerCapability(?:\s*&&\s*!isEditorCanvas)?\s*\?/.test(src),
    'the bar is no longer resolved from ownerCapability',
  );
});

test('the resolver really does answer differently — so the call site matters', () => {
  /* Vacuity: if couple and public produced the same bar, the fix above would be
     cosmetic and this whole file would be theatre. */
  const common = {
    phase: 'before' as const,
    hostAllowsCamera: false,
    anyChapterPublic: false,
    hasStory: true,
    hasDetails: true,
    liveBroadcast: false,
    destinations: { join: '/x/invite' },
  };
  const stranger = resolveSiteNav({ ...common, viewer: { kind: 'public' } });
  const couple = resolveSiteNav({ ...common, viewer: { kind: 'couple' } });
  const last = (s: typeof stranger) => s[s.length - 1]!.label;
  assert.equal(last(stranger), 'Join', 'a stranger no longer gets Join — this fixture is stale');
  assert.equal(last(couple), 'Manage', 'the couple no longer gets Manage — this fixture is stale');
  assert.notEqual(last(stranger), last(couple));
});

test('🔑 the couple’s camera is theirs even when the host switch is off', () => {
  /* The other half of the arm that could not be reached: a couple always has
     their own camera. Asserted so a future "simplification" of the call site
     cannot quietly cost them it. */
  const couple = resolveSiteNav({
    viewer: { kind: 'couple' },
    phase: 'day',
    hostAllowsCamera: false,
    anyChapterPublic: false,
    liveBroadcast: false,
    destinations: { camera: '/papic/guest' },
  });
  assert.ok(couple.some((s) => s.key === 'camera'), 'the couple lost their camera slot');
});

test('⚠ the vendor arm is STILL unreachable, and that is stated rather than hidden', () => {
  /* Not a pass disguised as coverage: `{ kind: 'vendor' }` needs `kits`, which
     nothing on this page resolves, so a booked supplier still gets the public
     bar. Faking it with `kits: []` would label every supplier "Tools" on no
     evidence. This asserts the gap is DOCUMENTED, so the next reader finds a
     sentence instead of a mystery. */
  const src = readFileSync(
    join(process.cwd(), 'app/[slug]/_components/site-body.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /VENDOR ARM IS STILL UNREACHABLE/,
    'the known vendor gap lost its note — an undocumented gap is indistinguishable from an oversight',
  );
});
