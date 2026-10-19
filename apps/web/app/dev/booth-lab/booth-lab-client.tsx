'use client';

/**
 * /dev/booth-lab client — one <BoothTemplate> per catalog category (all 57)
 * on a simple orbitable floor. Uses the REAL renderer + a synthetic Lab3DBooth
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
import { formatCount } from '@/lib/format-number';
import { Figure } from '@/app/_components/plan3d/kit/figure';
import type { FigureSpec } from '@/lib/figure-rig';
import { guestOutfitOf, seatPlanOutfitOf, type GuestOutfitPerson } from '@/lib/guest-outfit';
import type { GuestRole } from '@/lib/guests';

const PALETTE: Lab3DPalette = {
  ambient: '#f2ece1',
  floor: '#d8cfc0',
  table: '#8a7460',
  accent: '#b46a55',
  wall: '#6d675c',
};

const ROOM = { w: 10, d: 10 };

/**
 * 👗 `?people=1` — THE 3D SEAT PLAN'S PEOPLE, DRESSED BY THEIR ROLE'S DRESS CODE (owner 2026-10-20: "the attire depends on
 * the dress code of their role"). Each figure's garment is `seatPlanOutfitOf(guestOutfitOf(…))` — the very call the
 * couple's 3D lab makes per guest (`seating/lab/page.tsx`) — over ONE dress code as the Studio stores it, and every
 * person's stored `guests.attire` set to the OPPOSITE of what their role says, so a figure that wore the stored value
 * would show it. No database, no sign-in.
 */
const LAB_DRESS = {
  groups: { principal_sponsors: { style: 'barong_tagalog' }, vip_family: { style: 'suit' }, bridesmaids: { style: 'long_gown' } },
  roles: { guest: { style: 'suit' } },
  women: { groups: { principal_sponsors: { style: 'filipiniana' }, vip_family: { style: 'long_gown' } }, roles: { guest: { style: 'long_gown' } } },
};
const LAB_PEOPLE: ReadonlyArray<{ word: string; role: GuestRole; person: GuestOutfitPerson; colour: string }> = [
  { word: 'Ninong', role: 'principal_sponsor_ninong', person: { name_prefix: 'Mr.', display_name: null, gender: 'man', attire: 'gown' }, colour: '#f3ead8' },
  { word: 'Ninang', role: 'principal_sponsor_ninang', person: { name_prefix: 'Mrs.', display_name: null, gender: 'woman', attire: 'suit' }, colour: '#b46a55' },
  { word: 'Mother (Atty., Woman)', role: 'groom_parents', person: { name_prefix: 'Atty.', display_name: null, gender: 'woman', attire: 'suit' }, colour: '#7a4e6b' },
  { word: 'Father', role: 'groom_parents', person: { name_prefix: 'Mr.', display_name: null, gender: 'man', attire: 'gown' }, colour: '#3c4a5c' },
  { word: 'Bridesmaid', role: 'bridesmaid', person: { name_prefix: 'Ms.', display_name: null, gender: 'woman', attire: 'suit' }, colour: '#c99aa5' },
  { word: 'Guest (woman)', role: 'guest', person: { name_prefix: 'Ms.', display_name: null, gender: 'woman', attire: 'suit' }, colour: '#6f8f7a' },
  { word: 'Guest (man)', role: 'guest', person: { name_prefix: 'Mr.', display_name: null, gender: 'man', attire: 'gown' }, colour: '#55606e' },
];
function labPeopleSpecs(): Array<{ word: string; spec: FigureSpec; said: string }> {
  return LAB_PEOPLE.map(({ word, role, person, colour }, i) => {
    const seat = seatPlanOutfitOf(guestOutfitOf({ role, dressCodeConfig: LAB_DRESS, palette: {}, person }), role, person);
    const outfit: FigureSpec['outfit'] = seat.said ?? (seat.attire === 'neutral' ? 'neutral' : seat.attire);
    return { word, said: outfit, spec: { id: `lab-person-${i}`, outfit, outfitColor: colour, photoUrl: null, statusColor: '#c9a46a' } };
  });
}

function PeopleLab() {
  const people = useMemo(labPeopleSpecs, []);
  const gap = 1.1;
  const x0 = -((people.length - 1) * gap) / 2;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#efe9dd' }} data-people-lab="">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.7, 6.2], fov: 45 }}>
        <color attach="background" args={['#efe9dd']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 7, 5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[ROOM.w, ROOM.d]} />
          <meshStandardMaterial color={PALETTE.floor} roughness={0.95} />
        </mesh>
        {people.map((p, i) => (
          <group key={p.spec.id} position={[x0 + i * gap, 0, 0]}>
            <Figure spec={p.spec} quality="low" name={p.word} />
          </group>
        ))}
        <OrbitControls target={[0, 0.9, 0]} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <ol style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', fontFamily: 'system-ui, sans-serif', fontSize: 12, listStyle: 'none', margin: 0, padding: 0 }}>
        {people.map((p, i) => (
          <li key={p.spec.id} style={{ padding: '2px 6px', background: '#fffdf7', fontSize: 12 }} data-person-outfit={p.said}>
            {formatCount(i + 1)}. {p.word} · <strong>{p.said}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function BoothLabClient() {
  const [people] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('people') === '1');
  if (people) return <PeopleLab />;
  return <BoothLab />;
}

function BoothLab() {
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
        <button type="button" className="rounded-full" onClick={() => setIndex((index + keys.length - 1) % keys.length)} style={btn}>
          ← Prev
        </button>
        <span className="rounded-full" style={{ ...btn, cursor: 'default' }}>
          {formatCount(index + 1)}/{formatCount(keys.length)} · <strong>{key}</strong> · {template.chassis} · {template.staff.idle}
        </span>
        <button type="button" className="rounded-full" onClick={() => setIndex((index + 1) % keys.length)} style={btn}>
          Next →
        </button>
      </div>
    </div>
  );
}

// Pill shape comes from the `rounded-full` utility on each element — the
// radius-token lint forbids inline borderRadius px literals (house rule).
const btn: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid #c9c0b0',
  background: '#fffdf7',
  fontSize: 13,
  cursor: 'pointer',
};
