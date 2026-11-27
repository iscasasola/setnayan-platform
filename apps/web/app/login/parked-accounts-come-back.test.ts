/**
 * 🔁 A PARKED ACCOUNT IS ONE TAP AWAY ON /login (Batch 0 · L1, MASTER-PLAN L5, walk 27 Nov 12a).
 *
 * "Add another account" parks the current session (its refresh token in a jar at `/auth/accounts`, its display row in
 * `sn_accts`) and opens `/login`. The page offered no way back: the parked account stayed unreachable until someone
 * signed in. Now `/login` reads the same display list the avatar sheet reads and draws the sheet's OWN row
 * (`OtherAccountRow`), which posts to the same switch route. No new server action, no second row design.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OtherAccountRow } from '@/app/_components/account-switcher/other-account-row';

// The component file uses the classic JSX transform under tsx; hand it React the way the other render tests do.
(globalThis as unknown as { React: unknown }).React = React;

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const ACCT = { uid: '0f0e0d0c-0b0a-4909-8807-060504030201', email: 'ana@example.com', name: 'Ana Reyes' };

test('the row posts the account to the switch route, carrying where /login was going', () => {
  const html = renderToStaticMarkup(createElement(OtherAccountRow, { acct: ACCT, next: '/dashboard/abc/guests', className: 'row' }));
  assert.match(html, /<form [^>]*action="\/auth\/accounts\/switch" method="post"/);
  assert.match(html, new RegExp(`name="uid" value="${ACCT.uid}"`));
  assert.match(html, /name="next" value="\/dashboard\/abc\/guests"/);
  assert.match(html, /<button type="submit" class="row">/, 'a real press: a submit button, never a dead tap');
  assert.match(html, /Ana Reyes/);
  assert.match(html, /ana@example\.com/);
  const sheet = renderToStaticMarkup(createElement(OtherAccountRow, { acct: ACCT, className: 'row' }));
  assert.doesNotMatch(sheet, /name="next"/, "the sheet sends no next: the switch lands on the route's own Home");
});

test('/login reads the parked list and hands it to the card; the card draws the shared row', () => {
  const page = strip(read('app/login/page.tsx'));
  assert.match(page, /decodeParkedList\(cookieStore\.get\(ACCOUNTS_LIST_COOKIE\)\?\.value\)/);
  assert.match(page, /parked=\{parked\}/);
  const modal = strip(read('app/login/_components/sign-in-card-modal.tsx'));
  assert.match(modal, /<OtherAccountRow[\s\S]*?next=\{card\.next\}/);
});

test('one row, two seats: the avatar sheet draws the same OtherAccountRow and no hand copy of it', () => {
  const sheet = strip(read('app/_components/account-switcher/account-switcher.tsx'));
  assert.match(sheet, /<OtherAccountRow key=\{acct\.uid\} acct=\{acct\}/);
  assert.equal((sheet.match(/\/auth\/accounts\/switch/g) ?? []).length, 0, 'the switch form lives only in the shared row');
});

test('the switch route lands on a same-site next only after the switch worked', () => {
  const route = strip(read('app/auth/accounts/switch/route.ts'));
  assert.match(route, /if \(isSafeNext\(next\) && next !== '\/'\) landing = new URL\(next, request\.url\);/);
  assert.match(route, /NextResponse\.redirect\(result\.ok \? landing : home, \{ status: 303 \}\)/);
});
