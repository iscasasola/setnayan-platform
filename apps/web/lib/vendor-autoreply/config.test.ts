import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_ACCEPT_THRESHOLD_MAX,
  AUTO_ACCEPT_THRESHOLD_MIN,
  DAILY_AUTO_ACCEPT_CAP_MAX,
  DAILY_REPLY_CAP_MAX,
  DAILY_REPLY_CAP_MIN,
  parseAutoReplyConfigForm,
} from './config';

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

test('enabled=true parses to a toggle-only patch', () => {
  const res = parseAutoReplyConfigForm(form({ enabled: 'true' }));
  assert.deepEqual(res, { ok: true, patch: { enabled: true } });
});

test('enabled=false parses to a toggle-only patch', () => {
  const res = parseAutoReplyConfigForm(form({ enabled: 'false' }));
  assert.deepEqual(res, { ok: true, patch: { enabled: false } });
});

test('enabled is case/whitespace tolerant', () => {
  const res = parseAutoReplyConfigForm(form({ enabled: ' TRUE ' }));
  assert.deepEqual(res, { ok: true, patch: { enabled: true } });
});

test('garbage enabled value is rejected, not coerced to false', () => {
  const res = parseAutoReplyConfigForm(form({ enabled: 'on' }));
  assert.equal(res.ok, false);
});

test('daily cap happy path patches only the cap', () => {
  const res = parseAutoReplyConfigForm(form({ daily_reply_cap: '45' }));
  assert.deepEqual(res, { ok: true, patch: { daily_reply_cap: 45 } });
});

test('daily cap accepts the bounds', () => {
  const lo = parseAutoReplyConfigForm(form({ daily_reply_cap: String(DAILY_REPLY_CAP_MIN) }));
  assert.deepEqual(lo, { ok: true, patch: { daily_reply_cap: DAILY_REPLY_CAP_MIN } });
  const hi = parseAutoReplyConfigForm(form({ daily_reply_cap: String(DAILY_REPLY_CAP_MAX) }));
  assert.deepEqual(hi, { ok: true, patch: { daily_reply_cap: DAILY_REPLY_CAP_MAX } });
});

test('daily cap above the ceiling is rejected', () => {
  const res = parseAutoReplyConfigForm(form({ daily_reply_cap: String(DAILY_REPLY_CAP_MAX + 1) }));
  assert.equal(res.ok, false);
});

test('negative, decimal, exponent, and non-numeric caps are rejected', () => {
  for (const bad of ['-1', '12.5', '1e2', 'abc', '', ' ', '30x']) {
    const res = parseAutoReplyConfigForm(form({ daily_reply_cap: bad }));
    assert.equal(res.ok, false, `expected reject for ${JSON.stringify(bad)}`);
  }
});

test('leading zeros are tolerated as an integer', () => {
  const res = parseAutoReplyConfigForm(form({ daily_reply_cap: '007' }));
  assert.deepEqual(res, { ok: true, patch: { daily_reply_cap: 7 } });
});

test('absurdly long digit strings fail the range check instead of overflowing', () => {
  const res = parseAutoReplyConfigForm(form({ daily_reply_cap: '9'.repeat(30) }));
  assert.equal(res.ok, false);
});

test('both fields together patch both columns', () => {
  const res = parseAutoReplyConfigForm(form({ enabled: 'true', daily_reply_cap: '10' }));
  assert.deepEqual(res, { ok: true, patch: { enabled: true, daily_reply_cap: 10 } });
});

test('one invalid field rejects the whole form (no partial patch)', () => {
  const res = parseAutoReplyConfigForm(form({ enabled: 'true', daily_reply_cap: '-3' }));
  assert.equal(res.ok, false);
});

test('an empty form is "nothing to save"', () => {
  const res = parseAutoReplyConfigForm(new FormData());
  assert.equal(res.ok, false);
});

test('unknown fields are ignored, not patched', () => {
  const res = parseAutoReplyConfigForm(
    form({ enabled: 'true', mode: 'smart', voice_profile: '{"x":1}' }),
  );
  assert.deepEqual(res, { ok: true, patch: { enabled: true } });
});

// ── Phase 4A — the auto-accept trio ─────────────────────────────────────────

test('auto_accept_enabled parses to a toggle-only patch', () => {
  const on = parseAutoReplyConfigForm(form({ auto_accept_enabled: 'true' }));
  assert.deepEqual(on, { ok: true, patch: { auto_accept_enabled: true } });
  const off = parseAutoReplyConfigForm(form({ auto_accept_enabled: ' FALSE ' }));
  assert.deepEqual(off, { ok: true, patch: { auto_accept_enabled: false } });
});

test('garbage auto_accept_enabled is rejected, not coerced', () => {
  const res = parseAutoReplyConfigForm(form({ auto_accept_enabled: 'yes' }));
  assert.equal(res.ok, false);
});

test('auto_accept_threshold accepts the DB CHECK bounds (0–100)', () => {
  const lo = parseAutoReplyConfigForm(
    form({ auto_accept_threshold: String(AUTO_ACCEPT_THRESHOLD_MIN) }),
  );
  assert.deepEqual(lo, { ok: true, patch: { auto_accept_threshold: AUTO_ACCEPT_THRESHOLD_MIN } });
  const hi = parseAutoReplyConfigForm(
    form({ auto_accept_threshold: String(AUTO_ACCEPT_THRESHOLD_MAX) }),
  );
  assert.deepEqual(hi, { ok: true, patch: { auto_accept_threshold: AUTO_ACCEPT_THRESHOLD_MAX } });
});

test('auto_accept_threshold above 100 / non-integer is rejected', () => {
  for (const bad of ['101', '-1', '78.5', 'abc', '']) {
    const res = parseAutoReplyConfigForm(form({ auto_accept_threshold: bad }));
    assert.equal(res.ok, false, `expected reject for ${JSON.stringify(bad)}`);
  }
});

test('daily_auto_accept_cap parses within its own (tighter) ceiling', () => {
  const ok = parseAutoReplyConfigForm(form({ daily_auto_accept_cap: '5' }));
  assert.deepEqual(ok, { ok: true, patch: { daily_auto_accept_cap: 5 } });
  const over = parseAutoReplyConfigForm(
    form({ daily_auto_accept_cap: String(DAILY_AUTO_ACCEPT_CAP_MAX + 1) }),
  );
  assert.equal(over.ok, false);
});

test('all five fields together patch all five columns', () => {
  const res = parseAutoReplyConfigForm(
    form({
      enabled: 'true',
      daily_reply_cap: '20',
      auto_accept_enabled: 'true',
      auto_accept_threshold: '80',
      daily_auto_accept_cap: '5',
    }),
  );
  assert.deepEqual(res, {
    ok: true,
    patch: {
      enabled: true,
      daily_reply_cap: 20,
      auto_accept_enabled: true,
      auto_accept_threshold: 80,
      daily_auto_accept_cap: 5,
    },
  });
});

test('one invalid auto-accept field rejects the whole form', () => {
  const res = parseAutoReplyConfigForm(
    form({ auto_accept_enabled: 'true', auto_accept_threshold: '200' }),
  );
  assert.equal(res.ok, false);
});
