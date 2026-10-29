/**
 * THE SUPPLIER'S INVITE TEXT IS THE APPROVED ONE — word for word (DECISION_LOG 2026-10-30, "THE INVITE TEXTS — GUEST
 * AND SELF-ADDED SUPPLIER — APPROVED; A SELF-ADDED SUPPLIER GETS A SHARE BUTTON, AN AUTOMATIC CLAIM LINK AND A DIGITAL
 * CARD"; owner → *"perfect"*).
 *
 * The ruling's text is quoted below exactly as the row records it (each " / " a new line). The builder must hold it
 * line for line, fill it from real facts, and elide an absent fact with its lead-in — never "on ." or "Hi !".
 * The digital card's own measurements are `lib/the-supplier-card-is-the-prototype.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPLIER_INVITE_LINES,
  buildSupplierInviteMessage,
  supplierEventPhrase,
  supplierGreetingName,
} from './supplier-invite-message';

/** The ruling, verbatim (DECISION_LOG.md, 2026-10-30). */
const APPROVED =
  "Hi {supplier}! 👋 / You're part of the team behind {event} on {date}, and we're so glad to have you as our {service}. / We're bringing everything together on Setnayan. Tap to join our event — it only takes a minute: / {link} / Our date, venue, schedule and payments in one place, plus your own card and price. It's free for you. / This link was made just for our event, so please keep it between us. / Let's make it unforgettable. ✨ / {hosts}";

const NOW = new Date(Date.UTC(2026, 9, 30));
const FULL = {
  shopName: 'Bloom & Ribbon Styling',
  contactPerson: 'Liza Mendoza',
  eventWord: 'wedding',
  eventDate: '2026-12-18',
  datePrecision: 'day',
  service: 'Stylist / Decorator',
  hostsName: 'Indalecio & Claire',
  link: 'https://www.setnayan.com/vendor/claim/abc123',
  now: NOW,
};

test('the template is the ruling, line for line', () => {
  assert.deepEqual([...SUPPLIER_INVITE_LINES], APPROVED.split(' / '));
});

test('filled from real facts, it reads exactly as approved', () => {
  assert.equal(
    buildSupplierInviteMessage(FULL),
    [
      'Hi Liza! 👋',
      "You're part of the team behind our wedding on Friday, December 18, and we're so glad to have you as our Stylist / Decorator.",
      "We're bringing everything together on Setnayan. Tap to join our event — it only takes a minute:",
      'https://www.setnayan.com/vendor/claim/abc123',
      "Our date, venue, schedule and payments in one place, plus your own card and price. It's free for you.",
      'This link was made just for our event, so please keep it between us.',
      "Let's make it unforgettable. ✨",
      'Indalecio & Claire',
    ].join('\n'),
  );
});

test('the year is said only when it is not this year (the guest message’s date rule)', () => {
  assert.match(buildSupplierInviteMessage({ ...FULL, eventDate: '2027-02-13' })!, / on Saturday, February 13, 2027, and /);
});

test('an absent fact takes its lead-in with it', () => {
  const noDate = buildSupplierInviteMessage({ ...FULL, eventDate: null })!;
  assert.match(noDate, /behind our wedding, and we're so glad/);
  assert.doesNotMatch(noDate, / on [,.]| on $/m);
  const monthOnly = buildSupplierInviteMessage({ ...FULL, datePrecision: 'month' })!;
  assert.doesNotMatch(monthOnly, /December/);
  const noHosts = buildSupplierInviteMessage({ ...FULL, hostsName: '  ' })!;
  assert.ok(noHosts.endsWith("Let's make it unforgettable. ✨"), 'an unsigned message ends on its last line');
  const noService = buildSupplierInviteMessage({ ...FULL, service: null })!;
  assert.match(noService, /we're so glad to have you\./);
  assert.doesNotMatch(noService, /\{|\}/);
});

test('it greets the contact person by first name, else the shop', () => {
  assert.equal(supplierGreetingName({ shopName: 'Kuya Ben Sounds', contactPerson: '' }), 'Kuya Ben Sounds');
  assert.equal(supplierGreetingName({ shopName: 'X', contactPerson: '  Maria  Santos ' }), 'Maria');
  assert.match(buildSupplierInviteMessage({ ...FULL, contactPerson: null })!, /^Hi Bloom & Ribbon Styling! 👋\n/);
});

test('the couple speaks: "our wedding", "our event"', () => {
  assert.equal(supplierEventPhrase('wedding'), 'our wedding');
  assert.equal(supplierEventPhrase('Debut'), 'our debut');
  assert.equal(supplierEventPhrase(null), 'our event');
});

test('no link, no message — and a name is never read as a placeholder', () => {
  assert.equal(buildSupplierInviteMessage({ ...FULL, link: '  ' }), null);
  const odd = buildSupplierInviteMessage({ ...FULL, contactPerson: '$& {link}', hostsName: '{supplier}' })!;
  assert.match(odd, /^Hi \$&! 👋\n/);
  assert.ok(odd.endsWith('\n{supplier}'));
  assert.equal(odd.split(FULL.link).length, 2, 'the link appears exactly once');
});
