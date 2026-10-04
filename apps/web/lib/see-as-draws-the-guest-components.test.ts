/**
 * 👁 SEE AS ▾ DRAWS THE GUEST PAGE'S OWN COMPONENTS (PR-10, owner 2026-10-04;
 * EVENT_DETAILS_STUDY_2026-10-04 §7, prototype screen 12).
 *
 * The Maker's 👁 Preview gains See as: a guest who hasn't replied · Replied Yes ·
 * Declined · Signed out. Each is the GUEST PAGE drawn for a SAMPLE viewer — the
 * same branch as the old `?as=replied` preview, extended — never a Maker-only
 * twin of the reply button, the ticket or the door. What this holds:
 *
 *   1 · each state resolves (verified host, the canvas) and nobody else's does;
 *   2 · each guest state is the guest tree with that reply — the arrival action
 *       under the mark reads RSVP / "You're going" / the declined line;
 *   3 · Me is drawn on the canvas for a sample guest — the guest page's own
 *       `GuestMeSection` + `GuestTicket` — and the navigator goes to it;
 *   4 · Signed out draws the stranger's door (`GetInside`), or the lock screen
 *       on a private event;
 *   5 · See as lives only in 👁 Preview (phone rows) and its desktop form above
 *       the preview — one control per width, nowhere else.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { SEE_AS, SEE_AS_PARAM, seeAsDrawsMe, seeAsOf, type SeeAs } from './see-as';
import {
  buildSimulatedGuestIdentity,
  resolveSampleViewer,
  sampleTicketSrc,
  sampleTicketState,
  SIMULATED_GUEST_ID,
} from './simulated-guest-preview';
import { resolveArrivalAction } from './arrival-action';
import type { OwnerCapability } from '../app/[slug]/_lib/site-identity';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const PAGE = read('app/[slug]/page.tsx');
const BODY = read('app/[slug]/_components/site-body.tsx');
const MAKER = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
const WORK = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');

const HOST = { ownerEventId: 'ev-1' } as unknown as OwnerCapability;
const GUEST_STATES = ['pending', 'replied', 'declined'] as const;

/** The page's sample-viewer branch, sliced out — from the resolve to the guest-session fork. */
function sampleBranch(): string {
  const from = PAGE.indexOf('const seeAs = resolveSampleViewer(');
  const to = PAGE.indexOf("if (guestViewer.kind === 'anonymous')", from);
  assert.ok(from > 0 && to > from, 'the sample-viewer branch moved — re-anchor this test');
  return PAGE.slice(from, to);
}

test('1 · the four states, in the owner’s words and order', () => {
  assert.deepEqual(
    SEE_AS.map((s) => s.label),
    ['Guest who hasn’t replied', 'Replied Yes', 'Declined', 'Signed out'],
  );
  assert.equal(SEE_AS_PARAM, 'as', 'See as rides the sample-guest preview’s own param');
  for (const s of SEE_AS) assert.equal(seeAsOf(s.key), s.key);
  assert.equal(seeAsOf(['replied']), null, 'a repeated param is never a match');
  assert.equal(seeAsOf('maybe'), null);
});

test('1 · each state resolves for a verified host’s canvas — on every stage — and for nobody else', () => {
  for (const s of SEE_AS) {
    for (const phase of ['save_the_date', 'rsvp', 'event', 'editorial'] as const) {
      assert.equal(
        resolveSampleViewer({ ownerCapability: HOST, asParam: s.key, lifecyclePhase: phase, eventId: 'ev-1', canvas: true }),
        s.key,
        `${s.key} on ${phase} is not drawn on the canvas`,
      );
    }
    // No capability, or another event's: the ordinary page, whatever the address says.
    assert.equal(resolveSampleViewer({ ownerCapability: null, asParam: s.key, lifecyclePhase: 'rsvp', eventId: 'ev-1', canvas: true }), null);
    assert.equal(resolveSampleViewer({ ownerCapability: HOST, asParam: s.key, lifecyclePhase: 'rsvp', eventId: 'ev-2', canvas: true }), null);
  }
  // Outside the canvas the old door is exactly as wide as it was: ?as=replied, the RSVP stage.
  assert.equal(resolveSampleViewer({ ownerCapability: HOST, asParam: 'replied', lifecyclePhase: 'rsvp', eventId: 'ev-1', canvas: false }), 'replied');
  assert.equal(resolveSampleViewer({ ownerCapability: HOST, asParam: 'replied', lifecyclePhase: 'event', eventId: 'ev-1', canvas: false }), null);
  for (const k of ['pending', 'declined', 'signed-out']) {
    assert.equal(resolveSampleViewer({ ownerCapability: HOST, asParam: k, lifecyclePhase: 'rsvp', eventId: 'ev-1', canvas: false }), null, `${k} leaked out of the canvas`);
  }
});

test('2 · each guest state IS the guest page’s reply state — RSVP · You’re going · the declined line', () => {
  const want: Record<(typeof GUEST_STATES)[number], { rsvp: string; action: string }> = {
    pending: { rsvp: 'pending', action: 'ask' },
    replied: { rsvp: 'attending', action: 'going' },
    declined: { rsvp: 'declined', action: 'declined' },
  };
  for (const s of GUEST_STATES) {
    const id = buildSimulatedGuestIdentity({ slug: 'w', seeAs: s });
    assert.equal(id.guest.rsvp_status, want[s].rsvp, `${s}: the sample guest has the wrong reply`);
    assert.equal(id.guestHubData.rsvpStatus, want[s].rsvp, `${s}: the hub card disagrees with the reply`);
    assert.equal(id.guest.guest_id, SIMULATED_GUEST_ID, `${s}: the sample guest must never be a real row`);
    // The arrival action under the mark is the guest page's own resolver, fed this reply.
    const action = resolveArrivalAction({ slug: 'w', rsvpStatus: id.guest.rsvp_status, eventDate: '2099-12-12', today: '2026-10-04', hasPass: false });
    assert.equal(action?.kind, want[s].action, `${s}: the hero does not read its state`);
  }
  // The old ?as=replied door still draws Replied Yes.
  assert.equal(buildSimulatedGuestIdentity({ slug: 'w' }).guest.rsvp_status, 'attending');
  // The page hands the state through — never a fixed reply.
  const branch = sampleBranch();
  assert.match(branch, /buildSimulatedGuestIdentity\(\{[\s\S]*?seeAs,[\s\S]*?\}\)/, 'the page does not hand the picked state to the sample guest');
  assert.match(branch, /<SiteBody\s+\{\.\.\.asSample\}\s+identity=\{sampleIdentity\}/, 'a guest state is not drawn by the guest page’s own SiteBody');
});

test('3 · Me draws on the canvas for the sample guest — the guest page’s own Me and ticket', () => {
  assert.equal(sampleTicketState('pending'), 'pass');
  assert.equal(sampleTicketState('replied'), 'pass', 'Replied Yes holds the ticket');
  assert.equal(sampleTicketState('declined'), 'cannotCome', 'Declined holds the declined line, no ticket');
  assert.match(sampleTicketSrc('ev-1'), /^\/api\/hub-print\/pass\?event=ev-1&mode=screen&pass_format=phone-card$/);
  for (const s of GUEST_STATES) assert.ok(seeAsDrawsMe(s));
  assert.equal(seeAsDrawsMe('signed-out'), false, 'a signed-out visitor has no Me');
  assert.equal(seeAsDrawsMe(null), false);

  const branch = sampleBranch();
  const me = branch.slice(branch.indexOf('meSection={'));
  assert.match(me, /<GuestMeSection[\s\S]*?meSlot=\{\s*<GuestTicket[\s\S]*?state=\{sampleTicketState\(seeAs\)\}[\s\S]*?src=\{sampleTicketSrc\(event\.event_id\)\}/, 'Me is not the guest page’s own GuestMeSection + GuestTicket');
  // The body draws the Me group for a sample viewer, not only on a tabbed page.
  assert.match(BODY, /\{tabs\.on \|\| sampleViewer !== null \? group\('me', \(/, 'SiteBody does not draw Me for the sample guest');
  // The navigator: no "can’t be shown" note while Me IS shown, and a Me pick goes to it.
  assert.match(WORK, /shownPage\?\.key === 'me' && !seeAsDrawsMe\(seeAs\)/);
  assert.match(WORK, /if \(key === 'me' && seeAsDrawsMe\(seeAs\)\) scrollPreviewTo\('me'\);/);
});

test('4 · Signed out draws the door — the stranger’s GetInside, or the private lock screen', () => {
  const branch = sampleBranch();
  const out = branch.slice(branch.indexOf("if (seeAs === 'signed-out')"), branch.indexOf('if (seeAs) {'));
  assert.ok(out.length > 100, 'the Signed out branch is gone');
  assert.match(out, /visibility === 'private' \|\| visibility === 'invited_accounts'[\s\S]*?<PrivateLanding/, 'a private event’s door is not its own lock screen');
  assert.match(out, /identity=\{anonymousIdentity\(\{[\s\S]*?signedInNotListed: false/, 'Signed out is not the anonymous (stranger’s) page');
  // In the canvas the door is hidden for the host — and drawn for Signed out.
  assert.match(BODY, /vendorCapability \|\| \(isEditorCanvas && sampleViewer !== 'signed-out'\) \? null : \(\s*<GetInside/);
  // …drawn as a GUEST, never as the host: the owner and supplier capabilities are dropped.
  const props = branch.slice(branch.indexOf('const asSample = sampleCanvas'), branch.indexOf("if (seeAs === 'signed-out')"));
  for (const k of ['ownerCapability: null', 'vendorCapability: null', 'supplierDesk: null', 'sampleViewer: seeAs']) {
    assert.ok(props.includes(k), `the sample is still drawn with "${k.split(':')[0]}" — it must be drawn as a guest`);
  }
});

test('5 · See as lives only in 👁 Preview — phone rows in the menu, the one dropdown above the preview on a desktop', () => {
  // Phone: rows of the Preview menu, hidden from lg up.
  const rows = MAKER.slice(MAKER.indexOf('const previewRows = '), MAKER.indexOf('  return (\n    <MakerContext.Provider'));
  assert.ok(rows.length > 400, 'Preview’s rows were not found — the scan is blind');
  assert.match(rows, /className="contents lg:hidden" data-maker-see-as-rows=""[\s\S]*?<MenuHeading>See as<\/MenuHeading>[\s\S]*?SEE_AS\.map/);
  assert.equal((MAKER.match(/SEE_AS\.map/g) ?? []).length, 1, 'See as is drawn twice in the shell');
  // Desktop: the one dropdown, above the canvas, from lg up.
  assert.equal((WORK.match(/label="See as"/g) ?? []).length, 1, 'there is not exactly one See as dropdown');
  assert.match(WORK, /className="mb-2 hidden w-full shrink-0 items-center lg:flex" data-maker-see-as=""/);
  const canvasAt = WORK.indexOf('<BufferedCanvasFrame');
  assert.ok(WORK.indexOf('data-maker-see-as=""') < canvasAt, 'See as is not above the preview');
  // Nowhere else reads the states: not Page ▾, not Details, not the inspector.
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (n === 'node_modules' || n.startsWith('.')) return [];
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
    });
  const readers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((f) => /from '(@\/lib\/|\.\/|\.\.\/)*see-as'/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(WEB.length + 1))
    .sort();
  assert.deepEqual(readers, [
    'app/[slug]/_components/site-body.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-context.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-shell.tsx',
    'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx',
    'lib/simulated-guest-preview.ts',
  ], 'See as is read somewhere new — it lives only in 👁 Preview (and the guest page that draws it)');
});

test('5 · no Maker-only twin: the Maker draws none of the guest states itself', () => {
  for (const [name, src] of [['maker-shell', MAKER], ['editor-shell', WORK]] as const) {
    assert.doesNotMatch(src, /GuestTicket|GetInside|You’re going|Save my ticket|We’ll miss you/, `${name} draws a guest state of its own`);
  }
  // The canvas address is the SAME draft preview, plus ?as= — never another page.
  assert.match(WORK, /\?phase=\$\{stage\}&editor=1\$\{guestBars \? '&bars=1' : ''\}\$\{seeAs \? `&\$\{SEE_AS_PARAM\}=\$\{seeAs\}` : ''\}/);
  const keys: SeeAs[] = SEE_AS.map((s) => s.key);
  assert.equal(new Set(keys).size, 4);
});
