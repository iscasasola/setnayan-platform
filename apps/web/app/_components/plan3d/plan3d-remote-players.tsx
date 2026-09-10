'use client';

/**
 * plan3d-remote-players — renders the OTHER online people's characters in the
 * shared room (slice 8). One walking `<Figure>` per remote, driven purely by the
 * `{pos,vel,heading}` frames the `use-plan3d-room` hook receives: dead-reckoned
 * between packets, pose (stand/walk/run) + facing derived from velocity, a "say
 * hi" wave overlaid when greeted. A matte-white mannequin like everyone else —
 * told apart only by its presence-colour status ring (the locked look).
 *
 * This is an ADDITIVE overlay on top of the seated crowd: it draws nobody when
 * `remotes` is empty (single-player / flag off / offline), so the resting
 * "everyone seated" room is unchanged. A peer that leaves presence is dead-
 * reckoned to a stop and then pruned by the hook (prompt despawn — never left
 * abandoned mid-floor; the seated crowd underneath is the resting state).
 *
 * Verification note: the multiplayer render can't run headless — the motion→
 * pose/heading/dead-reckon MATH is unit-tested in lib/plan3d-room.test.ts; the
 * visual is owner-eyeballed in a 2-device test before the flag is flipped.
 */

import { memo, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Figure } from './kit';
import {
  WALK_CLOCK_RAD_S,
  RUN_CLOCK_RAD_S,
  damp,
  lerpAngle,
  type FigureSpec,
} from '@/lib/figure-rig';
import { renderRemote, activeRemotes, type RemoteMap, type RemotePlayer, type Vec2 } from '@/lib/plan3d-room';
import { guestAvatarsEnabled } from '@/lib/venue-avatars';
import { resolveGuestAvatar } from '@/lib/guest-avatar';
import { heritageFigureSpec } from '@/lib/heritage-config';
import { chibiHop } from '@/lib/figure-rig';
import { ChibiFigure } from './kit/chibi-figure';

/*
 * A remote's heading eased toward the network target instead of snapping on
 * jitter — now through the SHARED `lerpAngle` (lib/figure-rig) rather than a
 * private modulo copy.
 *
 * ⚠ THE TWO WERE NOT IDENTICAL, AND THE DIFFERENCE IS RECORDED RATHER THAN
 * ASSUMED AWAY. Compared over 396,344 (a, b, k) triples: 396,112 agree, and
 * the 232 that do not are all the EXACT half-turn (b − a = π), where the
 * shortest arc is genuinely ambiguous. The old local copy spun one way through
 * that tie and the shared one spins the other; both land on the same heading
 * at k = 1, and they differ only mid-interpolation.
 *
 * That is a tie-break, not a correctness property, and there is no reason a
 * remote player should turn the opposite way from every other figure in the
 * room — which is the whole point of there being one of these.
 */

const ORIGIN: Vec2 = { x: 0, z: 0 };

function RemotePlayerFigure({ player, quality }: { player: RemotePlayer; quality: 'high' | 'low' }) {
  const groupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);
  // C6b — this peer's OWN chibi, if they made one and the flag is on. The same
  // ONE fallback rule the viewer's own figure uses: junk declines to the
  // mannequin, never to a hash-rolled default. Resolved once per (id, config).
  const avatar = useMemo(
    () => resolveGuestAvatar(player.avatar, player.id, guestAvatarsEnabled()),
    [player.id, player.avatar],
  );
  // The chibi hop — the SAME pure clip the viewer's own <ChibiBounce> drives
  // (lib/figure-rig chibiHop), applied here to a child group so the walk file
  // keeps its one-and-only <ChibiBounce> mount. Amplitude eases in/out on
  // start/stop so a chibi never snaps mid-hop.
  const hopRef = useRef<THREE.Group>(null);
  const hopAmp = useRef(0);
  const headingRef = useRef(player.h);
  // Pose + wave are React props on <Figure>; they change on start/stop/greet
  // (occasional), NOT per frame — so we setState only on transition.
  const [pose, setPose] = useState<'stand' | 'walk' | 'run'>('stand');
  const [waving, setWaving] = useState(false);
  const poseRef = useRef(pose);
  const wavingRef = useRef(waving);

  // Deterministic matte-white mannequin; the presence colour rings the floor so
  // online people are tell-apart-able. No photo, no PII beyond the ring + name.
  // Heritage rides the SAME mannequin path with its look on the spec; the
  // neutral spec is what every guest without an avatar has always had.
  const spec = useMemo<FigureSpec>(
    () =>
      avatar && avatar.style !== 'chibi'
        ? heritageFigureSpec(player.id, avatar.config, player.color)
        : { id: player.id, outfit: 'neutral', outfitColor: null, statusColor: player.color },
    [player.id, player.color, avatar],
  );

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const now = Date.now();
    const r = renderRemote(player, now);

    g.position.set(r.pos.x, 0, r.pos.z);
    headingRef.current = lerpAngle(headingRef.current, r.heading, damp(0.02, delta));
    g.rotation.y = headingRef.current;

    // Advance the gait clock while walking/running; hold it while standing.
    if (r.pose === 'walk') phaseRef.current += WALK_CLOCK_RAD_S * delta;
    else if (r.pose === 'run') phaseRef.current += RUN_CLOCK_RAD_S * delta;
    const hop = hopRef.current;
    if (hop) {
      const target = r.pose === 'stand' || r.waving ? 0 : 1;
      hopAmp.current += (target - hopAmp.current) * damp(0.06, delta);
      const { lift, scaleY, scaleXZ } = chibiHop(phaseRef.current, hopAmp.current);
      hop.position.y = lift;
      hop.scale.set(scaleXZ, scaleY, scaleXZ);
    }

    // Greeting pauses the figure to wave (idleClip only overlays a stand pose).
    const effPose = r.waving ? 'stand' : r.pose;
    if (effPose !== poseRef.current) {
      poseRef.current = effPose;
      setPose(effPose);
    }
    if (r.waving !== wavingRef.current) {
      wavingRef.current = r.waving;
      setWaving(r.waving);
    }
  });

  if (avatar?.style === 'chibi') {
    return (
      <group ref={groupRef}>
        <group ref={hopRef}>
          <ChibiFigure id={player.id} config={avatar.config} castShadow={false} />
        </group>
        {/* The presence colour still rings the floor — the mannequin carried
            it as a status ring; the chibi has none, and "tell-apart-able" is
            the whole reason the colour exists. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.24, 0.3, 24]} />
          <meshBasicMaterial color={player.color} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      </group>
    );
  }
  return (
    <group ref={groupRef}>
      <Figure
        spec={spec}
        name={player.name}
        pose={pose}
        phase={phaseRef}
        idleClip={waving ? 'wave' : undefined}
        quality={quality}
        castShadow={false}
      />
    </group>
  );
}

/**
 * Broadcasts the LOCAL player's motion from a shared position ref — WITHOUT
 * touching the host surface's walker loop. Every surface already writes its
 * walker's live floor position to a ref (`walkerPosRef` / the self-avatar group);
 * this reads it each frame, derives velocity + heading + moving from the frame-
 * to-frame delta (the same realised-motion the walker itself predicts from), and
 * calls the hook's throttled `sendMove`. A no-op `sendMove` (flag off / offline)
 * makes this render-invisible and side-effect-free. Mount ONLY when the room is
 * enabled so the single-player path is byte-identical.
 */
export function LocalMoveBroadcaster({
  posRef,
  sendMove,
}: {
  posRef: React.MutableRefObject<Vec2 | null>;
  sendMove: (x: number, z: number, vx: number, vz: number, heading: number, moving: boolean) => void;
}) {
  const prev = useRef<Vec2 | null>(null);
  const headingRef = useRef(0);
  useFrame((_, delta) => {
    const p = posRef.current;
    if (!p) return;
    const dt = Math.max(delta, 1e-4);
    let vx = 0;
    let vz = 0;
    let moving = false;
    if (prev.current) {
      const dx = p.x - prev.current.x;
      const dz = p.z - prev.current.z;
      vx = dx / dt;
      vz = dz / dt;
      moving = Math.hypot(dx, dz) > 1e-4;
    }
    prev.current = { x: p.x, z: p.z };
    if (moving) headingRef.current = Math.atan2(vx, vz);
    sendMove(p.x, p.z, vx, vz, headingRef.current, moving);
  });
  return null;
}

const CAM_FWD = new THREE.Vector3();

/**
 * FIRST-PERSON variant of the broadcaster (the couple lab "Play" walk): the
 * local player IS the camera, so broadcast the camera's floor position, and take
 * heading from where the camera LOOKS (its floor-projected forward) rather than
 * the movement vector — so a peer's figure faces the way that player is looking,
 * even while strafing or turning in place. Mount ONLY while first-person-walking.
 */
export function CameraMoveBroadcaster({
  sendMove,
}: {
  sendMove: (x: number, z: number, vx: number, vz: number, heading: number, moving: boolean) => void;
}) {
  const prev = useRef<Vec2 | null>(null);
  useFrame(({ camera }, delta) => {
    const x = camera.position.x;
    const z = camera.position.z;
    const dt = Math.max(delta, 1e-4);
    let vx = 0;
    let vz = 0;
    let moving = false;
    if (prev.current) {
      const dx = x - prev.current.x;
      const dz = z - prev.current.z;
      vx = dx / dt;
      vz = dz / dt;
      moving = Math.hypot(dx, dz) > 1e-4;
    }
    prev.current = { x, z };
    camera.getWorldDirection(CAM_FWD);
    const heading = Math.atan2(CAM_FWD.x, CAM_FWD.z);
    sendMove(x, z, vx, vz, heading, moving);
  });
  return null;
}

/**
 * Renders every active remote (present-first, nearest-first, capped at
 * MAX_REMOTES for phones). Keyed by peer id so a figure keeps its phase/heading
 * refs across map updates. Draws nothing when `remotes` is empty.
 */
export const RemotePlayers = memo(function RemotePlayers({
  remotes,
  selfPos = ORIGIN,
  quality = 'high',
}: {
  remotes: RemoteMap;
  /** Local player floor position, for the nearest-first cull when > cap online. */
  selfPos?: Vec2;
  quality?: 'high' | 'low';
}) {
  // The RENDERED set changes only when the roster/positions change (a React
  // re-render from the hook's setRemotes), not per frame — cull on render.
  const list = useMemo(() => activeRemotes(remotes, selfPos, Date.now()), [remotes, selfPos]);
  if (list.length === 0) return null;
  return (
    <>
      {list.map((p) => (
        <RemotePlayerFigure key={p.id} player={p} quality={quality} />
      ))}
    </>
  );
});
