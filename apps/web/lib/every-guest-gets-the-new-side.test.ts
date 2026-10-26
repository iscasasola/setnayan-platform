/**
 * 🧭 EVERY GUEST GETS THE NEW GUEST SIDE — no switch, no internal host, no env.
 *
 * Owner, 2026-10-26, verbatim: *"Yes"* — answering *"Guest pages still have their own switch: real guests only see
 * the newer Reply card, Invitation › Me and camera looks when that setting is on or the host is internal. Do you want
 * every guest to get them?"* (DECISION_LOG 2026-10-26 "EVERY GUEST GETS THE NEW GUEST SIDE").
 *
 * Until then `lib/guest-stages-on.ts` (`guestStagesOn`) decided it per event: `NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED`
 * OR the event's host is internal (`eventHostIsInternal`). It is deleted, and the old guest branches with it. Held
 * here three ways, so a switch cannot come back by any door:
 *
 *   1 · THE REAL GUEST PAGE, DRAWN WITH NOTHING SWITCHED — `SiteBody` for the fixture invitation and a listed guest,
 *       handed no prop at all beyond who they are: the cover's RSVP button opens Me's one Reply (`#me-reply`), and Me
 *       draws the guest's own parts (`data-me-parts`). A page that needs a prop, a flag or a host read to draw them
 *       fails here.
 *   2 · THE PARTS' GATE HAS NO SWITCH INPUT — `guestMePartsShown` / `guestMeNoteShown` answer for a listed guest from
 *       the three rules alone (List only · on the list · the row has the fact). Handing them a switch set OFF changes
 *       nothing.
 *   3 · NO GUEST-SIDE FILE ASKS — every source file of the guest page (`app/[slug]/**`), the guest camera
 *       (`app/papic/guest/**`) and the parts' gate (`lib/guest-me-parts.ts`), comments stripped, reads neither the
 *       env variable nor the Maker's flag helper, imports no `guest-stages-on`, and never asks whether the event's
 *       host is internal. (The Maker's own flag is not this test's business — `rd/one-maker-for-everyone`.)
 *
 * Sabotage seen red once (restored): `meIsPersonal` given back an `input.on &&` → (2) red; a `guestStagesOn` import
 * put back into `app/[slug]/page.tsx` → (3) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { renderSiteBodyFixture } from '@/lib/site-body-fixture-render';
import { siteBodyFixtureProps } from '@/lib/site-body-fixture';
import { guestMeFacts, guestMeNoteShown, guestMePartsShown } from '@/lib/guest-me-parts';

const WEB = join(__dirname, '..');

test('1 · the real guest page draws the Reply and Me’s own parts with nothing switched on', async () => {
  const base = siteBodyFixtureProps().identity as { kind: string; guest: Record<string, unknown> };
  assert.equal(base.kind, 'guest', 'anti-vacuity: the fixture is no longer a guest with a key');
  const identity = { ...base, guest: { ...base.guest, role: 'best_woman', side: 'groom' } } as never;
  const html = await renderSiteBodyFixture({ identity });
  const cover = html.slice(html.indexOf('<header data-pahina-first-screen=""'), html.indexOf('</header>', html.indexOf('<header data-pahina-first-screen=""')));
  assert.match(cover, /<a [^>]*data-cover-rsvp="ask"[^>]*href="#me-reply"|<a [^>]*href="#me-reply"[^>]*data-cover-rsvp="ask"/, 'the cover’s RSVP button (the new guest side’s Reply) is not drawn for a plain guest');
  assert.ok(html.includes('id="me-reply"'), 'Me’s one Reply is missing');
  const me = html.slice(html.indexOf('data-me-stage=""'));
  assert.ok(me.length < html.length, 'anti-vacuity: no Me on the page');
  assert.match(me, /data-me-parts=""/, 'Me does not draw the guest’s own parts for a plain guest');
});

test('2 · the parts’ gate answers from its three rules — a switch handed in OFF changes nothing', () => {
  const facts = guestMeFacts({
    role: 'principal_sponsor_ninang' as never,
    dressCodeConfig: { groups: { principal_sponsors: { style: 'barong_tagalog', callTime: '14:00' } } },
    rolePalette: { principal_sponsors: ['#C9A24B'], touched_roles: ['principal_sponsors'] },
    comingWith: ['Lola Nena'],
  });
  const gate = { getIn: 'list' as const, listed: true };
  const parts = guestMePartsShown({ ...gate, facts });
  assert.ok(parts.length > 0, 'anti-vacuity: a listed guest with facts draws no parts');
  assert.deepEqual(guestMePartsShown({ ...gate, facts, on: false } as never), parts, 'a switch decides Me’s parts again');
  const note = { note: 'See you!', eventNames: 'Ana & Ben', theOrganizer: 'the couple' };
  assert.ok(guestMeNoteShown({ ...gate, ...note }), 'anti-vacuity: a listed guest’s note is not drawn');
  assert.deepEqual(guestMeNoteShown({ ...gate, ...note, on: false } as never), guestMeNoteShown({ ...gate, ...note }), 'a switch decides the hosts’ note again');
});

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ASKS: ReadonlyArray<readonly [RegExp, string]> = [
  [/NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED/, 'reads the old guest-side variable'],
  [/maker-stages-studio-flag|\bmakerStagesStudioEnabled\b/, 'asks the Maker’s flag'],
  [/guest-stages-on|\bguestStagesOn\b/, 'asks a guest-side switch'],
  [/\beventHostIsInternal\b/, 'asks whether the event’s host is internal'],
];

test('3 · no guest-side file asks a switch, the variable or the host’s internal flag', () => {
  const files = [
    ...sources(join(WEB, 'app', '[slug]')),
    ...sources(join(WEB, 'app', 'papic', 'guest')),
    join(WEB, 'lib', 'guest-me-parts.ts'),
  ];
  assert.ok(files.some((f) => f.endsWith(join('[slug]', 'page.tsx'))), 'anti-vacuity: the guest page is not in the scan');
  assert.ok(files.length > 50, `anti-vacuity: only ${files.length} guest-side files scanned`);
  const found: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const [re, what] of ASKS) if (re.test(src)) found.push(`${relative(WEB, f)} ${what}`);
  }
  assert.deepEqual(found, [], `the guest side is switched again — every guest gets it (owner 2026-10-26):\n  ${found.join('\n  ')}`);
});
