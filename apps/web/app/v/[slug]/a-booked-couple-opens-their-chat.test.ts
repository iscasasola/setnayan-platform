/**
 * CHAT-08 (W1 walk 16 Nov 2026): A BOOKED COUPLE'S BUTTON ON THE SHOP PAGE OPENS THEIR CHAT.
 *
 * Measured live: the booked couple on /testnayanw1lights pressed Inquire → `#get-in-touch`, which holds only "See more
 * suppliers". The shop page had no way into the conversation they already had (the 13 Nov rewrite dropped its thread
 * lookup with the inline composers). The one button stays the one button — booked, it reads "Message" and opens the
 * door their Messages list opens; everyone else keeps the shipped Inquire (one-inquire-button.test.ts).
 *
 * SABOTAGE (each run once, each went red): render the Inquire anchor whatever `bookedChatHref` is; read the booking
 * with the admin client inside `viewerBookedChatHref`; drop the booked statuses from its read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('booked, the shop’s one button opens the existing chat; otherwise it is the shipped Inquire', () => {
  const page = src('app/v/[slug]/page.tsx');
  assert.match(
    page,
    /const bookedChatHref = canMessage && viewerSignedIn && !viewerOwnsShop \? await viewerBookedChatHref\(supabase, vendor\.vendor_profile_id\) : null;/,
    'the page no longer asks whether this viewer is booked with the shop',
  );
  assert.match(
    page,
    /\{bookedChatHref === null \? \(\s*<a href="#get-in-touch" className=\{SHOP_MAIN_INQUIRE_CLASS\} data-shop-main-inquire="">[\s\S]*?Inquire\s*<\/a>\s*\) : \(\s*<Link href=\{bookedChatHref\} className=\{SHOP_MAIN_INQUIRE_CLASS\} data-shop-main-inquire="" data-booked-chat="">[\s\S]*?Message\s*<\/Link>\s*\)\}/,
    'a booked couple’s button is not the door into their chat',
  );
});

test('the booking is read under the viewer’s own session, with the shared booked statuses, through the one door', () => {
  const lib = src('lib/shop-booking.server.ts');
  const fn = lib.slice(lib.indexOf('export async function viewerBookedChatHref'), lib.indexOf('export async function bookedCounterpartyPhone'));
  assert.ok(fn.length > 200, 'could not find viewerBookedChatHref');
  assert.doesNotMatch(fn, /createAdminClient\(/, 'another person’s booking could answer — read it under the viewer’s session');
  assert.match(fn, /\.in\('status', CONFIRMED_VENDOR_STATUSES as unknown as string\[\]\)/, 'booked is not the shared fact');
  assert.match(fn, /return coupleChatHref\(booked\.event_id,/, 'the door is not the one the Messages list opens');
});
