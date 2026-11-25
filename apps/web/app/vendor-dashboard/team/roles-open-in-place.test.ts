/**
 * GUARD — ROLES AND WHO GETS NEW INQUIRIES OPEN IN PLACE INSIDE THE TEAM LAYER (final check B13 · B14; drawing
 * `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html` § B13 · B14, approved 25 Nov).
 *
 *   1. One address, sections: Team draws Roles or Who gets new inquiries for `?section=`, so the risen layer stays up and
 *      only its body changes; the old addresses forward there, carrying what they held.
 *   2. The layer's head reads "‹ <section>" over Team; ‹ steps back one level by REPLACING the address (so the phone's
 *      Back still closes Team); a hard load draws its own ‹ row. No grey back box, no 30 px title of their own.
 *   3. B14: the branch is one PickMenu; Adjust opens under its own group, in place (no #adjust jump).
 *   4. Saves land back on the section; every door into Roles and Inquiries uses the section address.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TEAM_INQUIRIES_HREF, TEAM_ROLES_HREF, teamSectionOf } from '@/lib/team-sections';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));
const ROLES = src('app/vendor-dashboard/team/_components/roles-section.tsx');
const INQ = src('app/vendor-dashboard/team/_components/inquiries-section.tsx');

test('1 · Team draws a section for ?section=, the layer stays; the old addresses forward', async () => {
  assert.equal(TEAM_ROLES_HREF, '/vendor-dashboard/team?section=roles');
  assert.equal(TEAM_INQUIRIES_HREF, '/vendor-dashboard/team?section=inquiries');
  assert.equal(teamSectionOf('roles'), 'roles');
  assert.equal(teamSectionOf('anything'), null);
  const page = src('app/vendor-dashboard/team/page.tsx');
  assert.match(page, /if \(section === 'roles'\) return <RolesSection /);
  assert.match(page, /if \(section === 'inquiries'\) \{\s*return <InquiriesSection /);
  const land = async (mod: string, sp: Record<string, string>) => {
    const { default: forward } = await import(mod);
    try {
      await forward({ searchParams: Promise.resolve(sp) });
    } catch (e) {
      const url = String((e as { digest?: string }).digest ?? '').split(';').find((p) => p.startsWith('/'));
      if (url) return url;
      throw e;
    }
    throw new Error(`${mod} no longer forwards`);
  };
  assert.equal(await land('./roles/page', {}), TEAM_ROLES_HREF);
  assert.equal(await land('./roles/page', { saved: '1' }), `${TEAM_ROLES_HREF}&saved=1`);
  assert.equal(await land('./roles/inquiries/page', {}), TEAM_INQUIRIES_HREF);
  assert.equal(await land('./roles/inquiries/page', { branch: 'b1', adjust: 's1', type: 'wedding' }), `${TEAM_INQUIRIES_HREF}&branch=b1&adjust=s1&type=wedding`);
});

test('2 · ‹ over Team, one level at a time, by replacing the address; no back box or page title of their own', () => {
  const head = src('app/vendor-dashboard/team/_components/team-section-head.tsx');
  assert.match(head, /setHead\(\{ title, back: \{ label: 'Back', onBack: \(\) => router\.replace\(backTo, \{ scroll: false \}\) \} \}\);/);
  assert.match(head, /if \(head\) return null;[\s\S]*data-team-section-own-head=""/, 'a hard load has no way back');
  assert.equal((ROLES.match(/<TeamSectionHead title="Roles" backTo=\{TEAM_HREF\} \/>/g) ?? []).length, 3, 'a Roles state lost its ‹ to Team');
  assert.equal((INQ.match(/<TeamSectionHead title="Who gets new inquiries" backTo=\{TEAM_ROLES_HREF\} \/>/g) ?? []).length, 3, 'an Inquiries state lost its ‹ to Roles');
  for (const s of [ROLES, INQ]) {
    assert.doesNotMatch(s, /<BackButton\b|className="sn-h1/, 'a section draws its own back box or title');
    assert.doesNotMatch(s, /export const metadata|export default/, 'a section is still a page');
  }
});

test('3 · B14: one branch dropdown; Adjust opens under its own group, in place', () => {
  assert.doesNotMatch(INQ, /<nav[^>]*aria-label="Branch"/, 'the pill-link row is back');
  assert.match(INQ, /<BranchPick\s+value=\{branchKey\}/);
  assert.match(src('app/vendor-dashboard/team/_components/branch-pick.tsx'), /<PickMenu\b[\s\S]*router\.replace\(to, \{ scroll: false \}\)/);
  assert.doesNotMatch(INQ, /#adjust/, 'Adjust still jumps to the foot of the page');
  assert.match(INQ, /&type=\$\{encodeURIComponent\(g\.type \?\? ''\)\}`\}\s*replace\s*scroll=\{false\}/);
  const article = INQ.slice(INQ.indexOf('{s.groups.map((g) => ('), INQ.indexOf('</article>'));
  assert.match(article, /adjusting === s && adjustGroup === g[\s\S]*<AdjustPanel/, 'Adjust is not drawn under its own group');
});

test('4 · saves land back on the section; every door uses the section address', () => {
  const actions = src('app/vendor-dashboard/team/actions.ts');
  assert.match(actions, /const ROLES = TEAM_ROLES_HREF;/);
  assert.match(actions, /redirect\(`\$\{ROLES\}&\$\{status\}`\)/);
  assert.doesNotMatch(actions, /'\/vendor-dashboard\/team\/roles/, 'a save still lands on an old address');
  assert.match(src('app/vendor-dashboard/team/_components/helpers-view.tsx'), /title="Roles"[\s\S]{0,200}href=\{TEAM_ROLES_HREF\}/, 'Team’s Roles row still goes to the old address');
  assert.match(ROLES, /href=\{TEAM_INQUIRIES_HREF\}/, 'Roles’ Who gets new inquiries row still goes to the old address');
});
