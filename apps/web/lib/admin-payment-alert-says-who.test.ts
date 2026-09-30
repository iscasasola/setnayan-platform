/**
 * THE ADMIN PAYMENT ALERT SAYS WHO, WHICH EVENT, AND WHAT.
 *
 * Owner, 2026-09-30, holding "Payment logged · ₱245 — confirm it": *"i want
 * the email to identify also the name of the host, event type, event name, and
 * the services availed when we receive an email"*. The old alert named an
 * amount and a bank; to learn who had paid for what, the admin opened the
 * whole queue and searched. Its footer also told the admin *"you started a
 * Papic gallery for your event"* under a tagline about weddings and vendors.
 *
 * This file RENDERS the real email from a fixture — the same builder the
 * notifier calls, through the same `renderBrandedEmail` the send path uses —
 * and reads what came out. A word-grep over the source would pass with the
 * facts computed and never placed in the mail.
 *
 * The source checks at the bottom cover the one seam a render cannot: that
 * `emitNotification` actually hands the sections, subject and admin audience
 * to the renderer, and that both notifiers pass them.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADMIN_EMAIL_FOOTER,
  ADMIN_EMAIL_TAGLINE,
  renderBrandedEmail,
} from './email-template';
import {
  adminOrderDeepLink,
  buildOrderSubmittedAlert,
  buildPaymentLoggedAlert,
  type AdminOrderAlert,
  type AdminOrderAlertFacts,
} from './admin-order-alert';
import { buildDigestEmail } from './admin/digest-content';
import { deriveQueueUrgency, type AdminQueueDigest } from './admin/queue-counts';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const FACTS: AdminOrderAlertFacts = {
  orderPublicId: 'S89O-7K2M9QX4TB',
  referenceCode: 'SNM51BN2RX',
  hosts: [{ name: 'Ms. Ana Lopez Reyes', email: 'ana.reyes@example.test' }],
  paidBy: null,
  event: { name: 'Birthday Salubong ni Ate', typeLabel: 'Birthday' },
  lines: [
    { label: 'Papic — 500 credits', pricePhp: 245 },
    { label: 'Setnayan AI', pricePhp: 1500 },
  ],
  totalPhp: 1745,
  payment: {
    amountPhp: 245,
    channel: 'gcash',
    bankReference: '0031 882 1190',
    loggedAtIso: '2026-09-30T07:04:00Z',
  },
};

/** The email exactly as emitNotification renders it for an admin alert. */
function render(alert: AdminOrderAlert): { subject: string; html: string } {
  const html = renderBrandedEmail({
    heading: alert.title,
    paragraphs: alert.paragraphs,
    sections: alert.sections,
    ctaLabel: alert.ctaLabel,
    ctaHref: `https://setnayan.test${alert.relatedUrl}`,
    audience: 'admin',
  });
  return { subject: alert.subject, html };
}

/** The bottom line of the card — tagline + why-you-got-this. */
function footerOf(html: string): string {
  const at = html.lastIndexOf('<hr');
  assert.ok(at > -1, 'the footer rule is where this test looks — it moved');
  return html.slice(at);
}

// HTML-escaped once by the renderer (& → &amp;), so compare on that form.
const esc = (s: string) => s.replace(/&/g, '&amp;');

test('the payment alert names the host, the event, every service, the reference and the link', () => {
  const alert = buildPaymentLoggedAlert(FACTS);
  const { subject, html } = render(alert);
  console.log(`subject: ${subject}`);

  assert.equal(subject, 'Payment logged · ₱245 · Birthday Salubong ni Ate (Birthday) — confirm it');
  for (const needle of [
    'Ms. Ana Lopez Reyes',
    'ana.reyes@example.test',
    'Birthday Salubong ni Ate',
    'Event type',
    '>Birthday<',
    'Papic — 500 credits',
    '₱245.00',
    'Setnayan AI',
    '₱1,500.00',
    '₱1,745.00',
    'GCash',
    'SNM51BN2RX',
    '0031 882 1190',
    'S89O-7K2M9QX4TB',
    '(Manila)',
    'Confirm this payment',
  ]) {
    assert.ok(html.includes(esc(needle)), `the rendered email must carry: ${needle}`);
  }
  // The button opens THIS order on the desk, not the homepage.
  assert.ok(
    html.includes(`href="https://setnayan.test/admin/payments?filter=all&q=S89O-7K2M9QX4TB"`),
    'the button must deep-link to this order on the payments desk',
  );
});

test('the deep link carries the order id and nothing personal', () => {
  const link = adminOrderDeepLink(FACTS.orderPublicId);
  assert.equal(link, '/admin/payments?filter=all&q=S89O-7K2M9QX4TB');
  const alert = buildPaymentLoggedAlert(FACTS);
  for (const personal of ['ana', 'Reyes', 'example.test', 'SNM51BN2RX', '0031', 'Salubong']) {
    assert.ok(!alert.relatedUrl.includes(personal), `the URL must not carry "${personal}"`);
  }
});

test('the admin footer says why an admin got it — no wedding, no vendor, no Papic gallery', () => {
  const { html } = render(buildPaymentLoggedAlert(FACTS));
  const footer = footerOf(html);
  assert.ok(footer.includes(esc(ADMIN_EMAIL_FOOTER)), 'the admin reason line must be the footer');
  assert.ok(footer.includes(ADMIN_EMAIL_TAGLINE), 'the admin tagline must be the brand line');
  assert.doesNotMatch(footer, /wedding/i, '17 event types — the admin footer must not say wedding');
  assert.doesNotMatch(footer, /vendor/i, 'we say supplier, not vendor');
  assert.doesNotMatch(footer, /Papic gallery/i, 'an admin did not start a Papic gallery');
  assert.match(footer, /supplier/i);
});

test('the order-submitted alert carries the same details', () => {
  const alert = buildOrderSubmittedAlert({ ...FACTS, payment: null }, 'Onboarding services');
  const { subject, html } = render(alert);
  assert.match(subject, /Birthday Salubong ni Ate \(Birthday\)/);
  for (const needle of ['Ms. Ana Lopez Reyes', 'Papic — 500 credits', 'Setnayan AI', '₱1,745.00', 'SNM51BN2RX']) {
    assert.ok(html.includes(esc(needle)), `the order alert must carry: ${needle}`);
  }
  assert.ok(html.includes('q=S89O-7K2M9QX4TB'));
  assert.doesNotMatch(footerOf(html), /wedding|vendor|Papic gallery/i);
});

test('a guest payer is named as a guest, beside the host', () => {
  const { html } = render(
    buildPaymentLoggedAlert({
      ...FACTS,
      paidBy: { name: 'Tita Merly', email: null, guest: true },
    }),
  );
  assert.ok(html.includes('Tita Merly · guest, no Setnayan account'));
  assert.ok(html.includes('Ms. Ana Lopez Reyes'), 'the host is still named');
});

test('an unreadable fact is SAID, never silently dropped', () => {
  const { html } = render(
    buildPaymentLoggedAlert({ ...FACTS, hosts: 'unreadable', event: 'unreadable', lines: 'unreadable' }),
  );
  const said = html.split('Could not read').length - 1;
  assert.equal(said, 3, 'host, event and services must each say they could not be read');
});

test('the morning digest wears the admin footer too', () => {
  const digest: AdminQueueDigest = {
    disputes: { count: 1, oldestAt: '2026-09-29T00:00:00Z' },
    payments: { count: 2, oldestAt: '2026-09-29T00:00:00Z' },
  };
  const { html } = buildDigestEmail(digest, deriveQueueUrgency(digest, Date.parse('2026-09-30T00:00:00Z')));
  const footer = footerOf(html);
  assert.ok(footer.includes(esc(ADMIN_EMAIL_FOOTER)));
  assert.doesNotMatch(footer, /wedding|vendor|Papic gallery/i);
});

// ── the seam a render cannot see ────────────────────────────────────────────

test('emitNotification hands the sections, subject and admin audience to the mail', () => {
  const src = read('lib/notification-emit.ts');
  const html = src.slice(src.indexOf('const html = renderBrandedEmail('));
  const call = html.slice(0, html.indexOf('});'));
  assert.match(call, /sections: mail\?\.sections/, 'the facts must reach the HTML');
  assert.match(call, /audience: 'admin'/, 'the admin footer must reach the HTML');
  assert.match(src, /subject: mail\?\.subject \?\? title/, 'the subject must be the alert subject');
  assert.match(src, /\.\.\.sectionLines/, 'the plain-text half must carry the same facts');
});

test('both admin order alerts pass the full email to emitNotification', () => {
  const src = read('lib/order-admin-notify.ts');
  for (const fn of ['notifyAdminsOrderAwaitingReconciliation', 'notifyAdminsPaymentProofSubmitted']) {
    const body = src.slice(src.indexOf(`export async function ${fn}`));
    const own = body.slice(0, body.indexOf('\n}\n'));
    assert.match(own, /readAdminOrderAlertFacts\(admin, orderId\)/, `${fn} must read the facts`);
    assert.match(own, /sections: alert\.sections/, `${fn} must send the details`);
    assert.match(own, /relatedUrl: alert\?\.relatedUrl/, `${fn} must deep-link to the order`);
    assert.match(own, /audience: 'admin'/, `${fn} must wear the admin footer`);
  }
});
