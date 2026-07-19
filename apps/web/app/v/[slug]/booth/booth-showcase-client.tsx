'use client';

/**
 * "Walk into my booth" — the public 3D booth showcase for one vendor (3D Booth
 * Ads · Part C, Pro entitlement). A single branded `<BoothMesh>` (the exact
 * production booth — chassis + props + mascot staff + the Pro logo sign) on a
 * small orbitable floor. No seating, no guests. Server picks the booth from the
 * vendor's category + resolves the logo; this client just renders + orbits.
 *
 * Modeled on /dev/booth-lab (the isolated single-booth renderer). The WebGL look
 * is owner-eyeballed — nothing here runs headless.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { BoothMesh } from '@/app/_components/plan3d/venue-objects';
import type { Lab3DBooth, Lab3DPalette } from '@/lib/seating-3d';

const PALETTE: Lab3DPalette = {
  ambient: '#f2ece1',
  floor: '#d8cfc0',
  table: '#8a7460',
  accent: '#b46a55',
  wall: '#6d675c',
};
const ROOM = { w: 8, d: 8 };

export default function BoothShowcaseClient({ booth, vendorName }: { booth: Lab3DBooth; vendorName: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#efe9dd' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2.6, 4.6], fov: 45 }}>
        <color attach="background" args={['#efe9dd']} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[4, 7, 5]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <Environment preset={undefined} resolution={64} frames={1}>
          <mesh scale={40}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color="#f4eee2" side={2} />
          </mesh>
        </Environment>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[ROOM.w, ROOM.d]} />
          <meshStandardMaterial color={PALETTE.floor} roughness={0.95} />
        </mesh>
        {/* quality 'low' bakes the mascot staff — this is a public phone-first page. */}
        <BoothMesh booth={booth} room={ROOM} palette={PALETTE} quality="low" />
        <OrbitControls target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={2.6} maxDistance={9} enablePan={false} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
        <div className="rounded-full border border-black/10 bg-white/85 px-4 py-2 text-center text-sm text-[#1a1a1a] shadow-sm backdrop-blur">
          <strong>{vendorName}</strong> · walk into my booth · drag to look around
        </div>
      </div>
    </div>
  );
}
