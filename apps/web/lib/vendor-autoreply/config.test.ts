import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_ACCEPT_THRESHOLD_MAX,
  AUTO_ACCEPT_THRESHOLD_MIN,
  parseAutoReplyConfigForm,
  parseVoiceSwitchesForm,
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

test('a daily cap posted by an old tab is ignored — never patched (no per-day limit)', () => {
  // Owner 2026-10-23: no limit on the assistant. A stale client may still post
  // the two retired fields; they must never reach the row.
  const res = parseAutoReplyConfigForm(
    form({ enabled: 'true', daily_reply_cap: '45', daily_auto_accept_cap: '5' }),
  );
  assert.deepEqual(res, { ok: true, patch: { enabled: true } });
  const alone = parseAutoReplyConfigForm(form({ daily_reply_cap: '45' }));
  assert.equal(alone.ok, false, 'a cap alone is "nothing to save", not a patch');
});

test('leading zeros are tolerated as an integer', () => {
  const res = parseAutoReplyConfigForm(form({ auto_accept_threshold: '007' }));
  assert.deepEqual(res, { ok: true, patch: { auto_accept_threshold: 7 } });
});

test('absurdly long digit strings fail the range check instead of overflowing', () => {
  const res = parseAutoReplyConfigForm(form({ auto_accept_threshold: '9'.repeat(30) }));
  assert.equal(res.ok, false);
});

test('one invalid field rejects the whole form (no partial patch)', () => {
  const res = parseAutoReplyConfigForm(form({ enabled: 'true', auto_accept_threshold: '-3' }));
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

// ── Phase 4A — auto-accept (the switch + the threshold) ─────────────────────────────────────────

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

test('all three fields together patch all three columns', () => {
  const res = parseAutoReplyConfigForm(
    form({
      enabled: 'true',
      auto_accept_enabled: 'true',
      auto_accept_threshold: '80',
    }),
  );
  assert.deepEqual(res, {
    ok: true,
    patch: {
      enabled: true,
      auto_accept_enabled: true,
      auto_accept_threshold: 80,
    },
  });
});

test('one invalid auto-accept field rejects the whole form', () => {
  const res = parseAutoReplyConfigForm(
    form({ auto_accept_enabled: 'true', auto_accept_threshold: '200' }),
  );
  assert.equal(res.ok, false);
});

/* ─── Advanced voice-match switches ───────────────────────────────────────── */

test('voice switches: mode parses to exactly the two DB CHECK values', () => {
  assert.deepEqual(parseVoiceSwitchesForm(form({ mode: 'smart' })), {
    ok: true,
    patch: { mode: 'smart' },
  });
  assert.deepEqual(parseVoiceSwitchesForm(form({ mode: 'free' })), {
    ok: true,
    patch: { mode: 'free' },
  });
});

test('voice switches: an out-of-CHECK mode is refused, never coerced', () => {
  for (const bad of ['pro', 'SMART', 'advanced', '', 'true']) {
    assert.equal(parseVoiceSwitchesForm(form({ mode: bad })).ok, false, bad);
  }
});

test('voice switches: the learn opt-out parses both ways', () => {
  assert.deepEqual(parseVoiceSwitchesForm(form({ learn_from_past_messages: 'false' })), {
    ok: true,
    patch: { learn_from_past_messages: false },
  });
  assert.deepEqual(parseVoiceSwitchesForm(form({ learn_from_past_messages: 'true' })), {
    ok: true,
    patch: { learn_from_past_messages: true },
  });
  assert.equal(parseVoiceSwitchesForm(form({ learn_from_past_messages: 'maybe' })).ok, false);
});

test('voice switches: an empty form patches nothing (never clobbers)', () => {
  assert.deepEqual(parseVoiceSwitchesForm(form({})), { ok: true, patch: {} });
});
