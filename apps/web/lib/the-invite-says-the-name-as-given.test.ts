/**
 * THE COUPLE'S INVITE MESSAGE SAYS THE NAME AS GIVEN.
 *
 * Owner, verbatim, 2026-09-30: *"we want the copy to indicate the name as given.
 * to them"*. The `{name}` in "Send invite" / "Copy message" (the guest card, the
 * guest page, "Send invites one by one", the Invitation page, an accepted
 * request) is the guest's name exactly as the couple entered it on the Guest
 * list — `guestFullName`: their Display name when they set one, else the five
 * parts composed — never a first name alone.
 *
 * Held two ways: what the builder writes, and that every couple-side caller
 * hands it the formal name (`SendInviteGuest.formalName` is required, so the
 * compiler holds the card; this file holds the direct `buildGuestInviteMessage`
 * calls, which the type cannot).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { buildGuestInviteMessage } from '@/lib/guest-invite-message';
import { guestFullName } from '@/lib/guests';

const MANUEL = {
  display_name: null,
  name_prefix: 'Mr.',
  first_name: 'Manuel',
  middle_name: 'Cortez',
  last_name: 'Casasola',
  name_suffix: 'Jr.',
};

test('the message for a guest with all five parts greets the whole formal name', () => {
  const msg = buildGuestInviteMessage({
    formalName: guestFullName(MANUEL),
    firstName: MANUEL.first_name,
    guestName: 'Manuel Casasola',
    inviteUrl: 'https://www.setnayan.com/x?invite=t',
    hostsName: 'Ice & Claire',
    eventWord: 'wedding',
  });
  assert.ok(msg);
  assert.match(msg, /^Hi Mr\. Manuel Cortez Casasola Jr\.! /, 'the greeting is not the name as given');
  // The couple's own wording fills the same name.
  const own = buildGuestInviteMessage({
    formalName: guestFullName(MANUEL),
    firstName: 'Manuel',
    inviteUrl: 'https://www.setnayan.com/x?invite=t',
    template: 'Dear {name}, see you! {link}',
  });
  assert.match(own ?? '', /^Dear Mr\. Manuel Cortez Casasola Jr\., see you!/);
});

test('the couple’s Display name, when they set one, is the name as given', () => {
  const msg = buildGuestInviteMessage({
    formalName: guestFullName({ ...MANUEL, display_name: 'Tito Boy & Tita Cora' }),
    firstName: 'Manuel',
    inviteUrl: 'https://www.setnayan.com/x?invite=t',
  });
  assert.match(msg ?? '', /^Hi Tito Boy & Tita Cora!/);
});

const DASHBOARD = join(__dirname, '..', 'app', 'dashboard');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('every couple-side message is built with the formal name', () => {
  const calls: string[] = [];
  const missing: string[] = [];
  for (const file of walk(DASHBOARD)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/buildGuestInviteMessage\(\{/g)) {
      const body = src.slice(m.index!, src.indexOf('})', m.index!));
      const where = `${relative(DASHBOARD, file)}@${m.index}`;
      calls.push(where);
      if (!/\bformalName:/.test(body)) missing.push(where);
    }
  }
  assert.ok(calls.length >= 3, `found only ${calls.length} message builds — the scan is not looking`);
  assert.deepEqual(missing, [], 'a couple-side invite message is built without the name as given');
});
