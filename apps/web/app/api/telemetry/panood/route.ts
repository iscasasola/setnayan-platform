/**
 * V2 Phase E · /api/telemetry/panood POST endpoint.
 *
 * Service worker writes a checkpoint signal here. All 7 endpoints are
 * thin shims over `insertTelemetryEvent` (lib/telemetry/insert.ts) — the
 * only per-route difference is the `service_code` enum value. See the
 * helper for body shape, header guard, and error surface.
 *
 * Cross-references: CLAUDE.md third 2026-05-28 row · v2.1 § 5 + § 11 ·
 * telemetry_events table migration 20260704010000.
 */

import type { NextRequest } from 'next/server';

import { insertTelemetryEvent } from '@/lib/telemetry/insert';

export async function POST(req: NextRequest) {
  return insertTelemetryEvent(req, 'panood');
}
