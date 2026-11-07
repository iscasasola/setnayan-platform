/**
 * Guard: Inquire on a shop page opens the one pop-up, for every shop — including one with no service — and the
 * shop page no longer sends anybody to "Plan with Setnayan".
 *
 * The reports (owner, 7 Nov 2026):
 *   • "inquire does nothing" — SetnaProd (verified, solo plan, 0 active services): Inquire scrolled to a section that
 *     said the shop "hasn't listed a service you can ask about yet. Check back soon" and offered nothing to press.
 *   • "Plan with Setnayan" on the shop (the header link and the button at the foot of Inquire) went to /signup —
 *     away from the shop the person came to ask.
 *   • the ask itself: "a pop up to first ask what service/s … then connect them to which event … and send inquire".
 *
 * A page CI cannot click, so the wiring is held from source, comments stripped (the prose above each block names the
 * retired things on purpose). The address round trip is held for real.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inquireClearedHref, inquireResumeHref, inquireResumeOf, NO_SERVICES_LINE } from '../../../lib/shop-inquire';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const strip = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/ .*$/gm, '');
const read = (p: string) => strip(readFileSync(p, 'utf8'));

const page = read(join(HERE, 'page.tsx'));
const sheet = read(join(HERE, '_components', 'inquire-sheet.tsx'));
const action = read(join(HERE, 'inquiry-actions.ts'));

/** Every file that draws a shop page: /v/[slug] and everything under it, and the bare-root /[slug] that renders it. */
function shopPageFiles(): string[] {
  const out: string[] = [join(APP, '[slug]', 'page.tsx')];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
  };
  walk(HERE);
  return out;
}

test('no shop page renders "Plan with Setnayan"', () => {
  const offenders = shopPageFiles().filter((f) => /plan with setnayan/i.test(read(f)));
  assert.deepEqual(offenders, [], `"Plan with Setnayan" is retired on shop pages (owner 2026-11-07): ${offenders.join(', ')}`);
});

test('the shop page mounts the pop-up for every bookable shop — never behind having a service', () => {
  assert.match(page, /\{bookable \? \(\s*<InquireSheet\b/, 'the Inquire pop-up must be mounted on `bookable` alone');
  const at = page.indexOf('<InquireSheet');
  const before = page.slice(Math.max(0, at - 400), at);
  assert.doesNotMatch(
    before,
    /activeServices\.length|composerInitial|inquireServices\.length/,
    'the pop-up is gated on having a service — a shop with none (SetnaProd) would have an Inquire that does nothing',
  );
  assert.match(page, /services=\{inquireServices\}/);
});

test('a shop with no service still has a working Inquire: the pop-up asks a general question', () => {
  assert.match(sheet, /const general = services\.length === 0;/, 'the pop-up must know a shop with no service');
  assert.match(sheet, /\bgeneral,\s*\n/, 'the send must carry `general` so the server accepts an ask with no card');
  assert.match(sheet, /NO_SERVICES_LINE\(shop\.name\)/, 'the one plain line must say the shop has no services listed');
  // …and the server accepts it, through the same send.
  assert.match(action, /const general = input\.general === true && !initialServiceId;/);
  assert.match(action, /if \(!vendorProfileId \|\| \(!initialServiceId && !general\)\)/);
  assert.match(action, /if \(general\) \{[\s\S]{0,400}saveVendorToPicks\(form\)/, 'a general ask still puts the shop on the event');
  // The section's dead end is gone, and it has its own way in.
  assert.doesNotMatch(page, /Check back soon/, 'the dead-end "Check back soon" is back on the shop page');
  assert.match(page, /<a href="#get-in-touch"[^>]*data-inquire-general-ask=""/);
});

test('every Inquire on the page opens the pop-up, which sends through the ONE inquiry action', () => {
  assert.match(sheet, /closest\?\.\('a\[href="#get-in-touch"\]'\)/, 'the pop-up no longer catches the page’s Inquire links');
  const imports = sheet.match(/from '[^']*inquiry-actions'/g) ?? [];
  assert.equal(imports.length, 1);
  assert.match(sheet, /import \{ startServiceInquiry, type StartServiceInquiryResult \} from '@\/app\/v\/\[slug\]\/inquiry-actions';/);
  assert.match(sheet, /send = startServiceInquiry/);
  assert.doesNotMatch(sheet, /\bfetch\(|from '[^']*\/actions'|from '[^']*-actions'(?<!inquiry-actions')/, 'a second send path');
});

test('signed out: the shipped sign-in sheet opens first — never a link to /signup', () => {
  assert.match(sheet, /if \(!signedIn\) \{[\s\S]{0,400}openSignIn\(\{ onSignedIn: \(\) => open\(/);
  assert.doesNotMatch(sheet, /['"`]\/signup/, 'the pop-up links to /signup');
});

test('the address carries the ask through sign-in and a new event, keeping where the visit came from', () => {
  const resume = inquireResumeHref('https://www.setnayan.com/setnaprod?src=discover#get-in-touch', ['a', 'b']);
  assert.equal(resume, '/setnaprod?src=discover&inquire=1&isvc=a%2Cb');
  assert.deepEqual(inquireResumeOf(resume.slice(resume.indexOf('?'))), { serviceIds: ['a', 'b'] });
  assert.equal(inquireResumeOf('?src=discover'), null);
  assert.equal(inquireClearedHref(`https://x.test${resume}`), '/setnaprod?src=discover');
  assert.equal(inquireResumeHref('/v/setnaprod?event=e1', []), '/v/setnaprod?event=e1&inquire=1');
  assert.match(NO_SERVICES_LINE('SetnaProd'), /^SetnaProd has no services listed yet/);
});
