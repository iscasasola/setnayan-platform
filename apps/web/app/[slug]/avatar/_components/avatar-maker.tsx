'use client';

/**
 * THE MAKER — the client the whole chibi foundation was built for.
 *
 * `lib/chibi-config.ts`'s header names three consumers: "the future Me-tab /
 * venue-sheet maker client (writes a config)", the server sanitizer, and the
 * renderers. This is the first of those. It invents NO vocabulary: every
 * control below is driven straight off an exported catalog, so a value that is
 * not in `chibi-config` cannot be offered here, and adding a catalog entry
 * later surfaces a new swatch with no change to this file.
 *
 * The preview is the SHIPPED `<ChibiFigure>` (kit/chibi-figure.tsx) — the same
 * component the room renders — so what a guest builds here is what they get at
 * their seat. It is deliberately not a second, prettier drawing of a chibi.
 *
 * ⚠ NOTHING IS SAVED UNTIL "Save". The live preview is local state; the guest
 * can turn every dial and walk away without writing a row. That is the "never
 * required" half of the consent posture made physical.
 */

import { useMemo, useState, useTransition } from 'react';
import { Figure } from '@/app/_components/plan3d/kit/figure';
import { resolveGuestAvatar } from '@/lib/guest-avatar';
import {
  HERITAGE_SKIN_TONES,
  HERITAGE_HAIR_STYLES,
  HERITAGE_HAIR_COLORS,
  HERITAGE_OUTFITS,
  HERITAGE_OUTFIT_COLORS,
  resolveHeritageConfig,
  heritageFigureSpec,
  type HeritageAvatarConfig,
} from '@/lib/heritage-config';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ChibiFigure } from '@/app/_components/plan3d/kit/chibi-figure';
import {
  CHIBI_BODY_TYPES,
  CHIBI_SKIN_TONES,
  CHIBI_HAIR_STYLES,
  CHIBI_HAIR_COLORS,
  CHIBI_EYES,
  CHIBI_MOUTHS,
  CHIBI_MARKS,
  CHIBI_OUTFITS,
  CHIBI_OUTFIT_COLORS,
  CHIBI_ACCESSORIES,
  resolveChibiConfig,
  type ChibiAvatarConfig,
} from '@/lib/chibi-config';
import { saveMyAvatarAction, resetMyAvatarAction } from '../../avatar-actions';

/** Sentence-case a catalog id for a button label ('tee_skirt' → 'Tee skirt').
 *  The catalogs are ids, not copy — this is the one place they become words. */
function label(id: string): string {
  const s = id.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="border-t border-white/10 px-3 py-3 first:border-t-0">
      <p className="mb-2 text-xs uppercase tracking-wide text-white/55">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
  ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={ariaLabel}
      className={
        'rounded-lg px-2.5 py-1.5 text-xs transition ' +
        (on ? 'bg-white text-[#0b0d12]' : 'bg-white/10 text-white/75 hover:bg-white/20')
      }
    >
      {children}
    </button>
  );
}

function Swatch({ hex, on, onClick, name }: { hex: string; on: boolean; onClick: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={name}
      title={name}
      style={{ backgroundColor: hex }}
      className={
        'h-7 w-7 rounded-full border transition ' +
        (on ? 'border-white ring-2 ring-white/70' : 'border-white/25 hover:border-white/60')
      }
    />
  );
}

export function AvatarMaker({
  eventId,
  slug,
  figureId,
  initialConfig,
  hasSaved,
}: {
  eventId: string;
  slug: string;
  /** The guest's own id — the stable hash seed, so an untouched maker already
   *  shows the exact figure the room would draw for them. */
  figureId: string;
  initialConfig: unknown;
  hasSaved: boolean;
}) {
  // resolveChibiConfig NEVER throws: a stored value from an older `v`, or junk,
  // repairs field-by-field to this guest's hash defaults rather than opening a
  // broken maker.
  // TWO STYLES (owner 2026-09-06: "just so there are now options"). The stored
  // row is one or the other; the maker keeps a draft of BOTH so switching the
  // style never throws away what the guest dressed on the other one.
  const initial = useMemo(() => resolveGuestAvatar(initialConfig, figureId, true), [figureId, initialConfig]);
  const [style, setStyle] = useState<'chibi' | 'heritage'>(initial?.style ?? 'chibi');
  const [cfg, setCfg] = useState<ChibiAvatarConfig>(() =>
    initial?.style === 'chibi' ? initial.config : resolveChibiConfig(figureId, null),
  );
  const [hcfg, setHcfg] = useState<HeritageAvatarConfig>(() =>
    initial?.style === 'heritage' ? initial.config : resolveHeritageConfig(figureId, null),
  );
  const [saved, setSaved] = useState(hasSaved);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ChibiAvatarConfig>(key: K, value: ChibiAvatarConfig[K]) => {
    setCfg((c) => ({ ...c, [key]: value }));
    setDirty(true);
    setNote(null);
  };
  const setH = <K extends keyof HeritageAvatarConfig>(key: K, value: HeritageAvatarConfig[K]) => {
    setHcfg((c) => ({ ...c, [key]: value }));
    setDirty(true);
    setNote(null);
  };
  const pickStyle = (next: 'chibi' | 'heritage') => {
    if (next === style) return;
    setStyle(next);
    setDirty(true);
    setNote(null);
  };

  // The preview remounts only when the config actually changes.
  const preview = useMemo(() => cfg, [cfg]);
  const heritagePreview = useMemo(() => heritageFigureSpec(figureId, hcfg, ''), [figureId, hcfg]);
  const activeConfig = style === 'chibi' ? cfg : hcfg;

  const onSave = () =>
    startTransition(async () => {
      const res = await saveMyAvatarAction(eventId, slug, activeConfig);
      if (res.ok) {
        setSaved(true);
        setDirty(false);
        setNote('Saved — this is you in the room now.');
        return;
      }
      // A failed write must never read as a save. The guest's edits stay on
      // screen and the message says what happened.
      setNote(
        res.reason === 'signed_out'
          ? 'Your invite link signed out. Open your invitation again and retry.'
          : `Not saved: ${res.problems?.[0] ?? 'please try again'}`,
      );
    });

  const onReset = () =>
    startTransition(async () => {
      const res = await resetMyAvatarAction(eventId, slug);
      if (res.ok) {
        setCfg(resolveChibiConfig(figureId, null));
        setHcfg(resolveHeritageConfig(figureId, null));
        setStyle('chibi');
        setSaved(false);
        setDirty(false);
        setNote('Removed — you look like everyone else again.');
        return;
      }
      setNote(`Not removed: ${res.problems?.[0] ?? 'please try again'}`);
    });

  return (
    <div className="space-y-3">
      <div className="h-[46vh] min-h-[280px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]">
        <Canvas camera={{ position: [0, 1.35, 2.6], fov: 40 }} shadows={false}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[2.5, 4, 3]} intensity={1.15} />
          <directionalLight position={[-3, 2, -2]} intensity={0.35} />
          {style === 'chibi' ? (
            <ChibiFigure id={figureId} config={preview} castShadow={false} />
          ) : (
            <Figure spec={heritagePreview} pose="stand" castShadow={false} />
          )}
          <OrbitControls
            enablePan={false}
            minDistance={1.6}
            maxDistance={4}
            target={[0, 0.75, 0]}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.9}
          />
        </Canvas>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c0e14]">
        {/* THE CHOICE (owner 2026-09-06). Two styles, both shipped rigs: the
            chibi, and Heritage — the articulated figure wearing its own look. */}
        <Row title="Style">
          <Chip on={style === 'chibi'} onClick={() => pickStyle('chibi')}>Chibi</Chip>
          <Chip on={style === 'heritage'} onClick={() => pickStyle('heritage')}>Heritage</Chip>
        </Row>
        {style === 'chibi' ? (
          <>
        <Row title="Body">
          {CHIBI_BODY_TYPES.map((b) => (
            <Chip key={b} on={cfg.bodyType === b} onClick={() => set('bodyType', b)}>
              {label(b)}
            </Chip>
          ))}
        </Row>
        <Row title="Skin">
          {CHIBI_SKIN_TONES.map((hex) => (
            <Swatch key={hex} hex={hex} name={`Skin ${hex}`} on={cfg.skinTone === hex} onClick={() => set('skinTone', hex)} />
          ))}
        </Row>
        <Row title="Hair">
          {CHIBI_HAIR_STYLES.map((h) => (
            <Chip key={h} on={cfg.hairStyle === h} onClick={() => set('hairStyle', h)}>
              {label(h)}
            </Chip>
          ))}
        </Row>
        <Row title="Hair colour">
          {CHIBI_HAIR_COLORS.map((hex) => (
            <Swatch key={hex} hex={hex} name={`Hair ${hex}`} on={cfg.hairColor === hex} onClick={() => set('hairColor', hex)} />
          ))}
        </Row>
        <Row title="Eyes">
          {CHIBI_EYES.map((e) => (
            <Chip key={e} on={cfg.eyes === e} onClick={() => set('eyes', e)}>
              {label(e)}
            </Chip>
          ))}
        </Row>
        <Row title="Mouth">
          {CHIBI_MOUTHS.map((m) => (
            <Chip key={m} on={cfg.mouth === m} onClick={() => set('mouth', m)}>
              {label(m)}
            </Chip>
          ))}
        </Row>
        <Row title="Beauty mark">
          {CHIBI_MARKS.map((m) => (
            <Chip key={m} on={cfg.mark === m} onClick={() => set('mark', m)}>
              {label(m)}
            </Chip>
          ))}
        </Row>
        <Row title="Outfit">
          {CHIBI_OUTFITS.map((o) => (
            <Chip key={o} on={cfg.outfit === o} onClick={() => set('outfit', o)}>
              {label(o)}
            </Chip>
          ))}
        </Row>
        <Row title="Outfit colour">
          {CHIBI_OUTFIT_COLORS.map((c) => (
            <Swatch key={c.hex} hex={c.hex} name={c.name} on={cfg.outfitColor === c.hex} onClick={() => set('outfitColor', c.hex)} />
          ))}
        </Row>
        <Row title="Accessory">
          {CHIBI_ACCESSORIES.map((a) => (
            <Chip key={a} on={cfg.accessory === a} onClick={() => set('accessory', a)}>
              {label(a)}
            </Chip>
          ))}
        </Row>
          </>
        ) : (
          <>
        <Row title="Skin">
          {HERITAGE_SKIN_TONES.map((hex) => (
            <Swatch key={hex} hex={hex} name={`Skin ${hex}`} on={hcfg.skinTone === hex} onClick={() => setH('skinTone', hex)} />
          ))}
        </Row>
        <Row title="Hair">
          {HERITAGE_HAIR_STYLES.map((h) => (
            <Chip key={h} on={hcfg.hairStyle === h} onClick={() => setH('hairStyle', h)}>
              {['Crop', 'Short', 'Side-swept', 'Bob', 'Shoulder', 'Long'][h] ?? `Style ${h + 1}`}
            </Chip>
          ))}
        </Row>
        <Row title="Hair colour">
          {HERITAGE_HAIR_COLORS.map((hex) => (
            <Swatch key={hex} hex={hex} name={`Hair ${hex}`} on={hcfg.hairColor === hex} onClick={() => setH('hairColor', hex)} />
          ))}
        </Row>
        <Row title="Outfit">
          {HERITAGE_OUTFITS.map((o) => (
            <Chip key={o} on={hcfg.outfit === o} onClick={() => setH('outfit', o)}>
              {label(o)}
            </Chip>
          ))}
        </Row>
        <Row title="Outfit colour">
          {HERITAGE_OUTFIT_COLORS.map((c) => (
            <Swatch key={c.hex} hex={c.hex} name={c.name} on={hcfg.outfitColor === c.hex} onClick={() => setH('outfitColor', c.hex)} />
          ))}
        </Row>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !dirty}
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#0b0d12] disabled:opacity-40"
        >
          {pending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
        {/* THE REVOCATION, in the same place the guest made the choice — not
            buried in a settings screen. Only offered once there is something
            to remove. */}
        {saved ? (
          <button
            type="button"
            onClick={onReset}
            disabled={pending}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20 disabled:opacity-40"
          >
            Remove my avatar
          </button>
        ) : null}
        <Link
          href={`/${slug}/venue`}
          className="rounded-xl px-3 py-2 text-sm text-white/60 hover:text-white"
        >
          See me in the room →
        </Link>
      </div>

      {note ? (
        <p className="px-1 text-sm text-white/70" role="status" aria-live="polite">
          {note}
        </p>
      ) : null}
      <p className="px-1 text-xs text-white/40">
        Only guests with a personal link to this seating plan can see your
        avatar, and only where guest photos are already shown. It is used for
        this event only, and you can remove it at any time.
      </p>
    </div>
  );
}
