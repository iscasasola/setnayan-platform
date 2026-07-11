/**
 * lib/plan3d-room — PURE logic for the 3D Plan "shared room" (slice 8): the
 * network-agnostic core that turns a stream of peer position broadcasts +
 * presence roster into a renderable set of remote players.
 *
 * Deliberately has NO React and NO Supabase import so it is 100% unit-testable
 * headless (the realtime multiplayer surface itself can't be verified in CI).
 * `use-plan3d-room.ts` wraps this in a channel; `plan3d-remote-players.tsx`
 * renders it. Every function takes `nowMs` as a parameter (never reads the
 * clock) so tests are deterministic and resume-safe.
 *
 * DESIGN (owner-locked 2026-07-08/09, see the spec dossier):
 *  · client-authoritative — each client owns its OWN character; peers trust the
 *    broadcast. A social toy, not a competitive game, so no server authority.
 *  · broadcast the LOCAL character's {pos, vel, heading, moving} at ~8 Hz, and
 *    ONLY while moving (+ one settle frame on stop). Idle players send nothing.
 *  · dead-reckon between packets: extrapolate pos += vel·dt (capped) so a
 *    dropped frame doesn't stutter, and a stale peer coasts to a stop rather
 *    than freezing mid-stride.
 *  · presence is the source of "who is a live person": a character is only
 *    greetable / kept-walking while its owner is in the presence roster. On
 *    presence drop the character returns to its seat (handled by the renderer)
 *    then despawns into the seated crowd.
 */

export type Vec2 = { x: number; z: number };

/** Distinct floor-ring colours so online people are tell-apart-able (the locked
 *  look is matte-white bodies + a presence-colour ring). A small fixed palette,
 *  indexed by a stable hash of the player id — deterministic, no per-session RNG. */
export const ROOM_PLAYER_COLORS = [
  '#e0a63c',
  '#4f9d8f',
  '#c56a86',
  '#5b7fb4',
  '#c98b4b',
  '#7d6bb0',
  '#4aa06a',
  '#c05b52',
] as const;

export function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ROOM_PLAYER_COLORS[h % ROOM_PLAYER_COLORS.length]!;
}

// ── Tunables ────────────────────────────────────────────────────────────────

/** Broadcast cadence ceiling — ~8 Hz (locked). One message per 120 ms while
 *  moving; the ms-gate is the house throttle idiom (use-seating-presence). */
export const BROADCAST_INTERVAL_MS = 120;
/** At/above this speed the figure runs, not walks (matches plan3d-scene
 *  RUN_AT_MPS so a remote animates exactly like the local walker). */
export const RUN_AT_MPS = 1.6;
/** Below this the figure stands (m/s). */
export const STAND_BELOW_MPS = 0.06;
/** Cap on how far ahead we dead-reckon from the last packet's velocity (s).
 *  A lost packet coasts at most this long before the peer holds position —
 *  keeps a dropped "I stopped" frame from flinging the character across the
 *  room. */
export const DEADRECKON_CAP_S = 0.35;
/** A moving peer that hasn't sent for this long is treated as stopped (its
 *  final settle frame was probably dropped) — the renderer stands it. */
export const MOVE_STALE_MS = 700;
/** How long a "say hi" wave plays on the figure (ms). */
export const GREET_WAVE_MS = 2600;
/** Hard cap on concurrently-rendered remotes (phones; mirrors MAX_ROOM_MOVERS
 *  in plan3d-scene). Extra presence is rostered but not drawn/avoided. */
export const MAX_REMOTES = 8;

// ── Wire messages (full snapshots — the repo never delta-encodes broadcast) ──

/** One movement frame a client broadcasts about ITSELF. Short keys keep the
 *  socket payload small at 8 Hz. No PII beyond a display name (carried in
 *  presence, not here). */
export type MoveMsg = {
  id: string; // sender's presence key
  x: number;
  z: number; // world-metre floor position
  vx: number;
  vz: number; // realised velocity (m/s)
  h: number; // heading (radians, atan2(vx,vz) convention)
  m: boolean; // moving?
  t: number; // sender wall-clock ms (freshness / ordering)
};

/** A "say hi" greeting. `to === null` = a wave to the whole room; otherwise the
 *  greeted peer's id. Carries `from` so the wave plays on the SENDER's figure. */
export type GreetMsg = { from: string; to: string | null; t: number };

/** One entry in the presence roster (who is online in this room). */
export type RoomPeer = { id: string; name: string; color: string };

// ── Local per-remote state ───────────────────────────────────────────────────

export type RemotePlayer = {
  id: string;
  name: string;
  color: string; // status-ring colour so online people are tell-apart-able
  /** Last received snapshot. */
  x: number;
  z: number;
  vx: number;
  vz: number;
  h: number;
  moving: boolean;
  /** Local clock (ms) when the last MOVE was received — drives dead-reckoning
   *  + staleness. Seeded to presence-join time so a never-moved peer is fresh. */
  recvAt: number;
  /** In the presence roster right now. false = owner left → return to seat. */
  present: boolean;
  /** Wave plays until this local-clock ms (0 = not waving). */
  greetUntil: number;
};

export type RemoteMap = ReadonlyMap<string, RemotePlayer>;

// ── Broadcast decision (throttle + only-while-moving) ────────────────────────

/**
 * Should the LOCAL client broadcast a movement frame now? While moving, at most
 * one per `intervalMs`. When motion STOPS (moving false, wasMoving true) send
 * exactly one settle frame so peers land the final resting pos/heading. Idle
 * (not moving, wasn't moving) → silent. Pure of the clock: caller passes now +
 * the last-sent stamp.
 */
export function shouldBroadcastMove(
  nowMs: number,
  lastSentMs: number,
  moving: boolean,
  wasMoving: boolean,
  intervalMs: number = BROADCAST_INTERVAL_MS,
): boolean {
  if (moving) return nowMs - lastSentMs >= intervalMs;
  return wasMoving; // the one settle frame on stop
}

// ── Motion → pose/heading (so a remote animates from {pos,vel} alone) ─────────

export function speedOf(vx: number, vz: number): number {
  return Math.hypot(vx, vz);
}

export type RemotePose = 'stand' | 'walk' | 'run';

export function poseFromSpeed(speed: number): RemotePose {
  if (speed < STAND_BELOW_MPS) return 'stand';
  if (speed >= RUN_AT_MPS) return 'run';
  return 'walk';
}

/** Facing from velocity (the movement tangent), atan2(x,z) convention — matches
 *  every mover in the scene. Below the stand threshold keep the last heading so
 *  a stopped figure doesn't spin to face 0. */
export function headingFromVel(vx: number, vz: number, fallback: number): number {
  return speedOf(vx, vz) < STAND_BELOW_MPS ? fallback : Math.atan2(vx, vz);
}

/**
 * Dead-reckoned render position: extrapolate the last snapshot forward by the
 * elapsed time, capped at DEADRECKON_CAP_S, and only while the snapshot was a
 * MOVING one (a standing snapshot holds its position — no drift). This is what
 * the renderer calls each frame with (now - recvAt).
 */
export function deadReckon(p: Pick<RemotePlayer, 'x' | 'z' | 'vx' | 'vz' | 'moving' | 'recvAt'>, nowMs: number): Vec2 {
  if (!p.moving) return { x: p.x, z: p.z };
  const dt = Math.min(Math.max((nowMs - p.recvAt) / 1000, 0), DEADRECKON_CAP_S);
  return { x: p.x + p.vx * dt, z: p.z + p.vz * dt };
}

/** A moving peer that has gone silent past MOVE_STALE_MS is coasting on a
 *  dropped stop-frame → render it standing at its dead-reckoned spot. */
export function isMoveStale(p: Pick<RemotePlayer, 'moving' | 'recvAt'>, nowMs: number): boolean {
  return p.moving && nowMs - p.recvAt > MOVE_STALE_MS;
}

/** Effective render state for one remote this frame: position (dead-reckoned,
 *  frozen when stale), pose + heading. Pure — the renderer turns this into a
 *  group transform + Figure props. */
export function renderRemote(
  p: RemotePlayer,
  nowMs: number,
): { pos: Vec2; pose: RemotePose; heading: number; waving: boolean } {
  const stale = isMoveStale(p, nowMs);
  const pos = deadReckon(p, nowMs);
  const speed = stale ? 0 : speedOf(p.vx, p.vz);
  return {
    pos,
    pose: poseFromSpeed(speed),
    heading: p.h,
    waving: p.greetUntil > nowMs,
  };
}

// ── Reducers over the remote map (the hook keeps ONE map in state) ───────────

function clone(m: RemoteMap): Map<string, RemotePlayer> {
  return new Map(m);
}

/**
 * Reconcile the map against a fresh presence roster. New peers spawn (seeded at
 * their presence position — origin until their first MOVE); peers still present
 * keep their live state but refresh name/colour; peers no longer in the roster
 * are marked `present=false` (kept so the renderer can walk them home before
 * pruneRemotes drops them). `selfId` is never added.
 */
export function reconcilePresence(prev: RemoteMap, roster: readonly RoomPeer[], selfId: string, nowMs: number): RemoteMap {
  const next = clone(prev);
  const live = new Set<string>();
  for (const peer of roster) {
    if (peer.id === selfId) continue;
    live.add(peer.id);
    const existing = next.get(peer.id);
    if (existing) {
      next.set(peer.id, { ...existing, present: true, name: peer.name, color: peer.color });
    } else {
      next.set(peer.id, {
        id: peer.id,
        name: peer.name,
        color: peer.color,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        h: 0,
        moving: false,
        recvAt: nowMs,
        present: true,
        greetUntil: 0,
      });
    }
  }
  for (const [id, p] of next) {
    if (!live.has(id) && p.present) next.set(id, { ...p, present: false, moving: false });
  }
  return next;
}

/** Apply an incoming movement snapshot. Ignores our own echo and any peer not
 *  in the roster (a move can race ahead of presence sync — we drop it rather
 *  than spawn a rosterless ghost). Stale/out-of-order frames (older `t`) are
 *  ignored. */
export function applyMove(prev: RemoteMap, msg: MoveMsg, selfId: string, nowMs: number): RemoteMap {
  if (msg.id === selfId) return prev;
  const existing = prev.get(msg.id);
  if (!existing) return prev; // presence-gated: no ghost without a roster entry
  const next = clone(prev);
  next.set(msg.id, {
    ...existing,
    x: msg.x,
    z: msg.z,
    vx: msg.vx,
    vz: msg.vz,
    h: msg.h,
    moving: msg.m,
    recvAt: nowMs,
  });
  return next;
}

/** Apply an incoming greeting — the wave plays on the SENDER's figure (`from`),
 *  visible to everyone. A greet to a peer we don't have is a no-op. Greeting an
 *  offline/absent character never happens (the sender's UI gates on presence),
 *  but we still no-op if `from` isn't present. */
export function applyGreet(prev: RemoteMap, msg: GreetMsg, selfId: string, nowMs: number, waveMs: number = GREET_WAVE_MS): RemoteMap {
  if (msg.from === selfId) return prev; // our own wave is played optimistically, not echoed
  const existing = prev.get(msg.from);
  if (!existing || !existing.present) return prev;
  const next = clone(prev);
  next.set(msg.from, { ...existing, greetUntil: nowMs + waveMs });
  return next;
}

/** Drop peers that left presence a while ago (owner gone + character has had
 *  time to walk home). `present` peers are always kept. */
export function pruneRemotes(prev: RemoteMap, nowMs: number, goneAfterMs: number): RemoteMap {
  let changed = false;
  const next = clone(prev);
  for (const [id, p] of next) {
    if (!p.present && nowMs - p.recvAt > goneAfterMs) {
      next.delete(id);
      changed = true;
    }
  }
  return changed ? next : prev;
}

/** The greet target/affordance is gated on ACTIVE presence — you can only wave
 *  at a character backed by a live online person (locked rule: "no greeting
 *  ghosts"). Convenience predicate for the renderer/UI. */
export function isGreetable(p: RemotePlayer | undefined): boolean {
  return !!p && p.present;
}

/** The avoidance-field entries the LOCAL walker weaves around: a dead-reckoned
 *  position (+ velocity for a live mover) per PRESENT remote, capped at
 *  MAX_REMOTES nearest. Feeds plan3d-scene's REMOTE_MOVERS / separateAgents. A
 *  stopped/stale peer contributes position-only (reactive avoidance, no
 *  predictive projection). Empty → the local walker skips the separation pass. */
export function remoteMovers(map: RemoteMap, self: Vec2, nowMs: number, cap: number = MAX_REMOTES): (Vec2 & { vel?: Vec2 })[] {
  const out: (Vec2 & { vel?: Vec2 })[] = [];
  for (const p of activeRemotes(map, self, nowMs, cap)) {
    if (!p.present) continue;
    const pos = deadReckon(p, nowMs);
    if (p.moving && !isMoveStale(p, nowMs)) out.push({ x: pos.x, z: pos.z, vel: { x: p.vx, z: p.vz } });
    else out.push({ x: pos.x, z: pos.z });
  }
  return out;
}

/** The rendered/avoided subset: present peers, nearest-first to the local
 *  player, capped at MAX_REMOTES (phones). Absent peers still render while they
 *  walk home but never crowd out a live peer from the cap. */
export function activeRemotes(map: RemoteMap, self: Vec2, nowMs: number, cap: number = MAX_REMOTES): RemotePlayer[] {
  const all = Array.from(map.values());
  all.sort((a, b) => {
    // present-first, then nearest to self (dead-reckoned)
    if (a.present !== b.present) return a.present ? -1 : 1;
    const pa = deadReckon(a, nowMs);
    const pb = deadReckon(b, nowMs);
    return (pa.x - self.x) ** 2 + (pa.z - self.z) ** 2 - ((pb.x - self.x) ** 2 + (pb.z - self.z) ** 2);
  });
  return all.slice(0, cap);
}
