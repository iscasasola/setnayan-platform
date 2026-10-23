import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CaptureLane } from './tiers';

// lib/papic-upload/owner-tag-core.ts — the pure half of the owner tag
// (lib/papic-upload/owner-tag.server.ts holds the key). Split out so the rule is
// RUN by a unit test (a-queued-shot-records-only-where-it-was-taken.test.ts):
// `server-only` does not resolve under the unit runner. Node-only (node:crypto)
// — never imported by a client component.

export function ownerTagWith(key: string | null, lane: CaptureLane, ownerId: string, eventId: string): string | null {
  if (!key || !ownerId || !eventId) return null;
  return createHmac('sha256', key).update(`papic-owner:${lane}:${ownerId}:${eventId}`).digest('hex').slice(0, 32);
}

/**
 * Does the tag a shot carries belong to this session? A shot with NO tag (adopted
 * from the old queue) is accepted — it was always sent as whoever was signed in.
 */
export function ownerTagMatchesWith(
  key: string | null,
  sent: unknown,
  lane: CaptureLane,
  ownerId: string,
  eventId: string,
): boolean {
  if (sent === undefined || sent === null || sent === '') return true;
  if (typeof sent !== 'string') return false;
  const want = ownerTagWith(key, lane, ownerId, eventId);
  if (!want) return true; // no seal: the route's own session checks still bind it
  const a = Buffer.from(sent);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
