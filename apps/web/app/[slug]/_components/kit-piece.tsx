import type { CSSProperties } from 'react';
import { artKitCss, kitFile, viewPlacements, type ArtKit, type ArtKitPlacement, type ArtKitSlot, type ArtKitView } from '@/lib/art-kits';
import { splitCoupleNames } from '@/lib/split-names';
import type { HubElementStyle } from '@/lib/element-style';
import { ClosingLine } from './closing-line';

/**
 * 🕯 THE ART KIT, DRAWN — one component per piece (`KitPiece`), one per slot (`KitSlot`), each placed by the registry
 * (`lib/art-kits.ts`), never by hand here. Owner 2026-10-16, DECISION_LOG "APPROVED — THE VINTAGE ART KIT, AS THE PROOF
 * SHOWS".
 *
 * Mounted at the guest page's fixed places and nowhere else: the veil (`reveal-overlay.tsx`, the seal), the cover
 * (`pahina-masthead.tsx`), the countdown card (`countdown.tsx`), the e-gifts bank card (`pabuya-card-list.tsx`) and the
 * divider above it (`guest-welcome.tsx`), the reply card (`guest-me-parts.tsx`) and the sign-off
 * (`invitation-shell.tsx`, `KitClosing`). Each mount takes the kit or `null` — `null` renders nothing, so a page
 * without a kit (or with Decorations off) is byte-identical to the page before the kit existed.
 *
 * Plain HTML, no client JavaScript of its own (a server component, and safe inside a client one): `<picture>` with
 * AVIF first and WebP behind it, `loading="lazy"` with the slot's `sizes`, so a piece is fetched only as its section
 * nears. Decorative, every one: hidden from assistive tech, deaf to the pointer — the seal included, because the tap
 * that lands on it falls through to the veil's own tap, which IS the unveil.
 * Motion (Sway · Float) is the kit's stylesheet; `ArtKitMotion` only marks a piece on screen so it moves while seen.
 */

/** The kit's stylesheet, once per page — and the page's mark that a kit is drawn (`html:has([data-art-kit])`). */
export function KitStyle({ kit }: { kit: ArtKitView }) {
  return <style data-art-kit={kit.kit.ornament}>{artKitCss(kit)}</style>;
}

/** One piece in its box. */
export function KitPiece({ kit, placement, eager = false }: { kit: ArtKit; placement: ArtKitPlacement; eager?: boolean }) {
  const piece = kit.pieces[placement.piece];
  if (!piece) return null;
  const { box } = placement;
  const style: CSSProperties = {
    width: box.width,
    ...(box.left !== undefined ? { left: box.left } : {}),
    ...(box.right !== undefined ? { right: box.right } : {}),
    ...(box.top !== undefined ? { top: box.top } : {}),
    ...(box.bottom !== undefined ? { bottom: box.bottom } : {}),
    ...(box.transform ? { transform: box.transform } : {}),
    ...(placement.motion !== 'still' && placement.period ? { animationDuration: `${placement.period}s` } : {}),
    ...(placement.motion !== 'still' && placement.delay ? { animationDelay: `${placement.delay}s` } : {}),
  };
  const sizes = box.width.endsWith('px') ? box.width : `${piece.w}px`;
  const img = (src: string) => (
    <img
      src={src}
      alt=""
      width={piece.w}
      height={piece.h}
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
  return (
    <span
      data-kit-piece={placement.piece}
      {...(placement.motion !== 'still' ? { 'data-kit-motion': placement.motion } : {})}
      {...(placement.mirror ? { 'data-kit-mirror': '' } : {})}
      style={style}
    >
      {piece.formats.includes('svg') ? (
        img(kitFile(kit, piece, 'svg'))
      ) : (
        <picture>
          {piece.formats.includes('avif') ? (
            <source type="image/avif" srcSet={`${kitFile(kit, piece, 'avif')} ${piece.w * 2}w`} sizes={sizes} />
          ) : null}
          {img(kitFile(kit, piece, 'webp'))}
        </picture>
      )}
    </span>
  );
}

/** Every piece this page places in one slot (its scene's Accent pick) — the slot's ONE mount; nothing for None. */
export function KitSlot({ kit, slot, eager = false }: { kit: ArtKitView; slot: ArtKitSlot; eager?: boolean }) {
  const placements = viewPlacements(kit, slot);
  if (placements.length === 0) return null;
  return (
    <span aria-hidden data-kit-slot={slot}>
      {placements.map((p, i) => (
        <KitPiece key={`${p.piece}-${i}`} kit={kit.kit} placement={p} eager={eager} />
      ))}
    </span>
  );
}

/**
 * The seal's letters — the couple's mark (`resolveMonogram`'s text, "I & C") as the proof draws it in the wax: the
 * letters only, the joiner dropped ("IC"), at most three.
 */
export function sealLetters(mark: string | null | undefined): string {
  const letters = (mark ?? '').replace(/&|\band\b/gi, ' ').replace(/[^\p{L}]/gu, '');
  return letters.slice(0, 3);
}

/** 🔴 The veil's wax seal, with the couple's mark in its centre. A still; the tap falls through to the veil's. */
export function KitSeal({ kit: view, mark }: { kit: ArtKitView; mark: string | null }) {
  const kit = view.kit;
  const placements = viewPlacements(view, 'veil');
  if (placements.length === 0) return null;
  const letters = sealLetters(mark);
  return (
    <span aria-hidden data-kit-slot="veil">
      {placements.map((p, i) => (
        <span key={i} data-kit-seal="" style={{ position: 'absolute', left: p.box.left, bottom: p.box.bottom, width: p.box.width, filter: 'drop-shadow(0 4px 6px rgba(53,17,21,.35))' }}>
          <KitPiece kit={kit} placement={{ ...p, box: { width: '100%', left: '0px', top: '0px' } }} eager />
          <span style={{ position: 'relative', display: 'block', aspectRatio: `${kit.pieces[p.piece]?.w ?? 84} / ${kit.pieces[p.piece]?.h ?? 86}` }} />
          {letters ? (
            <b
              data-kit-seal-mark=""
              className="font-pahina"
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 400, fontSize: letters.length > 2 ? '22px' : '28px', color: '#F7E7E3', letterSpacing: '.04em', textShadow: '0 1px 0 rgba(0,0,0,.35)', lineHeight: 1 }}
            >
              {letters}
            </b>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/**
 * 🖼 THE CLOSING — the sign-off restyled, not a new section: the couple's photo in the kit's oval, "See you soon.",
 * then the band with their names in the Event title's face, the date, and the Powered-by line (unless the event's
 * Pro hides it — `hideWatermark`, exactly as the plain sign-off reads it).
 *
 * 📷 THE PHOTO IS THIS EVENT'S OWN COVER PHOTO OR NOTHING (`photoUrl` — the hero photo `loadMedia` signed for THIS
 * event). No stand-in, no sample, no other couple's picture: with no photo the opening holds their mark instead.
 * Black and white, as the proof shows it.
 */
export function KitClosing({
  kit: view,
  names,
  date,
  photoUrl,
  mark,
  hideWatermark,
  twoPeople = true,
  line = null,
  stamp = false,
}: {
  /** 🕯 The closing's line — the couple's words and look (`closing-line.tsx`); null: "See you soon." as drawn before. */
  line?: HubElementStyle | null;
  /** The Maker's canvas: the line carries its part key. */
  stamp?: boolean;
  kit: ArtKitView;
  names: string;
  date: string | null;
  photoUrl: string | null;
  mark: string | null;
  hideWatermark: boolean;
  twoPeople?: boolean;
}) {
  const kit = view.kit;
  const frame = viewPlacements(view, 'closing')[0];
  const piece = frame ? kit.pieces[frame.piece] : undefined;
  const hole = kit.closing.photoHole;
  const split = splitCoupleNames(names, twoPeople);
  return (
    <div data-kit-closing="" className="pt-7 text-center">
      {frame && piece ? (
        <div
          data-kit-oval=""
          className="relative mx-auto"
          style={{ width: `min(${piece.w}px, calc(100% - 2rem))`, aspectRatio: `${piece.w} / ${piece.h}` }}
        >
          <div
            data-kit-photo={photoUrl ? 'own' : 'mark'}
            className="absolute overflow-hidden"
            style={{
              left: `${((hole.cx - hole.rx) / piece.w) * 100}%`,
              top: `${((hole.cy - hole.ry) / piece.h) * 100}%`,
              width: `${((hole.rx * 2) / piece.w) * 100}%`,
              height: `${((hole.ry * 2) / piece.h) * 100}%`,
              borderRadius: '50%',
              rotate: `${hole.tilt}deg`,
              background: '#D9CFC4',
            }}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a presigned address; the optimiser would re-sign it
              <img
                src={photoUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                style={{ filter: 'grayscale(1) contrast(1.05)', rotate: `${-hole.tilt}deg`, scale: '1.04' }}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-pahina text-4xl italic" style={{ color: kit.closing.soon }}>
                {sealLetters(mark)}
              </span>
            )}
          </div>
          <span aria-hidden data-kit-slot="closing" className="absolute inset-0">
            <KitPiece kit={kit} placement={{ ...frame, box: { ...frame.box, width: '100%' } }} />
          </span>
        </div>
      ) : null}
      <ClosingLine line={line} stamp={stamp} className="mx-4 mb-6 mt-5 font-pahina text-[1.625rem] italic" base={{ color: kit.closing.soon }} />
      <div data-kit-band="" className="px-5 pb-7 pt-8" style={{ background: kit.closing.band, color: kit.closing.ink }}>
        <p className="font-pahina text-[2.125rem] font-light leading-[1.05]">
          {split.first}
          {split.second ? (
            <>
              <i className="mx-1.5 text-[1.375rem]" style={{ color: kit.closing.date }}>
                {split.joiner ?? '&'}
              </i>
              {split.second}
            </>
          ) : null}
        </p>
        {date ? (
          <p className="mt-2.5 font-pahina text-[0.9375rem] tracking-[0.06em]" style={{ color: kit.closing.date }}>
            {date}
          </p>
        ) : null}
        {hideWatermark ? null : (
          <p className="mt-6 text-xs" style={{ color: 'rgba(247,242,236,.78)' }}>
            Powered by Setnayan · setnayan.com
          </p>
        )}
      </div>
    </div>
  );
}
