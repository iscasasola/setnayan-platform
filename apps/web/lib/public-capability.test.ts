/**
 * Anonymous capability firewall tests (OPEN-BROWSE PR7 · council §1.2, §6).
 *
 * The capability object is the SINGLE user of PUBLIC_WIDGET_ALLOWLIST; these
 * assert it can never expose a guest-personal type and that it ANDs the
 * open-browse mode/audience reconciliation. The exported allow-list constant's
 * own invariants live in public-widget-allowlist.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { anonymousPublicCapability } from './public-capability';
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import {
  WIDGET_TYPES,
  type InvitationWidgetRow,
  type WidgetType,
} from './invitation-widgets';

const GUEST_PERSONAL: readonly WidgetType[] = [
  'hero',
  'greeting',
  'qr_card',
  'rsvp',
  'event_details',
  'your_photos',
];

function row(type: WidgetType, over: Partial<InvitationWidgetRow> = {}): InvitationWidgetRow {
  return {
    widget_id: `w-${type}`,
    event_id: 'e-1',
    widget_type: type,
    display_order: 0,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

test('capability canRenderType mirrors the allow-list exactly', () => {
  const cap = anonymousPublicCapability();
  for (const t of WIDGET_TYPES) {
    assert.equal(
      cap.canRenderType(t),
      PUBLIC_WIDGET_ALLOWLIST.includes(t),
      `canRenderType(${t})`,
    );
  }
});

test('capability NEVER admits a guest-personal type (RA 10173 firewall)', () => {
  const cap = anonymousPublicCapability();
  for (const t of GUEST_PERSONAL) {
    assert.equal(cap.canRenderType(t), false, `guest-personal ${t} must be firewalled`);
    assert.ok(!cap.allowedWidgetTypes.has(t), `allowedWidgetTypes must not contain ${t}`);
  }
});

test('canRenderWidget ANDs the firewall with mode + audience', () => {
  const cap = anonymousPublicCapability();
  // allow-listed + public + visible → renders.
  assert.equal(cap.canRenderWidget(row('venue_map')), true);
  // allow-listed but guests_only → firewalled for anonymous.
  assert.equal(cap.canRenderWidget(row('venue_map', { audience: 'guests_only' })), false);
  // allow-listed but force-hidden → hidden.
  assert.equal(cap.canRenderWidget(row('venue_map', { mode: 'hidden' })), false);
  // NOT allow-listed (guest-personal) → firewalled even if public + visible.
  assert.equal(cap.canRenderWidget(row('event_details')), false);
});
