/**
 * 📷 GUARD — A HOST WHO OPENS THE EVENT HUB CAMERA GETS THEIR OWN CAMERA, NEVER A DEAD END
 * (owner 2026-11-22, priority live fix: Papic was "On — everyone, now · Guests' cameras are open now" on his own event
 * and the Hub camera did not work).
 *
 * THE CAUSE, pinned so it cannot come back: the Hub's bar always gives the couple a live Camera (`site-nav.ts`,
 * "Unconditional. It is their wedding.") and sends it to `/papic/guest`, which until this fix knew only an invited
 * guest's session — so a host landed on "Open your invitation first." These checks FAIL on the code before the fix:
 * the page had no host branch at all (2, 3), and the lib did not exist (1).
 *
 *   1 · the refusals are words with a way on — never the guest's "open your invitation" for a host;
 *   2 · the guest-camera page asks "is this a host?" BEFORE it shows the guest's dead end, and a host with a camera is
 *       sent to the existing capture page (`/papic/seat/[token]`) — not a second camera;
 *   3 · the host check is the viewer's OWN membership on their own session, the camera is the existing host camera
 *       (the Memories mint + the Memories claim), and "adding is off" is said rather than left as a dead shutter;
 *   4 · the Hub still hands the couple a Camera tab to that page (the premise of the whole fix).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { hostCameraHref, hostCameraRefusal } from '@/lib/papic-host-door';
import { resolveSiteNav } from '@/app/[slug]/_lib/site-nav';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('1 · every refusal is a title, a sentence and a way on — never the guest’s door', () => {
  for (const reason of ['adding_off', 'no_camera', 'full', 'unavailable', 'taken', 'claim_failed'] as const) {
    const r = hostCameraRefusal(reason);
    assert.ok(r.title.length > 8 && r.words.length > 30, `${reason} says nothing`);
    assert.doesNotMatch(`${r.title} ${r.words}`, /invitation|personal QR|invite link/i, `${reason} sends a host to their invitation`);
    assert.match(r.words, /Memories|again/, `${reason} names no way on`);
  }
  assert.match(hostCameraRefusal('adding_off').words, /Turn it on in Memories/);
  assert.equal(hostCameraHref('a b/c'), '/papic/seat/a%20b%2Fc');
  // ↩️ The Hub tab rides along (owner 2026-11-22, "back to where they were last") — a tab key only, never a URL.
  assert.equal(hostCameraHref('tok', 'gallery'), '/papic/seat/tok?back=gallery');
  assert.equal(hostCameraHref('tok', null), '/papic/seat/tok');
  assert.equal(hostCameraHref('tok', 'https://evil.example'), '/papic/seat/tok', 'a URL rode along as the tab');
});

test('2 · the guest-camera page asks about a host BEFORE the guest’s dead end, and sends them to the existing camera', () => {
  const page = code('app/papic/guest/page.tsx');
  const noSession = page.indexOf('if (!session) {');
  const hostAsk = page.indexOf('await hostCameraDoor(backSlug)');
  const deadEnd = page.indexOf('title="Open your invitation first."');
  assert.ok(noSession > 0 && deadEnd > noSession, 'premise: the guest’s door is still there for a guest');
  assert.ok(hostAsk > noSession && hostAsk < deadEnd, 'a host still lands on "Open your invitation first." — the dead camera is back');
  assert.match(page, /if \(host\.kind === 'camera'\) redirect\(hostCameraHref\(host\.token, backTab\)\);/, 'a host with a camera is not sent to it — or not with the tab they came from');
  assert.match(page, /if \(host\.kind === 'refused'\) \{[\s\S]{0,700}title=\{host\.title\}[\s\S]{0,200}sub=\{host\.words\}[\s\S]{0,400}\/memories`\}/, 'a refused host gets no words or no way on');
  // Only a link that names its event can be a host's: a bare visit asks nothing.
  assert.match(page, /const host = backSlug \? await hostCameraDoor\(backSlug\) : \(\{ kind: 'not_host' \} as const\);/);
});

test('3 · the host check is the viewer’s own membership; the camera is the existing host camera', () => {
  const door = code('lib/papic-host-door.server.ts');
  assert.match(door, /if \(!user \|\| user\.is_anonymous\) return \{ kind: 'not_host' \};/);
  assert.match(
    door,
    /await supabase\s*\.from\('event_members'\)[\s\S]{0,200}\.eq\('event_id', row\.event_id\)\s*\.eq\('user_id', user\.id\)\s*\.eq\('member_type', 'couple'\)[\s\S]{0,80}if \(!membership\) return \{ kind: 'not_host' \};/,
    'the host check is not the viewer’s own couple membership',
  );
  const member = door.indexOf("if (!membership) return { kind: 'not_host' };");
  const mint = door.indexOf('provisionUploadsCameraAdmin(');
  const claim = door.indexOf('startAddingPhotos(row.event_id)');
  assert.ok(member > 0 && mint > member && claim > mint, 'the camera is minted or claimed before the host check');
  assert.match(door, /provisionUploadsCameraAdmin\(admin, row\.event_id, \{ validFrom: win\.startIso, validUntil: win\.endIso \}, user\.id\)/, 'the mint is not the viewer’s own host camera');
  assert.match(door, /if \(\(row\.papic_uploads_open \?\? true\) === false\) return refused\('adding_off'\);/, '"adding is off" is a dead shutter again');
  assert.doesNotMatch(door, /paparazzi_seats'\)\s*\.(insert|upsert)/, 'a second camera was invented');
});

test('4 · the Hub still hands the couple a live Camera to the guest-camera page (the premise)', () => {
  const slots = resolveSiteNav({
    viewer: { kind: 'couple' },
    phase: 'before',
    hostAllowsCamera: true,
    anyChapterPublic: false,
    hasStory: true,
    hasDetails: true,
    liveBroadcast: false,
    postEvent: { film: false, suppliers: false },
    destinations: { camera: '/papic/guest?from=ana', watch: '/ana/hub', join: '/ana/invite', film: '#f', suppliers: '#s' },
  } as Parameters<typeof resolveSiteNav>[0]);
  const camera = slots.find((s) => s.key === 'camera');
  assert.ok(camera && camera.state === 'live' && camera.href === '/papic/guest?from=ana');
  assert.match(code('app/[slug]/_components/site-body.tsx'), /camera: hostCameraOpen \? `\/papic\/guest\?from=\$\{event\.slug\}` : null,/);
});
