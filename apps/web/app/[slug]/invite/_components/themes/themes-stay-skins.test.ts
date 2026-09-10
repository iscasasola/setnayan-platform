/**
 * themes-stay-skins.test.ts — five invite themes, one product.
 *
 * Owner 2026-09-10: five themes, House free and four under Event Hub Pro, on the
 * couple's reveal background. What keeps five themes ONE product is that a theme
 * is a SKIN on DoorShell: it owns what sits behind and around the card, never
 * the card, its edge or its one action. And what keeps them from costing every
 * other page is that no theme's stylesheet ever reaches the shared chunk.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { groundFromBackground } from '@/lib/invite-ground-rule';

/** A presign that proves it was reached — the rule decides; the wrapper signs. */
const fakePresign = async (ref: string) => `signed:${ref}`;
const resolveInviteGround = (raw: unknown) => groundFromBackground(raw, fakePresign);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry) && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

test('DoorShell imports no stylesheet — a theme can never reach the shared chunk through it', () => {
  const shell = stripComments(read('app/_components/door/door-shell.tsx'));
  assert.doesNotMatch(shell, /import\s+[^;]*\.css['"]/, 'DoorShell imports CSS — every door route would pay for every theme');
  assert.doesNotMatch(shell, /import\s+['"][^'"]+\.css['"]/, 'DoorShell side-imports CSS');
});

test('a theme stylesheet is imported only from the invite routes’ own theme folder', () => {
  const themesDir = join(WEB, 'app', '[slug]', 'invite', '_components', 'themes');
  const sheets = readdirSync(themesDir).filter((f) => f.endsWith('.module.css'));
  assert.ok(sheets.length >= 1, 'no theme stylesheet found — the Capiz skin is gone');
  const offenders: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const sheet of sheets) {
      if (src.includes(sheet) && !file.startsWith(themesDir)) offenders.push(relative(WEB, file));
    }
  }
  assert.deepEqual(offenders, [], `a theme stylesheet is imported outside app/[slug]/invite/_components/themes: ${offenders.join(', ')}`);
});

test('a skin never restyles the card’s controls — its only reach inside the card is the header', () => {
  const themesDir = join(WEB, 'app', '[slug]', 'invite', '_components', 'themes');
  for (const sheet of readdirSync(themesDir).filter((f) => f.endsWith('.module.css'))) {
    const css = stripComments(readFileSync(join(themesDir, sheet), 'utf8'));
    const globals = [...css.matchAll(/:global\(([^)]*)\)/g)].map((m) => (m[1] ?? '').trim());
    assert.deepEqual(
      globals.filter((g) => g !== 'header'),
      [],
      `${sheet} reaches into the card beyond its header (${globals.join(', ')}) — the card, its edge and its one action are DoorShell's`,
    );
    assert.doesNotMatch(css, /button-primary|\bbutton\b|\binput\b|border-top/, `${sheet} restyles a control or the card's edge`);
  }
});

test('saving a Pro theme is re-checked on the server, after the couple check, before the write', () => {
  const src = stripComments(read('app/dashboard/[eventId]/guests/invite/actions.ts'));
  const start = src.indexOf('export async function setInviteTheme(');
  assert.notEqual(start, -1, 'setInviteTheme is gone or renamed');
  const body = src.slice(start);
  const couple = body.indexOf('assertCouple(eventId)');
  const pro = body.indexOf('eventCoupleWebsiteProActive(');
  const write = body.indexOf(".update({ invite_theme");
  assert.ok(couple > -1 && pro > -1 && write > -1, 'a step of the save is missing');
  assert.ok(couple < pro && pro < write, 'the Pro re-check must come after the couple check and before the write');
  assert.match(body, /!INVITE_THEMES\[raw\]\.ready/, 'an unshipped theme could be saved');
});

test('the ground honours a genuine upload only, and never mistakes "unset" for a colour', async () => {
  assert.deepEqual(await resolveInviteGround(null), { photo: null, color: null }, 'unset must show the theme’s own ground');
  assert.deepEqual(
    await resolveInviteGround({ kind: 'upload', value: 'https://evil.example/x.jpg' }),
    { photo: null, color: null },
    'a URL-shaped upload would be painted verbatim — the SEC-6 trap',
  );
  assert.deepEqual(await resolveInviteGround({ kind: 'plain', value: '#112233' }), { photo: null, color: '#112233' });
  assert.deepEqual(await resolveInviteGround({ kind: 'nonsense' }), { photo: null, color: null }, 'a malformed row read as a chosen colour');
  const scene = await resolveInviteGround({ kind: 'realistic', value: 'golden-hour' });
  assert.equal(scene.photo, '/std/backgrounds/golden-hour.webp');
  const upload = await resolveInviteGround({ kind: 'upload', value: 'r2://setnayan-media/events/x/std-background/a.jpg' });
  assert.equal(upload.photo, 'signed:r2://setnayan-media/events/x/std-background/a.jpg', 'a genuine upload is not signed and shown');
});
