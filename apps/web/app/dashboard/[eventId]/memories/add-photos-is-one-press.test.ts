/**
 * ＋ ADD PHOTOS IS ONE PRESS, AND IT CAN ALWAYS FIND ITS CAMERA (owner 2026-10-26, live: "on memories. it seems there is
 * no add photos" · "the turn on is not working as well fix it").
 *
 * What the owner met: + Add photos opened a sheet with a paragraph and a raw gold "Turn this on" (the class it wore,
 * `sn-btn-primary`, is a modifier of a base `.sn-btn` nobody applied — no padding, no radius). Pressing it read the
 * event's Uploads camera, found NO ROW (only the studio render minted it, and that render now sends the couple Home
 * first), and answered "please try again" — for ever. Measured in production: 7 of 13 live events had no camera.
 *
 * Held here: the Memories render mints the camera (inside the host branch — `the-uploads-camera-has-no-back-door.test.ts`
 * holds the security half); the sheet is the uploader at once, its main button opens the picker, and the first pick
 * claims the camera on the way (`startAddingPhotos`), saying any refusal on the sheet; no TSX wears a raw `sn-btn-*`
 * modifier without its base. The claim's database half is `tests/db/the-uploads-camera-is-claimed-once.db.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const PAGE = read('app/dashboard/[eventId]/memories/page.tsx');
const PICKER = read('app/dashboard/[eventId]/studio/papic/_components/add-to-library.tsx');
const ACTIONS = read('app/dashboard/[eventId]/studio/papic/actions.ts');

/** The source of one exported async function, up to the next top-level export. */
function fn(src: string, name: string): string {
  const at = src.indexOf(`export async function ${name}(`);
  if (at < 0) return '';
  const next = src.indexOf('\nexport ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}

test('the Memories host branch mints the camera BEFORE it reads it — so the press always finds one', () => {
  const branch = /\n  if \(host\) \{[\s\S]*?\n  \}\n/.exec(PAGE)?.[0] ?? '';
  assert.ok(branch, 'the host branch is gone — every rule below would be vacuous');
  const mintAt = branch.indexOf('provisionUploadsCameraAdmin(');
  const readAt = branch.indexOf('readHostCamera(admin, eventId, user.id)');
  assert.ok(mintAt > 0, 'Memories no longer mints the Uploads camera — on an event whose studio page nobody opened, the press finds no camera');
  assert.ok(readAt > mintAt, 'the camera is read before it is minted — the first visit draws a sheet with no camera behind it');
});

test('the sheet is the uploader at once — no "Turn this on" step, no form, no redirect-only claim', () => {
  assert.doesNotMatch(PAGE, /Turn this on/, 'the Memories sheet asks to "Turn this on" again before it lets anyone add a photo');
  assert.doesNotMatch(PAGE, /claimUploadsCamera/, 'the redirect-only claim is back on the sheet');
  assert.match(PAGE, /<AddToLibrary token=\{token\} eventId=\{eventId\}/, 'the unclaimed camera no longer gets the uploader (with the event, so it can claim on the pick)');
});

test('the first pick claims the camera on the way, and a refusal is SAID on the sheet', () => {
  const pick = /const onPick = useCallback\([\s\S]*?\n    \[send, record/.exec(PICKER)?.[0] ?? '';
  assert.ok(pick, 'the pick handler is gone or restructured beyond recognition');
  const claimAt = pick.indexOf('startAddingPhotos(eventId)');
  const sendAt = pick.indexOf('await send(');
  assert.ok(claimAt > 0, 'the pick no longer claims an unclaimed camera — the files would go up with no token');
  assert.ok(sendAt > claimAt, 'a file is sent before the camera is claimed');
  assert.match(pick, /if \(!tokenRef\.current\)/, 'the claim is no longer gated on "not yet claimed" — every pick would claim');
  assert.match(pick, /setClaimRefused\(claim\.words\)/, 'a refused claim is no longer said on the sheet');
  assert.match(PICKER, /role="alert"[^>]*data-add-photos-claim-refused/, 'the claim refusal is no longer announced');
});

test('the main button is the brand ActionButton, full width, and it opens the picker', () => {
  const btn = /<ActionButton\n[\s\S]*?\n      \/>/.exec(PICKER)?.[0] ?? '';
  assert.ok(btn, 'the picker no longer has an ActionButton');
  assert.match(btn, /tone="brand"/);
  assert.match(btn, /\n\s+main\n/, 'the picker’s button is no longer the main (filled) button');
  assert.match(btn, /'Choose photos'/, 'the button no longer says "Choose photos"');
  assert.match(btn, /w-full/, 'the button is no longer full width');
  assert.match(btn, /inputRef\.current\?\.click\(\)/, 'the button no longer opens the picker');
});

test('title + one short line: "From your phone or laptop · N credits a photo", from the one price function', () => {
  assert.match(PICKER, /\{photoCostLine\(\)\}/, 'the sheet’s one line is no longer the shared price line');
  const credits = read('app/dashboard/[eventId]/studio/papic/_lib/upload-credits.ts');
  assert.match(credits, /From your phone or laptop · \$\{countNoun\(papicCaptureCost\('photo', null, 'upload'\)/);
});

test('🔒 the one-press action keeps the gates, answers in words, and mints nothing', () => {
  const body = fn(ACTIONS, 'startAddingPhotos');
  assert.ok(body, 'startAddingPhotos is gone');
  const helperAt = body.indexOf('limitedHelperRefusal(');
  const coupleAt = body.indexOf('getCoupleEventId(');
  const adminAt = body.indexOf('createAdminClient()');
  assert.ok(helperAt > 0 && coupleAt > helperAt && adminAt > coupleAt, 'the service-role read no longer comes AFTER the helper gate and the couple check');
  assert.match(body, /supabase\.rpc\('papic_claim_seat'/, 'the claim no longer runs on the caller’s session through papic_claim_seat');
  assert.doesNotMatch(body, /redirect\(/, 'a client-called claim redirects — the sheet would be navigated away instead of saying why');
  assert.doesNotMatch(body, /provisionUploadsCameraAdmin/, 'the action mints a camera — the takeover door');
  assert.match(body, /return \{ ok: true, token: step\.claim \}/, 'the token is returned before the claim says it is this person’s');
  assert.doesNotMatch(ACTIONS, /export async function claimUploadsCamera/, 'the redirect-only claim came back beside the one-press one');
});

function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) tsx(full, out);
    else if (/\.tsx$/.test(e) && !/\.test\.tsx$/.test(e)) out.push(full);
  }
  return out;
}

test('no button wears a raw `sn-btn-*` modifier without its base — the "gold rectangle with no padding" the owner met', () => {
  const files = [...tsx(join(WEB, 'app')), ...tsx(join(WEB, 'components'))];
  assert.ok(files.length > 500, `only ${files.length} TSX files walked`);
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(["'`])([^"'`]*\bsn-btn-(?:primary|secondary|ghost)\b[^"'`]*)\1/g)) {
      if (!/(^|\s)sn-btn(\s|$)/.test(m[2]!)) offenders.push(`${f.slice(WEB.length + 1)}: "${m[2]}"`);
    }
  }
  assert.deepEqual(offenders, [], `a modifier with no base renders raw (no padding, no radius):\n  ${offenders.join('\n  ')}`);
});
