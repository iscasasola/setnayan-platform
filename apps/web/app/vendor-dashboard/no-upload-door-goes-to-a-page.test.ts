/**
 * 🔒 AN UPLOAD DOOR OPENS THE DEVICE'S PICKER, NEVER A PAGE (owner, 9 Nov, on Shop › Cover photo: *"When on desktop.
 * Upload is upload on files not go to a page. Mobile is the phone's gallery"*; then, on Facebook's cover / profile
 * photo menus: *"It just opens the same menu. See cover photo/profile photo. Upload photo"*).
 *
 *   1 · No "Upload" door anywhere under app/ links to Portfolio's uploader (`collections#gallery-media`) — not as a
 *       hero's `upload: { href }`, not as a row titled Upload. (Portfolio's own hero, ON the uploader's page, keeps its
 *       in-page `#gallery-media`: it is the same screen.)
 *   2 · The door is a real file input with `accept="image/*"` inside a label — the press opens the browser's file
 *       dialog / the phone's library natively — and what is picked goes into the SHIPPED `PortfolioForm` through
 *       `FileUpload`'s `pickedFiles`, lazily (its own chunk), never a second uploader.
 *   3 · Today's and Shop's heroes mount that door; Shop's Cover and Logo sheets are the one short menu.
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-09): put `upload: { href: '/vendor-dashboard/collections#gallery-media' }`
 *   back on Today (red: 1); swap `accept={PHOTO_PICK_ACCEPT}` for `accept="image/png"` (red: 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · no Upload door hrefs Portfolio’s uploader page', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n === '.next') continue;
      const f = join(dir, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.tsx?$/.test(n) && !n.includes('.test.')) {
        const s = stripComments(readFileSync(f, 'utf8'));
        if (/upload\s*[:=]\s*\{?\s*\{\s*href:\s*['"`][^'"`]*collections#gallery-media/i.test(s)) hits.push(`${relative(WEB, f)} · upload: { href }`);
        if (/title="Upload[^"]*"[^>]*href="[^"]*collections#gallery-media/.test(s)) hits.push(`${relative(WEB, f)} · an Upload row`);
      }
    }
  };
  walk(join(WEB, 'app'));
  assert.deepEqual(hits, [], `an Upload door goes to a page:\n${hits.join('\n')}`);
});

test('2 · the door is a native picker into the shipped PortfolioForm — the uploader alone', () => {
  const door = read('app/vendor-dashboard/_components/portfolio-upload.tsx');
  assert.match(door, /export const PHOTO_PICK_ACCEPT = 'image\/\*';/);
  assert.match(door, /<label\b[\s\S]*?<input\s+type="file"\s+accept=\{PHOTO_PICK_ACCEPT\}/, 'the door is not a label around a file input');
  // 📦 The uploader is `portfolio-form.tsx` ALONE, imported statically. Measured on the integration (#7416): every on-demand
  // load of it (from gallery-media, its own file, `picked-pages`, a `photo-parts` chunk) put the chunks it named into the
  // webpack runtime — on EVERY page — and over the 202.3 KB shared lock. Never all of `gallery-media.tsx` (Instagram,
  // next/image, the video editor ride along), and no on-demand import in either door file.
  assert.match(door, /^import \{ PortfolioForm \} from '\.\.\/shop\/_components\/portfolio-form';$/m, 'the door does not draw the shipped PortfolioForm from its own file');
  assert.doesNotMatch(door, /gallery-media/, 'the door loads all of Portfolio’s Add photos, not the uploader alone');
  for (const f of ['app/vendor-dashboard/_components/portfolio-upload.tsx', 'app/vendor-dashboard/shop/_components/photo-menus.tsx']) {
    assert.doesNotMatch(read(f), /(?<![\w.])import\(/, `${f}: an on-demand import — each chunk it names is a runtime entry on every page`);
  }
  assert.doesNotMatch(door, /<FileUpload\b/, 'a second uploader');
  assert.match(door, /<PortfolioForm\b[\s\S]*?\baddOnly\b[\s\S]*?pickedFiles=\{files\}/);
  const form = read('app/vendor-dashboard/shop/_components/portfolio-form.tsx');
  assert.match(form, /export function PortfolioForm\(/);
  assert.match(form, /pickedFiles=\{pickedFiles\}/, 'PortfolioForm does not hand the picked files to its FileUpload');
  assert.match(form, /<input key=\{r\} type="hidden" name="portfolio_r2_keys" value=\{r\} \/>/, 'add-only mode drops the stored photos from the save (it replaces the list)');
  const fu = read('app/_components/file-upload.tsx');
  assert.match(fu, /pickedFiles\?: readonly File\[\] \| null;/);
  assert.match(fu, /void handleFiles\(\[\.\.\.pickedFiles\]\)/, 'picked files skip the one intake door (checks · room · watermark · QR guard)');
});

test('3 · Today and Shop mount the door; the Cover and Logo sheets are the one menu', () => {
  assert.match(read('app/vendor-dashboard/page.tsx'), /<PortfolioUploadDoor\b/, 'Today’s hero Upload is not the picker');
  assert.match(read('app/vendor-dashboard/shop/_components/shop-cover.tsx'), /<PortfolioUploadDoor\b/, 'Shop’s hero Upload is not the picker');
  const page = read('app/vendor-dashboard/shop/page.tsx');
  assert.match(page, /<CoverPhotoMenu\b/);
  assert.match(page, /<LogoPhotoMenu\b/);
  const menus = read('app/vendor-dashboard/shop/_components/photo-menus.tsx');
  for (const w of ['See cover photo', 'Upload photo', 'Choose cover photo', 'See profile photo']) assert.ok(menus.includes(w), `the menu lost “${w}”`);
  assert.match(menus, /<PortfolioUploadBody facts=\{facts\} files=\{files\} coverPick \/>/, 'a cover upload is not pre-picked as the cover');
  assert.match(menus, /pickedLogo=\{files\}/, 'a logo upload skips the shipped framer');
  assert.match(menus, /<PhotoViewer\b/, 'See … photo is not the shared viewer');
});
