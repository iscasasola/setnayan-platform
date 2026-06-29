'use client';

/**
 * Guest Stories — camera-move live preview (Tier 1 / §16.9).
 *
 * The §16.8 Phase-1 preview surface: the deterministic camera-move engine
 * running client-side over a real photo (rigid Ken-Burns move) OR a layered
 * vector scene (to show the Tier-3 depth parallax that sells the "orbit"). No
 * render pipeline, no per-render AI, ₱0 per render. Internal preview — wired
 * into the Stories builder later.
 */

import { useEffect, useRef, useState } from 'react';
import {
  type MoveType,
  cameraAt,
  depthAdjust,
  parallaxStrength,
  beatPunch,
  toSvgTransform,
} from '@/lib/stories-camera-move';

const MOVES: { id: MoveType; label: string }[] = [
  { id: 'push_in', label: 'Push in' },
  { id: 'pan_r', label: 'Pan' },
  { id: 'roll_cw', label: 'Roll' },
  { id: 'orbit_feel', label: 'Orbit feel' },
];

const PHOTOS = [
  '/realstories/maria-juan-tagaytay.jpg',
  '/realstories/maria-juan-g1.jpg',
  '/realstories/maria-juan-v1.jpg',
];

const CX = 180;
const CY = 320;
const PUNCH_AMT = 0.045;

export default function CameraMovePreviewPage() {
  const [move, setMove] = useState<MoveType>('orbit_feel');
  const [amount, setAmount] = useState(0.6);
  const [bpm, setBpm] = useState(120);
  const [parallax, setParallax] = useState(true);
  const [punch, setPunch] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<'scene' | 'photo'>('scene');
  const [photoIdx, setPhotoIdx] = useState(0);

  const layerRefs = useRef<(SVGGElement | null)[]>([]);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const frozen = useRef(0);
  const startRef = useRef<number | null>(null);

  const s = useRef({ move, amount, bpm, parallax, punch, playing, mode });
  s.current = { move, amount, bpm, parallax, punch, playing, mode };

  useEffect(() => {
    let raf = 0;
    const depths = [0.05, 0.45, 0.8, 1.0];
    const smooth = (p: number) => p * p * (3 - 2 * p);
    const tri = (u: number) => (u < 0.5 ? u * 2 : (1 - u) * 2);

    const frame = (now: number) => {
      const st = s.current;
      if (startRef.current === null) startRef.current = now;
      let t = (now - startRef.current) / 1000;
      if (!st.playing) {
        startRef.current = now - frozen.current * 1000;
        t = frozen.current;
      } else {
        frozen.current = t;
      }

      const e = smooth(tri((t % 10) / 10));
      const cam = cameraAt({ type: st.move, amount: st.amount, ease: 'in_out' }, e);
      const pStr = st.mode === 'scene' ? parallaxStrength(st.parallax ? 'strong' : 'none') : 0;
      const punchS = st.punch ? beatPunch(t, st.bpm) : 1;

      if (dotRef.current) {
        const env = (punchS - 1) / PUNCH_AMT;
        dotRef.current.style.opacity = st.punch ? String(0.35 + env * 0.65) : '0.2';
        dotRef.current.style.transform = `scale(${1 + env * 0.6})`;
      }

      if (st.mode === 'scene') {
        depths.forEach((d, i) => {
          const adj = depthAdjust({ ...cam, scale: cam.scale * punchS }, d, pStr);
          layerRefs.current[i]?.setAttribute('transform', toSvgTransform(adj, CX, CY));
        });
      } else if (photoRef.current) {
        photoRef.current.style.transform =
          `translate(${cam.tx / 3.6}%, ${cam.ty / 3.6}%) rotate(${cam.rot}deg) scale(${cam.scale * punchS})`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const resetClock = () => {
    startRef.current = null;
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-xl font-medium text-stone-900">Stories camera move</h1>
      <p className="mb-6 text-sm text-stone-500">
        Tier 1 preview · §16.9 · deterministic, ₱0 per render
      </p>

      <div className="flex flex-wrap items-start gap-6">
        <div className="shrink-0">
          <div className="relative h-[427px] w-[240px] overflow-hidden rounded-2xl border border-black/10 bg-[#efe7da]">
            {mode === 'scene' ? (
              <svg viewBox="0 0 360 640" width="240" height="427" className="absolute inset-0 block">
                <g ref={(el) => { layerRefs.current[0] = el; }}>
                  <rect x="-200" y="-200" width="760" height="1040" fill="#efe7da" />
                  <circle cx="70" cy="90" r="34" fill="#ffffff" opacity="0.45" />
                  <circle cx="150" cy="60" r="20" fill="#f3e6cf" opacity="0.7" />
                  <circle cx="250" cy="80" r="40" fill="#ffffff" opacity="0.4" />
                  <circle cx="300" cy="150" r="22" fill="#f0ddc0" opacity="0.6" />
                  <circle cx="40" cy="190" r="18" fill="#ffffff" opacity="0.5" />
                  <rect x="-200" y="430" width="760" height="420" fill="#ddccb0" />
                </g>
                <g ref={(el) => { layerRefs.current[1] = el; }}>
                  <path d="M70 360 A 120 150 0 0 1 290 360" fill="none" stroke="#9cbf8c" strokeWidth="14" strokeLinecap="round" />
                  <circle cx="92" cy="300" r="13" fill="#e8b6c1" />
                  <circle cx="180" cy="222" r="14" fill="#e8b6c1" />
                  <circle cx="268" cy="300" r="13" fill="#d79aa9" />
                </g>
                <g ref={(el) => { layerRefs.current[2] = el; }}>
                  <ellipse cx="180" cy="470" rx="74" ry="16" fill="#cdbb9c" />
                  <rect x="150" y="372" width="34" height="96" rx="14" fill="#3a3340" />
                  <circle cx="167" cy="360" r="16" fill="#caa98c" />
                  <path d="M188 470 L210 392 Q224 372 238 392 L256 470 Z" fill="#f6efe2" />
                  <circle cx="223" cy="362" r="16" fill="#d8b495" />
                </g>
                <g ref={(el) => { layerRefs.current[3] = el; }}>
                  <circle cx="20" cy="600" r="48" fill="#d79aa9" opacity="0.92" />
                  <circle cx="64" cy="628" r="40" fill="#e8b6c1" opacity="0.92" />
                  <circle cx="344" cy="606" r="50" fill="#d79aa9" opacity="0.92" />
                  <circle cx="300" cy="632" r="38" fill="#e8b6c1" opacity="0.92" />
                </g>
              </svg>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- transform target manipulated by ref; next/image would not forward the DOM node
              <img
                key={PHOTOS[photoIdx]}
                ref={photoRef}
                src={PHOTOS[photoIdx]}
                alt="Sample wedding photo"
                className="absolute inset-0 h-full w-full object-cover will-change-transform"
                style={{ transformOrigin: 'center center' }}
              />
            )}
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
              <span ref={dotRef} className="inline-block h-2 w-2 rounded-full bg-white opacity-30" />
              <span>{MOVES.find((m) => m.id === move)?.label.toLowerCase()}</span>
            </div>
          </div>

          {mode === 'photo' && (
            <button
              onClick={() => setPhotoIdx((i) => (i + 1) % PHOTOS.length)}
              className="mt-2 w-full rounded-md border border-black/15 px-3 py-1.5 text-sm text-stone-700"
            >
              Next photo
            </button>
          )}
        </div>

        <div className="min-w-[280px] flex-1">
          <div className="mb-4 flex flex-wrap gap-2">
            {MOVES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMove(m.id); resetClock(); }}
                className={`rounded-md border px-3 py-1.5 text-sm ${move === m.id ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-black/15 text-stone-700'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <Slider label="Amount" value={amount * 100} suffix="%" min={0} max={100} onChange={(v) => setAmount(v / 100)} />
          <Slider label="Tempo" value={bpm} suffix=" bpm" min={60} max={140} onChange={setBpm} />

          <div className="mb-4 mt-3 flex flex-wrap gap-2">
            <Toggle on={parallax && mode === 'scene'} disabled={mode === 'photo'} onClick={() => setParallax((v) => !v)} label="Depth parallax" />
            <Toggle on={punch} onClick={() => setPunch((v) => !v)} label="On-beat punch" />
            <Toggle on={!playing} onClick={() => { setPlaying((v) => !v); resetClock(); }} label={playing ? 'Pause' : 'Play'} />
            <Toggle on={mode === 'photo'} onClick={() => setMode((m) => (m === 'scene' ? 'photo' : 'scene'))} label={mode === 'scene' ? 'Real photo' : 'Vector scene'} />
          </div>

          <p className="rounded-lg bg-black/5 p-3 text-[13px] leading-relaxed text-stone-600">
            <strong className="font-medium text-stone-900">Tier 1 = free per render.</strong> The move is pure transform math.{' '}
            <strong className="font-medium text-stone-900">Depth parallax</strong> (Tier 3) sells the orbit — it needs a one-time
            depth map per photo at upload, still ₱0 recurring. Parallax separates layers only on the vector scene; over a real
            photo you see the rigid Ken-Burns move.
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider(props: { label: string; value: number; suffix: string; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <label className="min-w-[74px] text-sm text-stone-500">{props.label}</label>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={1}
        value={Math.round(props.value)}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="min-w-[54px] text-right text-sm font-medium text-stone-800">
        {Math.round(props.value)}
        {props.suffix}
      </span>
    </div>
  );
}

function Toggle(props: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 ${props.on ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-black/15 text-stone-700'}`}
    >
      {props.label}
    </button>
  );
}
