/**
 * EVERY EMAIL SAYS WHETHER IT ARRIVED — the verdicts, EXECUTED.
 *
 * lib/email-delivery-log.ts decides what a person is told about an email. Every
 * rule here is run, not grepped: a wrong verdict is exactly the defect this
 * project keeps shipping (a failure that renders like success or like nothing).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  verdictOf,
  isDueForCheck,
  maskRecipient,
  summarize,
  homeAlert,
  STOP_ASKING_AFTER_MS,
  RECHECK_AFTER_MS,
  type DeliveryRow,
} from './email-delivery-log';

const NOW = Date.parse('2026-09-18T12:00:00Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function row(p: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    delivery_id: 'd1',
    created_at: iso(60_000),
    kind: 'other',
    recipient_masked: 'te•••@gmail.com',
    subject: 's',
    outcome: 'accepted',
    provider_message_id: 'msg_1',
    error: null,
    scheduled_for: null,
    last_event: null,
    last_event_checked_at: null,
    ...p,
  };
}

test('Resend events map to what a person is told', () => {
  const cases: Array<[string | null, string]> = [
    ['delivered', 'delivered'],
    ['opened', 'delivered'],
    ['clicked', 'delivered'],
    ['bounced', 'failed'],
    ['complained', 'failed'],
    ['failed', 'failed'],
    ['suppressed', 'failed'],
    ['canceled', 'cancelled'],
    ['sent', 'waiting'],
    ['queued', 'waiting'],
    ['delivery_delayed', 'waiting'],
    [null, 'waiting'],
  ];
  for (const [ev, want] of cases) {
    assert.equal(verdictOf(row({ last_event: ev }), NOW), want, `last_event=${ev}`);
  }
});

test('our own refusal outcomes never read as delivered or waiting', () => {
  // Even with a stray 'delivered' event on the row, a send we never made is not delivered.
  assert.equal(verdictOf(row({ outcome: 'send_failed', last_event: 'delivered' }), NOW), 'failed');
  assert.equal(verdictOf(row({ outcome: 'not_configured', provider_message_id: null }), NOW), 'not_sent');
});

test('an accepted email Resend never answered for is "no answer", not "waiting" forever', () => {
  assert.equal(verdictOf(row({ created_at: iso(STOP_ASKING_AFTER_MS + 1) }), NOW), 'unknown');
  assert.equal(verdictOf(row({ created_at: iso(STOP_ASKING_AFTER_MS - 1) }), NOW), 'waiting');
  // A scheduled send's clock starts at its scheduled time, not at creation.
  assert.equal(
    verdictOf(row({ created_at: iso(STOP_ASKING_AFTER_MS + 1), scheduled_for: iso(1000) }), NOW),
    'waiting',
  );
});

test('the checker asks only about accepted, unsettled, due rows', () => {
  assert.equal(isDueForCheck(row(), NOW), true, 'fresh accepted row with an id');
  assert.equal(isDueForCheck(row({ provider_message_id: null }), NOW), false, 'no id to ask about');
  assert.equal(isDueForCheck(row({ outcome: 'send_failed' }), NOW), false, 'never sent');
  assert.equal(isDueForCheck(row({ last_event: 'delivered' }), NOW), false, 'already settled');
  assert.equal(isDueForCheck(row({ last_event: 'bounced' }), NOW), false, 'already settled');
  assert.equal(isDueForCheck(row({ last_event: 'delivery_delayed' }), NOW), true, 'still moving');
  assert.equal(
    isDueForCheck(row({ last_event_checked_at: iso(RECHECK_AFTER_MS - 1) }), NOW),
    false,
    'asked too recently',
  );
  assert.equal(
    isDueForCheck(row({ last_event_checked_at: iso(RECHECK_AFTER_MS + 1) }), NOW),
    true,
    'asked long enough ago',
  );
  assert.equal(
    isDueForCheck(row({ scheduled_for: new Date(NOW + 60_000).toISOString() }), NOW),
    false,
    'not due to go out yet',
  );
  assert.equal(isDueForCheck(row({ created_at: iso(STOP_ASKING_AFTER_MS + 1) }), NOW), false, 'given up');
});

test('a recipient is masked, never stored whole', () => {
  assert.equal(maskRecipient('iscasasolaii@gmail.com'), 'is•••@gmail.com');
  assert.equal(maskRecipient('ab@x.ph'), 'a•••@x.ph');
  assert.equal(maskRecipient('a@X.COM'), 'a•••@x.com');
  for (const bad of ['', 'noatsign', '@x.com', 'x@']) {
    assert.equal(maskRecipient(bad), '•••', `input ${JSON.stringify(bad)}`);
  }
  // The local part beyond two characters never survives.
  assert.ok(!maskRecipient('secretname@gmail.com').includes('cret'));
});

test('summary counts every row exactly once', () => {
  const rows = [
    row({ last_event: 'delivered' }),
    row({ last_event: 'bounced' }),
    row({ outcome: 'not_configured', provider_message_id: null }),
    row(),
    row({ created_at: iso(STOP_ASKING_AFTER_MS + 1) }),
  ];
  const s = summarize(rows, NOW);
  assert.deepEqual(s, { delivered: 1, failed: 1, not_sent: 1, cancelled: 0, waiting: 1, unknown: 1, total: 5 });
});

test('the home strip speaks only for trouble — and never mistakes an unreadable log for a quiet week', () => {
  const quiet = summarize([], NOW);
  const good = summarize([row({ last_event: 'delivered' }), row()], NOW);

  assert.equal(homeAlert({ configured: true, readFailed: false, summary: quiet }), null, 'nothing sent');
  assert.equal(homeAlert({ configured: true, readFailed: false, summary: good }), null, 'all fine');

  const off = homeAlert({ configured: false, readFailed: false, summary: quiet });
  assert.equal(off?.tone, 'danger');
  assert.match(off!.headline, /switched off/);

  const unread = homeAlert({ configured: true, readFailed: true, summary: null });
  assert.ok(unread, 'an unreadable log must not render as nothing');
  assert.match(unread!.detail, /not the same as/);

  const bounced = homeAlert({
    configured: true,
    readFailed: false,
    summary: summarize([row({ last_event: 'bounced' }), row({ outcome: 'send_failed' })], NOW),
  });
  assert.equal(bounced?.tone, 'danger');
  assert.match(bounced!.headline, /^2 emails did not arrive/);

  const one = homeAlert({
    configured: true,
    readFailed: false,
    summary: summarize([row({ last_event: 'complained' })], NOW),
  });
  assert.match(one!.headline, /^1 email did not arrive/);

  const silent = homeAlert({
    configured: true,
    readFailed: false,
    summary: summarize([row({ created_at: iso(STOP_ASKING_AFTER_MS + 1) })], NOW),
  });
  assert.equal(silent?.tone, 'warning');
});
