'use client';

/**
 * /dev/booth-lab client — one <BoothTemplate> per shipped top-20 category on
 * a simple orbitable floor. Uses the REAL renderer + a synthetic Lab3DBooth
 * per template (vendor.category = the taxonomy leaf, which boothTemplateFor
 * resolves directly), so what renders here is exactly what a placed booth
 * renders in the lab / demo / guest walk.
 */

import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { BoothTemplate } from '@/app/_components/plan3d/kit/booth-template';
import {
  BOOTH_TEMPLATES,
  BOOTH_TEMPLATE_KEYS,
} from '@/app/_components/plan3d/kit/booth-templates';
import type { Lab3DBooth, Lab3DPalette } from '@/lib/seating-3d';

const PALETTE: Lab3DPalette = {
  ambient: '#f2ece1',
  floor: '#d8cfc0',
  table: '#8a7460',
  accent: '#b46a55',
  wall: '#6d675c',
};

const ROOM = { w: 10, d: 10 };

export default function BoothLabClient() {
  const [index, setIndex] = useState(0);
  const keys = BOOTH_TEMPLATE_KEYS;
  const key = keys[index]!;
  const template = BOOTH_TEMPLATES[key]!;
  const booth = useMemo<Lab3DBooth>(
    () => ({
      id: `lab-${key}`,
      kind: 'custom',
      label: '',
      xPct: 50,
      yPct: 50,
      vendor: { name: key, category: key, logoUrl: null },
    }),
    [key],
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#efe9dd' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 2.6, 4.6], fov: 45 }}
        onCreated={({ scene }) => {
          // Dev-page escape hatch: lets a driving session inspect materials.
          (window as unknown as { __boothLabScene?: unknown }).__boothLabScene = scene;
        }}
      >
        <color attach="background" args={['#efe9dd']} />
        <ambientLight intensity={0.55} />
        {/* Bias mirrors SceneLighting's tuned key — an unbiased map acnes the
            riser deck / counter tops (flat receivers that also cast). */}
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
        <BoothTemplate booth={booth} template={template} room={ROOM} palette={PALETTE} />
        <OrbitControls target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 16,
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <button type="button" onClick={() => setIndex((index + keys.length - 1) % keys.length)} style={btn}>
          ← Prev
        </button>
        <span style={{ ...btn, cursor: 'default' }}>
          {index + 1}/{keys.length} · <strong>{key}</strong> · {template.chassis} · {template.staff.idle}
        </span>
        <button type="button" onClick={() => setIndex((index + 1) % keys.length)} style={btn}>
          Next →
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid #c9c0b0',
  background: '#fffdf7',
  fontSize: 13,
  cursor: 'pointer',
};
