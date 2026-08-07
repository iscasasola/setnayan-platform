import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE HOST CAN REMOVE ANY PHOTO — BOTH KINDS.
 *
 * Owner-locked 2026-08-07, verbatim: *"host can delete any photo and that's
 * it."* (Superseding the same day's larger matrix — guests, vendors and
 * coordinators deliberately do NOT get self-delete.)
 *
 * WHY THIS EXISTS. "Any photo" was already true for GUEST uploads
 * (`setCaptureHidden` on papic_guest_captures) and quietly false for SEAT
 * photos — the main Papic captures, and how a vendor or coordinator shoots.
 *
 * 🔑 THE PLUMBING WAS COMPLETE AND THE CONTROL WAS MISSING. `papic_photos`
 * already HAS `hidden_at`, and every reader already honoured it — the guest
 * download route, the single-photo route, and the couple's own library all
 * filter on it. The only writer was a Setnayan admin acting on a user report.
 * A column every reader respects, with no host-side writer, is a control the
 * host does not have — and the host screen only listed seat photos the NSFW
 * filter had already flagged, so they were not even visible.
 *
 * That is this project's recurring shape: a gate with no handle. See also the
 * face-vector mode, which had zero writers for seven weeks.
 *
 * WHAT THIS PINS: the host-facing WRITE exists for both tables, and the host's
 * moderation screen loads seat photos UNCONDITIONALLY rather than only the
 * auto-screened ones.
 */

const WEB = process.cwd();
const MOD = join(WEB, 'app/dashboard/[eventId]/studio/papic/moderation');

const read = (p: string) => readFileSync(join(MOD, p), 'utf8');
/** Comment-stripped: assertions must hold on CODE, not on the notes about it. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

test('the host has a removal action for BOTH photo tables', () => {
  const actions = code('actions.ts');

  // Self-check: an empty read would satisfy every assertion below.
  assert.ok(actions.length > 500, 'actions.ts read as near-empty — the path is wrong');

  for (const [table, fn] of [
    ['papic_guest_captures', 'setCaptureHidden'],
    ['papic_photos', 'setSeatPhotoHidden'],
  ] as const) {
    assert.match(
      actions,
      new RegExp(`export async function ${fn}\\b`),
      `${fn} is gone — the host can no longer remove photos from ${table}`,
    );
  }

  // The seat action must actually write hidden_at on papic_photos. A function
  // that exists but updates the wrong table is the same defect wearing a name.
  const seatBlock = actions.slice(actions.indexOf('setSeatPhotoHidden'));
  assert.match(
    seatBlock,
    /from\('papic_photos'\)[\s\S]{0,200}hidden_at/,
    'setSeatPhotoHidden must update papic_photos.hidden_at',
  );
  // Tenancy: the update must be bound to the event, or one couple could hide
  // another wedding's photo by id.
  assert.match(
    seatBlock,
    /\.eq\('event_id', eventId\)/,
    'setSeatPhotoHidden must scope its update to the event',
  );
});

test('the host screen lists EVERY seat photo, not only the auto-screened ones', () => {
  const page = code('page.tsx');

  // There are two papic_photos reads on this page: the NSFW-screened one (which
  // filters on moderation_state) and the full list (which must not). Assert a
  // read exists that selects hidden_at WITHOUT a moderation_state filter.
  const reads = page.split("from('papic_photos')").slice(1);
  assert.ok(reads.length >= 2, `expected 2 papic_photos reads, found ${reads.length}`);

  const unfiltered = reads.filter((chunk) => {
    const stmt = chunk.slice(0, 400);
    return stmt.includes('hidden_at') && !stmt.includes('moderation_state');
  });
  assert.ok(
    unfiltered.length >= 1,
    'the moderation page has no unfiltered papic_photos read. If seat photos are ' +
      'only loaded when moderation_state is nsfw_blocked, the host cannot see — ' +
      'and therefore cannot remove — the photos their own cameras took.',
  );

  assert.match(
    page,
    /setSeatPhotoHidden\.bind\(null, eventId\)/,
    'the seat-photo hide control is not wired into a form on the host screen — ' +
      'an action nobody can press is not a control',
  );
});
