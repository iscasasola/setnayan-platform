import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssignmentNotice,
  shouldNotifyAssignment,
  VENDOR_ASSIGNMENT_NOTIFICATION_TYPE,
  type VendorAssignmentInput,
} from '@/lib/vendor-team-assignment-notice';

const ADMIN = 'admin-user-id';
const AGENT = 'agent-user-id';

function input(over: Partial<VendorAssignmentInput> = {}): VendorAssignmentInput {
  return {
    assigneeUserId: AGENT,
    actorUserId: ADMIN,
    subject: { kind: 'services', serviceCount: 2 },
    ...over,
  };
}

test('a real hand-off notifies', () => {
  assert.equal(shouldNotifyAssignment(input()), true);
  assert.equal(
    shouldNotifyAssignment(
      input({ subject: { kind: 'booking', eventName: 'Cruz Wedding' } }),
    ),
    true,
  );
});

test('never notifies yourself', () => {
  assert.equal(shouldNotifyAssignment(input({ assigneeUserId: ADMIN })), false);
  assert.equal(buildAssignmentNotice(input({ assigneeUserId: ADMIN })), null);
});

test('clearing every service is not a hand-off — no notification', () => {
  const cleared = input({ subject: { kind: 'services', serviceCount: 0 } });
  assert.equal(shouldNotifyAssignment(cleared), false);
  assert.equal(buildAssignmentNotice(cleared), null);
  const negative = input({ subject: { kind: 'services', serviceCount: -1 } });
  assert.equal(shouldNotifyAssignment(negative), false);
});

test('a missing recipient never notifies', () => {
  assert.equal(shouldNotifyAssignment(input({ assigneeUserId: '' })), false);
  assert.equal(buildAssignmentNotice(input({ assigneeUserId: '' })), null);
});

test('booking notice uses the locked § 7 copy and points at the recipient', () => {
  const n = buildAssignmentNotice(
    input({ subject: { kind: 'booking', eventName: 'Cruz Wedding', eventDateIso: '2027-02-14' } }),
  );
  assert.ok(n);
  assert.equal(n.userId, AGENT);
  assert.equal(n.type, VENDOR_ASSIGNMENT_NOTIFICATION_TYPE);
  assert.equal(n.title, "You've been booked for Cruz Wedding");
  assert.match(n.body, /2027-02-14/);
  assert.equal(n.relatedUrl, '/vendor-dashboard/customers');
});

test('booking notice without a date drops the date clause', () => {
  const n = buildAssignmentNotice(
    input({ subject: { kind: 'booking', eventName: 'Cruz Wedding', eventDateIso: null } }),
  );
  assert.ok(n);
  assert.equal(n.body, "Your team assigned this booking to you — Cruz Wedding. It's on your calendar.");
});

test('a blank event name falls back to "an event" rather than an empty title', () => {
  const n = buildAssignmentNotice(input({ subject: { kind: 'booking', eventName: '   ' } }));
  assert.ok(n);
  assert.equal(n.title, "You've been booked for an event");
});

test('title never exceeds the notifications CHECK ceiling of 160 chars', () => {
  const n = buildAssignmentNotice(
    input({ subject: { kind: 'booking', eventName: 'E'.repeat(500) } }),
  );
  assert.ok(n);
  assert.ok(n.title.length <= 160, `title was ${n.title.length} chars`);
});

test('service notice pluralises correctly', () => {
  const one = buildAssignmentNotice(input({ subject: { kind: 'services', serviceCount: 1 } }));
  assert.ok(one);
  assert.equal(one.title, "You've been assigned 1 service");
  const many = buildAssignmentNotice(input({ subject: { kind: 'services', serviceCount: 4 } }));
  assert.ok(many);
  assert.equal(many.title, "You've been assigned 4 services");
});
