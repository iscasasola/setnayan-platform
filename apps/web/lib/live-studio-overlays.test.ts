/**
 * Live Studio WAVE 2 — broadcast-extras invariants (Node built-in test runner, run
 * via tsx). Guards the pure resolver + normalizers that decide what actually goes to
 * air (lib/live-studio-overlays.ts), because free-vs-paid here is not cosmetic:
 *
 *   1. PAID GATE      — Ⓜ monogram + ▬ lower third resolve to NOTHING for a host
 *                       who does not own LIVE_STUDIO, even with the columns set to
 *                       true. This is what makes a replayed/stale enable harmless.
 *   2. LAPSE          — the same is true for a host whose unlock lapsed: settings
 *                       persist, permission does not.
 *   3. FREE QR        — the event-QR overlay is the ONE overlay a free host gets
 *                       (owner-locked: a scan-to-join code grows Setnayan).
 *   4. FORCED BRAND   — "POWERED BY SETNAYAN" is PERMANENT on the free tier. A free
 *                       host cannot remove it: the resolver never consults their
 *                       lower_third_enabled, so there is no setting to flip and no
 *                       request to replay. The paid unlock REPLACES it.
 *   5. POSITION       — the monogram is repositionable, defaults to UPPER-RIGHT
 *                       (owner lock), round-trips through the row mapper, and any
 *                       junk value falls back to the default rather than rendering
 *                       off-frame.
 *   6. TEXT           — lower-third lines are trimmed, whitespace-collapsed and
 *                       length-capped so the bar cannot be made to overflow a frame.
 *   7. ⚡ HONESTY      — the highlight button needs BOTH the unlock AND a live
 *                       broadcast; an offset is measured from went_live_at, so a
 *                       moment marked off air could never become a chapter.
 *   8. PLACEMENT MAP  — every corner in both sets resolves to a real class, so the
 *                       controller preview and the capture surface cannot disagree.
 *   9. SCHEMA DRIFT   — the TS corner sets are asserted against the migration's SQL
 *                       CHECK constraints + defaults, so the UI can never offer a
 *                       corner the database would reject on the wedding day.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_MONOGRAM_POSITION,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_QR_POSITION,
  HIGHLIGHT_LABEL_MAX,
  LOWER_THIRD_SUBTITLE_MAX,
  LOWER_THIRD_TITLE_MAX,
  MONOGRAM_POSITIONS,
  QR_POSITIONS,
  SETNAYAN_LOWER_THIRD,
  canMarkHighlight,
  formatHighlightOffset,
  highlightOffsetSeconds,
  mapOverlayRow,
  normalizeHighlightLabel,
  normalizeLowerThirdLine,
  normalizeMonogramPosition,
  normalizeQrPosition,
  overlayPositionClass,
  resolveOverlays,
  type OverlaySettings,
} from './live-studio-overlays';

/** Everything switched ON — the shape a fully-configured paid host would have. */
const ALL_ON: OverlaySettings = {
  monogramEnabled: true,
  monogramPosition: 'top-right',
  lowerThirdEnabled: true,
  lowerThirdTitle: 'MARIA ✕ JOSEF',
  lowerThirdSubtitle: 'Dinner is served — Grand Ballroom · 7:00 PM',
  eventQrEnabled: true,
  eventQrPosition: 'top-left',
};

/* ── 1 · PAID GATE ─────────────────────────────────────────────────────────── */

test('a PAID host gets their own monogram + lower third at the chosen positions', () => {
  const r = resolveOverlays({ owned: true, settings: ALL_ON, monogramText: 'M ✕ J' });

  assert.deepEqual(r.monogram, { text: 'M ✕ J', position: 'top-right' });
  assert.equal(r.lowerThird?.title, 'MARIA ✕ JOSEF');
  assert.equal(r.lowerThird?.subtitle, 'Dinner is served — Grand Ballroom · 7:00 PM');
  assert.equal(r.lowerThird?.forced, false, 'a paid host owns their bar — not forced');
  assert.deepEqual(r.eventQr, { position: 'top-left' });
});

test('a FREE host gets NO monogram even with monogram_enabled = true (paid gate)', () => {
  const r = resolveOverlays({ owned: false, settings: ALL_ON, monogramText: 'M ✕ J' });
  assert.equal(r.monogram, null, 'the monogram bug is part of the LIVE_STUDIO unlock');
});

test('a paid host with the monogram enabled but NO monogram text draws nothing', () => {
  // Nothing to draw is not the same as "draw an empty pill on the broadcast".
  const blank = resolveOverlays({ owned: true, settings: ALL_ON, monogramText: '   ' });
  assert.equal(blank.monogram, null);
  const missing = resolveOverlays({ owned: true, settings: ALL_ON, monogramText: null });
  assert.equal(missing.monogram, null);
});

test('an all-off settings row draws nothing for a paid host', () => {
  const r = resolveOverlays({
    owned: true,
    settings: DEFAULT_OVERLAY_SETTINGS,
    monogramText: 'M ✕ J',
  });
  assert.equal(r.monogram, null);
  assert.equal(r.lowerThird, null, 'a paid host who wants no bar gets no bar');
  assert.equal(r.eventQr, null);
});

/* ── 2 · LAPSE ─────────────────────────────────────────────────────────────── */

test('a LAPSED unlock renders nothing paid even though the settings persist', () => {
  // The exact adversarial case: the row still says "on" from when they owned it.
  const r = resolveOverlays({ owned: false, settings: ALL_ON, monogramText: 'M ✕ J' });
  assert.equal(r.monogram, null);
  assert.equal(r.lowerThird?.forced, true, 'they are back on the branded bar');
  assert.equal(r.lowerThird?.title, SETNAYAN_LOWER_THIRD.title);
});

/* ── 3 · FREE QR (owner lock) ──────────────────────────────────────────────── */

test('the event-QR overlay is FREE — it renders for an un-purchased host', () => {
  const r = resolveOverlays({
    owned: false,
    settings: { ...DEFAULT_OVERLAY_SETTINGS, eventQrEnabled: true, eventQrPosition: 'bottom-right' },
    monogramText: 'M ✕ J',
  });
  assert.deepEqual(
    r.eventQr,
    { position: 'bottom-right' },
    'owner-locked: a scan-to-join code is not behind the ₱3,000',
  );
});

test('event-QR is the ONLY overlay that ignores ownership', () => {
  const free = resolveOverlays({ owned: false, settings: ALL_ON, monogramText: 'M ✕ J' });
  const paid = resolveOverlays({ owned: true, settings: ALL_ON, monogramText: 'M ✕ J' });
  assert.deepEqual(free.eventQr, paid.eventQr, 'same QR either way');
  assert.notDeepEqual(free.monogram, paid.monogram, 'but the monogram differs');
});

/* ── 4 · FORCED BRANDING — the growth loop ─────────────────────────────────── */

test('a FREE stream always carries the POWERED BY SETNAYAN lower third', () => {
  const r = resolveOverlays({
    owned: false,
    settings: DEFAULT_OVERLAY_SETTINGS,
    monogramText: 'M ✕ J',
  });
  assert.equal(r.lowerThird?.title, SETNAYAN_LOWER_THIRD.title);
  assert.equal(r.lowerThird?.subtitle, SETNAYAN_LOWER_THIRD.subtitle);
  assert.equal(r.lowerThird?.forced, true);
});

test('a FREE host CANNOT remove the branded bar by turning the lower third off', () => {
  // The replay attack, expressed as data: lower_third_enabled = false on a free
  // event. If the resolver consulted it, the growth loop would be one POST away
  // from being switched off.
  const stripped = resolveOverlays({
    owned: false,
    settings: { ...ALL_ON, lowerThirdEnabled: false, lowerThirdTitle: null, lowerThirdSubtitle: null },
    monogramText: 'M ✕ J',
  });
  assert.notEqual(stripped.lowerThird, null, 'the bar survives the setting being false');
  assert.equal(stripped.lowerThird?.title, SETNAYAN_LOWER_THIRD.title);
  assert.equal(stripped.lowerThird?.forced, true);
});

test('a FREE host cannot REPLACE the branded bar with their own text either', () => {
  const hijack = resolveOverlays({
    owned: false,
    settings: { ...ALL_ON, lowerThirdTitle: 'NOT SETNAYAN', lowerThirdSubtitle: 'my own bar' },
    monogramText: 'M ✕ J',
  });
  assert.equal(hijack.lowerThird?.title, SETNAYAN_LOWER_THIRD.title);
  assert.equal(hijack.lowerThird?.subtitle, SETNAYAN_LOWER_THIRD.subtitle);
});

test('the paid unlock REPLACES the branded bar rather than stacking on it', () => {
  const paid = resolveOverlays({ owned: true, settings: ALL_ON, monogramText: 'M ✕ J' });
  assert.notEqual(paid.lowerThird?.title, SETNAYAN_LOWER_THIRD.title);
  assert.equal(paid.lowerThird?.forced, false);
});

/* ── 5 · MONOGRAM POSITION ─────────────────────────────────────────────────── */

test('the monogram default position is UPPER RIGHT (owner lock)', () => {
  assert.equal(DEFAULT_MONOGRAM_POSITION, 'top-right');
  assert.equal(MONOGRAM_POSITIONS[0], 'top-right', 'first = default in the picker');
  assert.equal(DEFAULT_OVERLAY_SETTINGS.monogramPosition, 'top-right');
});

test('every valid monogram position round-trips through the row mapper', () => {
  for (const pos of MONOGRAM_POSITIONS) {
    const mapped = mapOverlayRow({ monogram_enabled: true, monogram_position: pos });
    assert.equal(mapped.monogramPosition, pos);
    const resolved = resolveOverlays({ owned: true, settings: mapped, monogramText: 'M ✕ J' });
    assert.equal(resolved.monogram?.position, pos, `${pos} survives resolve`);
  }
});

test('a junk / missing monogram position falls back to the default, never off-frame', () => {
  assert.equal(normalizeMonogramPosition('middle-of-the-aisle'), 'top-right');
  assert.equal(normalizeMonogramPosition(undefined), 'top-right');
  assert.equal(normalizeMonogramPosition(null), 'top-right');
  assert.equal(normalizeMonogramPosition(42), 'top-right');
  // 'top-left' is a valid QR corner but NOT a monogram corner — it must not leak.
  assert.equal(normalizeMonogramPosition('top-left'), 'top-right');
});

test('the QR default corner is top-left — diagonally clear of the monogram default', () => {
  assert.equal(DEFAULT_QR_POSITION, 'top-left');
  assert.notEqual(DEFAULT_QR_POSITION, DEFAULT_MONOGRAM_POSITION, 'they must not collide');
  assert.equal(normalizeQrPosition('top-center'), 'top-left', 'not a QR corner → default');
  for (const pos of QR_POSITIONS) assert.equal(normalizeQrPosition(pos), pos);
});

test('a missing settings row maps to all-off defaults, not a crash', () => {
  assert.deepEqual(mapOverlayRow(null), DEFAULT_OVERLAY_SETTINGS);
  assert.deepEqual(mapOverlayRow(undefined), DEFAULT_OVERLAY_SETTINGS);
});

/* ── 6 · LOWER-THIRD TEXT ──────────────────────────────────────────────────── */

test('lower-third lines are trimmed, collapsed and capped', () => {
  assert.equal(normalizeLowerThirdLine('  Maria   ✕    Josef  ', LOWER_THIRD_TITLE_MAX), 'Maria ✕ Josef');
  assert.equal(normalizeLowerThirdLine('a\n\nb\tc', LOWER_THIRD_TITLE_MAX), 'a b c');
  assert.equal(
    normalizeLowerThirdLine('x'.repeat(500), LOWER_THIRD_TITLE_MAX)?.length,
    LOWER_THIRD_TITLE_MAX,
    'a 500-char "title" cannot become a paragraph across the frame',
  );
  assert.equal(
    normalizeLowerThirdLine('y'.repeat(500), LOWER_THIRD_SUBTITLE_MAX)?.length,
    LOWER_THIRD_SUBTITLE_MAX,
  );
});

test('an empty / non-string lower-third line clears it (null, not "")', () => {
  assert.equal(normalizeLowerThirdLine('', LOWER_THIRD_TITLE_MAX), null);
  assert.equal(normalizeLowerThirdLine('    ', LOWER_THIRD_TITLE_MAX), null);
  assert.equal(normalizeLowerThirdLine(null, LOWER_THIRD_TITLE_MAX), null);
  assert.equal(normalizeLowerThirdLine(7, LOWER_THIRD_TITLE_MAX), null);
});

test('a highlight label is normalized and capped the same way', () => {
  assert.equal(normalizeHighlightLabel('  The   kiss '), 'The kiss');
  assert.equal(normalizeHighlightLabel(''), null);
  assert.equal(normalizeHighlightLabel('z'.repeat(300))?.length, HIGHLIGHT_LABEL_MAX);
});

/* ── 7 · ⚡ HIGHLIGHT HONESTY ───────────────────────────────────────────────── */

test('the ⚡ button needs BOTH the unlock and a live broadcast', () => {
  assert.equal(canMarkHighlight({ owned: true, isLive: true }), true);
  assert.equal(canMarkHighlight({ owned: true, isLive: false }), false, 'off air → no button');
  assert.equal(canMarkHighlight({ owned: false, isLive: true }), false, 'free → no button');
  assert.equal(canMarkHighlight({ owned: false, isLive: false }), false);
});

test('a highlight offset is measured from went_live_at', () => {
  const live = new Date('2026-07-25T10:00:00Z');
  assert.equal(highlightOffsetSeconds(new Date('2026-07-25T10:00:00Z'), live), 0);
  assert.equal(highlightOffsetSeconds(new Date('2026-07-25T10:01:30Z'), live), 90);
  assert.equal(highlightOffsetSeconds('2026-07-25T11:30:15Z', live.toISOString()), 5415);
});

test('an unknown or impossible offset is null, never a fabricated 0:00', () => {
  assert.equal(highlightOffsetSeconds(new Date(), null), null, 'no broadcast start');
  assert.equal(highlightOffsetSeconds(new Date(), undefined), null);
  assert.equal(
    highlightOffsetSeconds(new Date('2026-07-25T09:59:00Z'), new Date('2026-07-25T10:00:00Z')),
    null,
    'a mark before go-live is clock skew, not "the very top of the show"',
  );
  assert.equal(highlightOffsetSeconds('not-a-date', new Date()), null);
});

test('offsets format as chapter marks; a null offset shows an em dash', () => {
  assert.equal(formatHighlightOffset(0), '0:00');
  assert.equal(formatHighlightOffset(9), '0:09');
  assert.equal(formatHighlightOffset(90), '1:30');
  assert.equal(formatHighlightOffset(3600), '1:00:00');
  assert.equal(formatHighlightOffset(5415), '1:30:15');
  assert.equal(formatHighlightOffset(null), '—');
  assert.equal(formatHighlightOffset(-5), '—');
});

/* ── 8 · PLACEMENT MAP ─────────────────────────────────────────────────────── */

test('every corner in both sets resolves to a real placement class', () => {
  const seen = new Set<string>();
  for (const pos of [...MONOGRAM_POSITIONS, ...QR_POSITIONS]) {
    const cls = overlayPositionClass(pos);
    assert.ok(typeof cls === 'string' && cls.length > 0, `${pos} must have a class`);
    seen.add(pos);
  }
  // One map, exhaustively covered — so the controller's placement preview and the
  // capture surface can never disagree about where "top right" is.
  assert.equal(seen.size, 5, 'tr · br · bl · tc · tl');
});

/* ── 9 · SCHEMA DRIFT GUARD ────────────────────────────────────────────────── */
//
// The corner sets exist in TWO places: the TS arrays above and the SQL CHECK
// constraints on live_studio_overlay_settings. If they drift, a host picks a corner
// the UI offers and the write fails with a constraint violation — the kind of bug
// that only shows up on the wedding day. So assert them against the migration.

test('the TS corner sets match the migration CHECK constraints exactly', () => {
  const sql = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations/20271002100000_live_studio_wave2_extras.sql'),
    'utf8',
  );

  const checkFor = (column: string): string[] => {
    const m = new RegExp(`CHECK \\(${column} IN \\(([^)]*)\\)\\)`).exec(sql);
    assert.ok(m, `no CHECK found for ${column}`);
    return m![1]!.split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  };

  assert.deepEqual(
    [...checkFor('monogram_position')].sort(),
    [...MONOGRAM_POSITIONS].sort(),
    'monogram corners drifted between TS and SQL',
  );
  assert.deepEqual(
    [...checkFor('event_qr_position')].sort(),
    [...QR_POSITIONS].sort(),
    'event-QR corners drifted between TS and SQL',
  );
});

test('the migration defaults match the TS defaults (upper-right monogram · owner lock)', () => {
  const sql = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations/20271002100000_live_studio_wave2_extras.sql'),
    'utf8',
  );
  assert.ok(
    sql.includes(`monogram_position    text    NOT NULL DEFAULT '${DEFAULT_MONOGRAM_POSITION}'`),
    'the column default must be the owner-locked upper-right',
  );
  assert.ok(sql.includes(`event_qr_position    text    NOT NULL DEFAULT '${DEFAULT_QR_POSITION}'`));
  // Guest-pick defaults ON (owner: on as soon as multi-cam is unlocked).
  assert.ok(
    /live_studio_guest_pick_enabled boolean NOT NULL DEFAULT true/.test(sql),
    'guest-pick must default ON',
  );
});
