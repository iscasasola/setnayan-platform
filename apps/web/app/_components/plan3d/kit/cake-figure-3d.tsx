'use client';

/**
 * 🎂 The cake on a turntable — the 3D view of the SAME CakeFigureSpec the 2D `<CakeFigure>` draws (controller ruling
 * 2026-11-21: "we want to view it in 3d like our seatplan"). Loaded only through `cake-figure-3d-loader.tsx`
 * (`next/dynamic`, ssr off), so three.js never reaches a page that does not open 3D.
 *
 * No downloads: every texture is drawn on a canvas here, the environment is drei Lightformers (no HDRI), and no font is
 * fetched (names and the monogram are shapes — the 2D picture carries the words). A phone gets the phone budget
 * (`usePhoneGpu` → fewer pearls and petals, capped DPR); a lost WebGL context falls back to the 2D picture.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { CakeFigureSpec, CakeFigureTier } from '@/lib/cake-config';
import { canvasDpr } from '@/lib/phone-gpu-budget';
import { ContextLostNotice, usePhoneGpu, useWebglContextLost } from '@/app/_components/plan3d/phone-gpu-budget';

const S = 0.5; // scene metres per cake unit
const IVORY = '#F7F0E4';
const GOLD = '#C9A55C';

let buttercreamNormal: THREE.CanvasTexture | null = null;
/** A soft swirled-buttercream normal map, drawn once on a canvas (no asset). */
function buttercreamMap(): THREE.CanvasTexture | null {
  if (buttercreamNormal || typeof document === 'undefined') return buttercreamNormal;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = 'rgb(128,128,255)';
  g.fillRect(0, 0, 128, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 128; x++) {
      const v = Math.sin((x / 128) * Math.PI * 6 + y) * 30;
      g.fillStyle = `rgb(${128 + v | 0},${128 - v * 0.6 | 0},245)`;
      g.fillRect(x, y + 3 + Math.sin(x / 9) * 2, 1, 3);
    }
  }
  buttercreamNormal = new THREE.CanvasTexture(c);
  buttercreamNormal.wrapS = buttercreamNormal.wrapT = THREE.RepeatWrapping;
  buttercreamNormal.repeat.set(3, 1.5);
  return buttercreamNormal;
}

export default function CakeFigure3D({ spec, onShow2d }: { spec: CakeFigureSpec; onShow2d: () => void }) {
  const phone = usePhoneGpu();
  const { lost, retry, attempt, onCreated } = useWebglContextLost();
  const midY = (spec.height * S) / 2;
  if (lost) return <ContextLostNotice onShow2d={onShow2d} onRetry={retry} />;
  return (
    <Canvas
      key={attempt}
      dpr={canvasDpr(phone, 2)}
      camera={{ position: [0, midY + 0.5, Math.max(2.4, spec.height * S * 2.1)], fov: 35 }}
      onCreated={onCreated}
      gl={{ antialias: !phone, powerPreference: phone ? 'low-power' : 'default' }}
      data-cake-figure-3d={spec.tiers.length}
    >
      <Environment resolution={phone ? 32 : 64}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[6, 3, 1]} color="#fff6ea" />
        <Lightformer form="rect" intensity={0.8} position={[-4, 1, -1]} scale={[3, 4, 1]} color="#aebdd6" />
        <Lightformer form="ring" intensity={1.2} position={[3, 2, 3]} scale={2} color="#fbe9d8" />
      </Environment>
      <directionalLight position={[2, 4, 3]} intensity={0.9} />
      <CakeModel spec={spec} phone={phone} />
      <ContactShadows position={[0, -0.001, 0]} opacity={0.35} scale={4} blur={2.4} far={1.5} frames={1} resolution={phone ? 256 : 512} />
      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.8}
        minDistance={1.2}
        maxDistance={6}
        target={[0, midY, 0]}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}

function CakeModel({ spec, phone }: { spec: CakeFigureSpec; phone: boolean }) {
  const stands = [...new Set(spec.tiers.map((t) => t.stand))];
  const colour = (i: number) => spec.colours[i % spec.colours.length]!;
  return (
    <group>
      {stands.map((s) => {
        const first = spec.tiers.find((t) => t.stand === s)!;
        return (
          <mesh key={s} position={[first.x * S, 0.012, 0]}>
            <cylinderGeometry args={[first.radius * S * 1.18, first.radius * S * 1.18, 0.024, 64]} />
            <meshPhysicalMaterial color="#F2EEE8" roughness={0.35} clearcoat={0.6} />
          </mesh>
        );
      })}
      {spec.tiers.map((t) => (
        <Tier key={t.index} t={t} spec={spec} colour={colour(t.index)} phone={phone} />
      ))}
      {spec.flowing ? <Flowing spec={spec} colour={colour} phone={phone} /> : null}
      {spec.topper ? <Topper spec={spec} colour={colour(0)} /> : null}
      {spec.cupcakes ? <Cupcakes spec={spec} colour={colour(1)} phone={phone} /> : null}
    </group>
  );
}

function Tier({ t, spec, colour, phone }: { t: CakeFigureTier; spec: CakeFigureSpec; colour: string; phone: boolean }) {
  const r = t.radius * S;
  const h = t.height * S;
  const y0 = 0.024 + t.y * S;
  const normalMap = spec.finish === 'buttercream' ? buttercreamMap() : null;
  return (
    <group position={[t.x * S, 0, 0]}>
      {t.gapBelow > 0 ? <Gap t={t} spec={spec} /> : null}
      {spec.finish === 'semi_naked' ? (
        // a layered sponge: sponge bands with cream between, scraped thin
        [0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[0, y0 + (h / 4) * (k + 0.5), 0]}>
            <cylinderGeometry args={[r, r, h / 4, 64]} />
            <meshPhysicalMaterial color={k % 2 === 0 ? t.sponge : IVORY} roughness={0.9} transparent={k % 2 === 1} opacity={0.85} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, y0 + h / 2, 0]}>
          <cylinderGeometry args={[r, r, h, 72, 1]} />
          {spec.finish === 'fondant' ? (
            <meshPhysicalMaterial color={IVORY} roughness={0.42} sheen={0.6} sheenColor="#ffffff" clearcoat={0.25} clearcoatRoughness={0.5} />
          ) : (
            <meshPhysicalMaterial color={IVORY} roughness={0.8} normalMap={normalMap ?? undefined} normalScale={new THREE.Vector2(0.5, 0.5)} sheen={0.3} />
          )}
        </mesh>
      )}
      <TierAccent t={t} r={r} h={h} y0={y0} colour={colour} phone={phone} />
    </group>
  );
}

function Gap({ t, spec }: { t: CakeFigureTier; spec: CakeFigureSpec }) {
  const r = t.radius * S;
  const g = t.gapBelow * S;
  const y0 = 0.024 + (t.y - t.gapBelow) * S;
  if (spec.arrangement === 'pillars') {
    return (
      <group>
        {[0, 1, 2, 3].map((k) => {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh key={k} position={[Math.cos(a) * r * 0.6, y0 + g / 2, Math.sin(a) * r * 0.6]}>
              <cylinderGeometry args={[0.012, 0.012, g, 16]} />
              <meshPhysicalMaterial color="#FFFDF8" roughness={0.3} clearcoat={0.8} />
            </mesh>
          );
        })}
      </group>
    );
  }
  return (
    <mesh position={[0, y0 + g / 2, 0]}>
      <cylinderGeometry args={[r * 0.55, r * 0.55, g, 48]} />
      <meshPhysicalMaterial color="#E6F2F7" roughness={0.05} transparent opacity={0.4} clearcoat={1} />
    </mesh>
  );
}

function TierAccent({ t, r, h, y0, colour, phone }: { t: CakeFigureTier; r: number; h: number; y0: number; colour: string; phone: boolean }) {
  const pearlCount = phone ? 18 : 36;
  const pearls = useMemo(() => {
    if (t.accent !== 'pearls') return null;
    const m = new THREE.Matrix4();
    return Array.from({ length: pearlCount }, (_, i) => {
      const a = (i / pearlCount) * Math.PI * 2;
      return m.clone().setPosition(Math.cos(a) * r * 1.01, y0 + 0.012, Math.sin(a) * r * 1.01);
    });
  }, [t.accent, pearlCount, r, y0]);
  const drip = useMemo(() => {
    if (t.accent !== 'drip') return null;
    const H = h * 0.45;
    const geo = new THREE.CylinderGeometry(r * 1.012, r * 1.012, H, 72, 6, true);
    const p = geo.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const t = (p.getY(i) + H / 2) / H; // 0 = the bottom ring
      const reach = 0.25 + 0.75 * Math.max(0, Math.sin(a * 9) * Math.sin(a * 4 + 1)); // how far this drop runs
      p.setY(i, H / 2 - (1 - t) * reach * H);
    }
    geo.computeVertexNormals();
    return geo;
  }, [t.accent, r, h]);

  switch (t.accent) {
    case 'ribbon':
      return (
        <mesh position={[0, y0 + h * 0.12, 0]}>
          <cylinderGeometry args={[r * 1.008, r * 1.008, h * 0.16, 72, 1, true]} />
          <meshPhysicalMaterial color={colour} roughness={0.45} sheen={1} sheenColor={colour} side={THREE.DoubleSide} />
        </mesh>
      );
    case 'pearls':
      return (
        <instancedMesh args={[undefined, undefined, pearls!.length]} ref={(im) => pearls!.forEach((mx, i) => im?.setMatrixAt(i, mx))}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshPhysicalMaterial color="#FFFDF7" roughness={0.15} clearcoat={1} sheen={0.4} />
        </instancedMesh>
      );
    case 'drip':
      return (
        <mesh geometry={drip!} position={[0, y0 + h - h * 0.225, 0]}>
          <meshPhysicalMaterial color={colour} roughness={0.18} clearcoat={0.9} side={THREE.DoubleSide} />
        </mesh>
      );
    case 'gold_leaf':
      return (
        <group>
          {Array.from({ length: phone ? 6 : 12 }, (_, i) => {
            const a = i * 2.4;
            return (
              <mesh key={i} position={[Math.cos(a) * r * 1.004, y0 + h * (0.25 + ((i * 37) % 50) / 100), Math.sin(a) * r * 1.004]} rotation={[0, -a + Math.PI / 2, i]}>
                <planeGeometry args={[0.03, 0.022]} />
                <meshPhysicalMaterial color={GOLD} metalness={1} roughness={0.25} side={THREE.DoubleSide} />
              </mesh>
            );
          })}
        </group>
      );
    case 'ruffles':
      return (
        <group>
          {[0.3, 0.55, 0.8].map((f) => (
            <mesh key={f} position={[0, y0 + h * f, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r * 1.01, 0.008, 8, 72]} />
              <meshPhysicalMaterial color="#FFFFFF" roughness={0.7} sheen={0.6} />
            </mesh>
          ))}
        </group>
      );
    case 'flowers':
      return <FlowerCluster at={[r * 0.95, y0 + h * 0.55, r * 0.2]} colour={colour} count={phone ? 3 : 5} />;
    default:
      return null;
  }
}

function FlowerCluster({ at, colour, count }: { at: [number, number, number]; colour: string; count: number }) {
  return (
    <group position={at}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.02, Math.sin(a) * 0.02, Math.sin(a * 2) * 0.01]}>
            <sphereGeometry args={[0.022, 12, 10]} />
            <meshPhysicalMaterial color={colour} roughness={0.55} sheen={0.8} sheenColor="#ffffff" />
          </mesh>
        );
      })}
      <mesh>
        <sphereGeometry args={[0.012, 10, 8]} />
        <meshPhysicalMaterial color="#F4E3B5" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Flowing({ spec, colour, phone }: { spec: CakeFigureSpec; colour: (i: number) => string; phone: boolean }) {
  const f = spec.flowing!;
  const run = spec.tiers.filter((t) => t.index >= f.toTier && t.index <= f.fromTier).reverse();
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        run.map((t, i) => {
          const a = 0.3 + i * 0.55; // the cascade spirals gently down the front
          return new THREE.Vector3(t.x * S + Math.sin(a) * t.radius * S * 1.02, 0.024 + (t.y + t.height * 0.6) * S, Math.cos(a) * t.radius * S * 1.02);
        }),
      ),
    [run],
  );
  if (run.length < 2) return <FlowerCluster at={[0, 0.024 + (run[0]?.y ?? 0) * S + 0.05, 0.2]} colour={colour(0)} count={4} />;
  if (f.kind === 'ribbon_cascade') {
    return (
      <mesh>
        <tubeGeometry args={[curve, 64, 0.01, 8, false]} />
        <meshPhysicalMaterial color={colour(0)} roughness={0.4} sheen={1} />
      </mesh>
    );
  }
  const n = f.kind === 'pearl_strand' ? (phone ? 20 : 40) : phone ? 6 : 12;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const p = curve.getPoint(i / (n - 1));
        return f.kind === 'pearl_strand' ? (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.01, 10, 10]} />
            <meshPhysicalMaterial color="#FFFDF7" roughness={0.15} clearcoat={1} />
          </mesh>
        ) : (
          <FlowerCluster key={i} at={[p.x, p.y, p.z]} colour={colour(i)} count={phone ? 3 : 5} />
        );
      })}
    </group>
  );
}

function Topper({ spec, colour }: { spec: CakeFigureSpec; colour: string }) {
  const tp = spec.topper!;
  const t = spec.tiers[tp.onTier]!;
  const y = 0.024 + (t.y + t.height) * S;
  const at: [number, number, number] = [t.x * S, y, 0];
  if (tp.kind === 'flowers') return <FlowerCluster at={[at[0], y + 0.03, 0]} colour={colour} count={6} />;
  if (tp.kind === 'figurine') {
    return (
      <group position={at}>
        {[-0.04, 0.04].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.012, 0.022, 0.1, 16]} />
              <meshPhysicalMaterial color={x < 0 ? '#FFFFFF' : '#2B2B2B'} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.115, 0]}>
              <sphereGeometry args={[0.014, 16, 12]} />
              <meshPhysicalMaterial color="#E8C9A8" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  // names / monogram — an acrylic plaque on two picks (the words are on the 2D picture; no font is fetched)
  return (
    <group position={at}>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.06, 8]} />
          <meshPhysicalMaterial color={GOLD} metalness={1} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.16, 0.05, 0.004]} />
        <meshPhysicalMaterial color={tp.kind === 'monogram' ? GOLD : '#FFFFFF'} metalness={tp.kind === 'monogram' ? 1 : 0} roughness={0.2} clearcoat={1} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Cupcakes({ spec, colour, phone }: { spec: CakeFigureSpec; colour: string; phone: boolean }) {
  const c = spec.cupcakes!;
  const base = spec.tiers[0]!;
  const shown = Math.min(c.count, phone ? 12 : 24);
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    if (c.placement === 'base') {
      const ring = base.radius * S * 1.45;
      for (let i = 0; i < shown; i++) {
        const a = (i / shown) * Math.PI * 2;
        out.push([base.x * S + Math.cos(a) * ring, 0, Math.sin(a) * ring]);
      }
    } else {
      const x0 = (spec.width / 2 - 0.2) * S;
      let left = shown;
      for (let row = 0; left > 0; row++) {
        const n = Math.max(1, Math.min(left, 8 - row * 2));
        const ring = 0.04 * n * 0.5 + 0.02;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          out.push([x0 + Math.cos(a) * ring, row * 0.07, Math.sin(a) * ring]);
        }
        left -= n;
        if (n === 1) break;
      }
    }
    return out;
  }, [c.placement, shown, base.radius, base.x, spec.width]);
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.022, 0.016, 0.04, 16]} />
            <meshPhysicalMaterial color="#E8D8C0" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.048, 0]}>
            <sphereGeometry args={[0.024, 16, 10]} />
            <meshPhysicalMaterial color={colour} roughness={0.7} normalMap={buttercreamMap() ?? undefined} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
