import 'server-only';
import { guestSessionVerifyMaterials, resolveGuestSessionSecret } from '@/lib/guest-session';
import type { CaptureLane } from './tiers';
import { ownerTagMatchesWith, ownerTagWith } from './owner-tag-core';

// lib/papic-upload/owner-tag.server.ts — WHO took a queued shot, at WHICH event.
//
// 🚨 Review 2026-10-23, blocker 2: a shot waits on the phone, sometimes for
// hours. Meanwhile the phone's guest pass can change to another event, or a
// shared phone can be signed in as another supplier. Without a binding, the
// queue would record yesterday's shots into whichever event and person the
// phone speaks for NOW.
//
// The page that holds the camera is server-rendered, so it stamps the camera
// with this tag; every queued shot carries it, and every call is checked
// against the tag of the session making it. A mismatch is never recorded and
// never dropped: the shot waits until that camera is open again.
//
// An HMAC — the guest id / supplier id is not readable from it — keyed with the
// guest-session seal (lib/guest-session.ts), so no new secret to configure.

function material(): string | null {
  const r = resolveGuestSessionSecret();
  return r.ok ? r.material : null;
}

export function papicOwnerTag(lane: CaptureLane, ownerId: string, eventId: string): string | null {
  return ownerTagWith(material(), lane, ownerId, eventId);
}

/** See ownerTagMatchesWith (lib/papic-upload/owner-tag-core.ts). */
export function ownerTagMatches(sent: unknown, lane: CaptureLane, ownerId: string, eventId: string): boolean {
  // A shot queued before GUEST_SESSION_SECRET was set carries a tag under the
  // legacy seal; it is still this owner's shot (lib/guest-session.ts).
  const keys = guestSessionVerifyMaterials();
  if (keys.length === 0) return ownerTagMatchesWith(material(), sent, lane, ownerId, eventId);
  return keys.some((k) => ownerTagMatchesWith(k, sent, lane, ownerId, eventId));
}
