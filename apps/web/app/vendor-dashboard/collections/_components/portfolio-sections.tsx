'use client';

import { createContext, useContext, useId, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Info, Plus } from 'lucide-react';
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { SAMPLE_PORTFOLIO } from '@/lib/empty-look-samples';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { PortfolioUploadDoor } from '../../_components/portfolio-upload';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { DatesRow } from '../../customers/_components/dates-row';

/**
 * 🖼 THE PORTFOLIO'S COLLECTIONS SHAPE (owner 9 Nov, DECISION_LOG "PORTFOLIO IS REDESIGNED AFTER APPLE PHOTOS ›
 * COLLECTIONS" + "PORTFOLIO PROTOTYPE APPROVED FOR BUILD 5"; the contract is
 * `prototypes/shop_discounts_bundle_card_open_2026-11-09/portfolio.html`, artifact SwnvjGzHNhgHML7X34F3fL v3).
 *
 *   SECTION  a bold title with › that OPENS it, a quiet count (or one door pill), and a round ˅ that FOLDS it. The
 *            fold is the house fold's own motion — `grid-template-rows` on the rise token (`--sn-dur-rise`, 0.7 s),
 *            the shut body `inert`, nothing moving under reduced motion — so it reads exactly like `Fold` does.
 *   RAIL     a sideways carousel of large rounded tiles with the name on the photo. Its first and last tiles sit on the
 *            page's 16-px gutter (the trailing spacer makes the right one equal to the left at every phone width).
 *   EMPTY    owner 11 Nov "c. yes": a section is NEVER hidden for being empty — its rail shows the greyed Example tile
 *            (the shared `ExamplePreview`, sample from `lib/empty-look-samples.ts`) and beside it ONE placeholder tile
 *            with the honest line and the section's one door. Where the door is Upload it is the device's picker IN
 *            PLACE (`PortfolioUploadDoor`, "UPLOAD OPENS THE DEVICE PICKER IN PLACE") — never a page.
 *   UNREAD   a refused read says so on the placeholder tile, and never wears an Example (reads-are-honest).
 *   RISE     the titled head RISES ITS GROUP FULL SCREEN from where it sits (owner 10 Nov, DECISION_LOG "FULLY ANIMATED
 *            MOSTLY MEANS RISE FULL SCREEN" — every tappable block rises from itself, and closing falls back into it):
 *            the ONE `RiseScreen` (`lib/rise-motion.ts` · `lib/rise-screen.ts`), headed by the group's name and count,
 *            its body the whole group as a full-screen grid (or the group's own rail, wrapped, when it has no grid of
 *            its own — an empty group keeps its finished empty look), and the group's own page as one row at the foot.
 * 🔒 collections/the-portfolio-is-collections.test.ts · collections/each-group-heading-rises-full-screen.test.ts
 */

/** Inside a risen group the rail WRAPS into a grid on the 16-px gutters instead of scrolling sideways. */
const InRise = createContext(false);

/** What a group's head rises into: its count line, the full-screen grid (absent → the section's own rail, wrapped) and
 *  the group's own page, as one row at the foot (a `#` anchor is never one — it lives under the risen screen). */
export type GroupRise = { line: string; body?: ReactNode; page?: { title: string; line: string; href: string } | null };

type DoorIcon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

export type Door =
  | { kind: 'link'; label: string; href: string; icon: DoorIcon }
  | { kind: 'press'; label: string; onPress: () => void; icon: DoorIcon }
  | { kind: 'upload'; facts: PortfolioUploadFacts };

/** A door never runs past its tile or its head: the word is cut with "…" before the pill leaves its box. */
const FIT = 'max-w-full min-w-0 [&_.lbl]:min-w-0 [&_.lbl]:truncate';

/** The header's one door, beside the title: a link or a press, on the button rule. */
function DoorButton({ door, data }: { door: Exclude<Door, { kind: 'upload' }>; data: string }) {
  return door.kind === 'link' ? (
    <ActionButton tone="neutral" icon={door.icon} label={door.label} href={door.href} className={FIT} data-portfolio-door={data} />
  ) : (
    <ActionButton tone="neutral" icon={door.icon} label={door.label} onClick={door.onPress} className={FIT} data-portfolio-door={data} />
  );
}

/** Upload — the device's own picker, in place (a label around the file input), worn as the button rule's pill. */
export function UploadDoor({ facts, data }: { facts: PortfolioUploadFacts; data: string }) {
  return (
    <PortfolioUploadDoor facts={facts} className={actionButtonClass('brand', { main: true })} data={`portfolio-upload-${data}`}>
      <Plus aria-hidden strokeWidth={1.9} />
      <span className="lbl">Upload</span>
    </PortfolioUploadDoor>
  );
}

export function PortfolioSection({
  id,
  title,
  countLabel = null,
  pill = null,
  rise,
  children,
}: {
  id: string;
  title: string;
  /** The quiet count beside the title ("14 photos", already formatted); hidden when a pill takes the room. */
  countLabel?: string | null;
  /** The section's one door at the head (Edit · Add a link) — only on a FILLED section; an empty one carries its door
   *  on the placeholder tile, so there is never a second. */
  pill?: Exclude<Door, { kind: 'upload' }> | null;
  /** › — RISE the group full screen from its head. `null` = a plain heading (More). */
  rise: GroupRise | null;
  children: ReactNode;
}) {
  const [folded, setFolded] = useState(false);
  const [risen, setRisen] = useState(false);
  const bodyId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  // An unfolded section whose rail runs low glides its head to the pin line — the app-wide reveal-on-open, shared hook.
  const intend = useRevealOnOpen(!folded, () => ({ head: sectionRef.current }));
  const head = (
    <>
      <span className="line-clamp-2 min-w-0 text-[20px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">{title}</span>
      <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/40" strokeWidth={2} />
    </>
  );
  // The title keeps its room (a long one wraps to two lines); the count gives way first; the ˅ holds the right end.
  const headClass = 'sn-press flex min-w-0 flex-[0_1_auto] items-center gap-1 text-left';
  return (
    <section ref={sectionRef} aria-label={title} className="pt-5" data-portfolio-section={id} data-folded={folded ? '' : undefined}>
      <div className="flex min-h-11 items-center gap-2 px-4 pb-2.5" data-portfolio-section-head="">
        {rise === null ? (
          <h2 className="flex min-w-0 flex-[0_1_auto] items-center">
            <span className="line-clamp-2 min-w-0 text-[20px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">{title}</span>
          </h2>
        ) : (
          <button type="button" onClick={() => setRisen(true)} className={headClass} aria-label={`Open ${title}`} aria-haspopup="dialog" data-portfolio-open={id}>
            {head}
          </button>
        )}
        {pill ? (
          <span className="ml-auto flex min-w-0 max-w-[46%] flex-none">
            <DoorButton door={pill} data={id} />
          </span>
        ) : countLabel ? (
          <span className="ml-auto min-w-0 flex-[0_6_auto] truncate font-mono text-[12.5px] text-ink/55 max-[340px]:hidden" data-portfolio-count="">
            {countLabel}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            intend();
            setFolded((f) => !f);
          }}
          aria-expanded={!folded}
          aria-controls={bodyId}
          aria-label={`${folded ? 'Show' : 'Hide'} ${title}`}
          // The 44-px target's ring sits on the 16-px gutter: the 6 px either side of the 32-px ring hang into the padding.
          className={`${pill || countLabel ? '' : 'ml-auto '}-mr-1.5 grid h-11 w-11 flex-none place-items-center`}
          data-portfolio-fold={id}
        >
          <span
            className={`grid h-8 w-8 place-items-center rounded-full border border-ink/15 bg-[color:var(--m-paper)] text-sn-accent transition-transform motion-reduce:transition-none ${folded ? '-rotate-90' : ''}`}
            style={{ transitionDuration: 'var(--sn-dur-rise)' }}
          >
            <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={2} />
          </span>
        </button>
      </div>
      <div
        id={bodyId}
        className="grid transition-[grid-template-rows] motion-reduce:transition-none"
        style={{ gridTemplateRows: folded ? '0fr' : '1fr', transitionDuration: 'var(--sn-dur-rise)', transitionTimingFunction: 'cubic-bezier(.2,.7,.2,1)' }}
        inert={folded}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
      {/* ⤴ The group, risen full screen out of its head; ✕ falls back into the same head. */}
      {rise && risen ? (
        <RiseScreen title={title} line={rise.line} onClose={() => setRisen(false)} data={`portfolio-${id}`}>
          <div className="pt-3" data-portfolio-risen={id}>
            <InRise.Provider value>{rise.body ?? children}</InRise.Provider>
            {rise.page && !rise.page.href.startsWith('#') ? (
              <div className="px-4 pt-3">
                <DatesRow data={`portfolio-page-${id}`} title={rise.page.title} line={rise.page.line} href={rise.page.href} />
              </div>
            ) : null}
          </div>
        </RiseScreen>
      ) : null}
    </section>
  );
}

/** A sideways rail of tiles on the 16-px gutter (left = right, measured at 320–390). */
export function Rail({ children, data }: { children: ReactNode; data: string }) {
  if (useContext(InRise))
    return (
      <div className="flex flex-wrap items-start gap-2.5 px-4 pb-1.5" data-portfolio-rail={data} data-rail-wrapped="">
        {children}
      </div>
    );
  return (
    <div
      className="flex snap-x snap-mandatory items-start gap-2.5 overflow-x-auto scroll-pl-4 pl-4 pr-0 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-portfolio-rail={data}
    >
      {children}
      {/* The rail's own right gutter: 6 px + the 10-px gap = 16 px, equal to the left at every width. (Not `pr-4`: some
          engines drop a scroller's end padding and Chromium keeps it — measured 32 px with both, 2026-11-10.) */}
      <span aria-hidden className="w-1.5 flex-none" />
    </div>
  );
}

const TILE = 'relative block h-[150px] w-[150px] flex-none snap-start overflow-hidden rounded-card bg-ink/5 text-left';
const TILE_BASE = TILE;
const TILE_HERO = 'relative block h-[280px] w-[280px] max-w-[calc(100vw-56px)] flex-none snap-start overflow-hidden rounded-3xl bg-ink/5 text-left';

/** The face of a tile: the photo (or a quiet ground with the section's icon), the scrim, the name on the photo. */
function TileFace({ name, sub, photo, icon }: { name: string; sub?: string | null; photo: string | null; icon?: ReactNode }) {
  return (
    <>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned display URLs / shipped stock photos
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,var(--m-paper-2),color-mix(in_srgb,var(--m-ink)_14%,var(--m-paper-2)))] text-ink/45 [&_svg]:h-8 [&_svg]:w-8">
          {icon}
        </span>
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(to_top,rgba(20,18,14,.72),rgba(20,18,14,0))]" />
      <span className="absolute inset-x-3 bottom-2.5 block text-[14px] font-semibold leading-[1.15] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.35)]">
        <span className="line-clamp-2">{name}</span>
        {sub ? <small className="mt-0.5 block truncate font-mono text-[11px] font-normal uppercase tracking-[0.04em] opacity-90">{sub}</small> : null}
      </span>
    </>
  );
}

/** One tile — it opens its collection (a press, or a link to the collection's own page). */
export function Tile({
  name,
  sub = null,
  photo,
  icon,
  open,
  data,
  hero = false,
}: {
  name: string;
  sub?: string | null;
  photo: string | null;
  icon?: ReactNode;
  open: ((el: HTMLElement) => void) | { href: string; external?: boolean };
  data: string;
  /** ⭐ The prototype's large tile (`.tile.hero`, 280 px) — Your best work's rail. */
  hero?: boolean;
}) {
  const face = <TileFace name={name} sub={sub} photo={photo} icon={icon} />;
  const label = `Open ${name || sub || 'photo'}`;
  const TILE = hero ? TILE_HERO : TILE_BASE;
  if (typeof open === 'function')
    return (
      <button type="button" onClick={(e) => open(e.currentTarget)} aria-label={label} className={`sn-press ${TILE}`} data-portfolio-tile={data}>
        {face}
      </button>
    );
  if (open.external)
    return (
      <a href={open.href} target="_blank" rel="noreferrer" aria-label={label} className={`sn-press ${TILE}`} data-portfolio-tile={data}>
        {face}
      </a>
    );
  return open.href.startsWith('#') ? (
    <a href={open.href} aria-label={label} className={`sn-press ${TILE}`} data-portfolio-tile={data}>
      {face}
    </a>
  ) : (
    <Link href={open.href} aria-label={label} className={`sn-press ${TILE}`} data-portfolio-tile={data}>
      {face}
    </Link>
  );
}

/**
 * 👻 AN EMPTY SECTION'S RAIL: the greyed Example tile (only on an ANSWERED, empty read) and the placeholder tile with the
 * honest line and the one door. `unread` → the placeholder says it could not load, and no Example is drawn.
 */
export function EmptyRail({
  id,
  line,
  door,
  icon,
  unread = false,
}: {
  /** The section key — also the sample's key in `SAMPLE_PORTFOLIO`. */
  id: string;
  line: string;
  door: Door | null;
  icon: ReactNode;
  unread?: boolean;
}) {
  const sample = SAMPLE_PORTFOLIO[id];
  return (
    <Rail data={id}>
      {!unread && sample ? (
        <ExamplePreview className="w-[150px] flex-none snap-start">
          <span className={TILE}>
            <TileFace name={sample.name} sub={sample.sub} photo={sample.photo} />
          </span>
        </ExamplePreview>
      ) : null}
      <div
        className={`${unread ? '' : 'mt-[14px]'} flex h-[150px] w-[220px] flex-none snap-start flex-col justify-between rounded-card bg-ink/[0.04] p-3`}
        role={unread ? 'status' : undefined}
        data-portfolio-empty={id}
        data-portfolio-unread={unread ? id : undefined}
      >
        <p className="flex items-start gap-2 text-[13px] leading-snug text-ink/75">
          <span aria-hidden className="mt-0.5 inline-flex flex-none text-ink/45 [&_svg]:h-4 [&_svg]:w-4">
            {unread ? <Info strokeWidth={1.9} /> : icon}
          </span>
          <span className="line-clamp-4">{unread ? 'Couldn’t load this just now — nothing was lost.' : line}</span>
        </p>
        {!unread && door ? (
          <span className="flex min-w-0">
            {door.kind === 'upload' ? <UploadDoor facts={door.facts} data={id} /> : <DoorButton door={door} data={id} />}
          </span>
        ) : null}
      </div>
    </Rail>
  );
}

/** The rail's last tile when it ADDS to the collection (Moodboard library's "Add to the inspiration library"). */
export function AddTile({ door, data }: { door: Extract<Door, { kind: 'link' }>; data: string }) {
  const Icon = door.icon;
  return (
    <Link
      href={door.href}
      className={`sn-press flex ${TILE.replace('bg-ink/5', '')} flex-col items-center justify-center gap-2 border border-dashed border-ink/20 bg-[color:var(--m-paper)] px-3 text-center`}
      data-portfolio-door={data}
    >
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 text-sn-accent [&_svg]:h-5 [&_svg]:w-5">
        <Icon aria-hidden strokeWidth={1.9} />
      </span>
      <span className="text-[13px] font-semibold leading-tight text-ink">{door.label}</span>
    </Link>
  );
}

/** "More" — the utility collections as a 2-column grid of quiet pills (the approved prototype's `.ugrid`). */
export function MorePills({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4" data-portfolio-more="">
      {children}
    </div>
  );
}

export function MorePill({
  icon,
  label,
  countLabel,
  open,
  data,
}: {
  icon: ReactNode;
  label: string;
  /** Already formatted (`formatCount`). */
  countLabel: string;
  open: ((el: HTMLElement) => void) | { href: string };
  data: string;
}) {
  const inner = (
    <>
      <span aria-hidden className="inline-flex flex-none text-ink/55 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <small className="flex-none font-mono text-[12px] text-ink/45">{countLabel}</small>
    </>
  );
  // A pressable pill — the class list of the <button> / <Link> drawn just below.
  const cls =
    'sn-press flex h-12 w-full min-w-0 items-center gap-2.5 rounded-lg border border-ink/10 bg-[color:var(--m-paper)] pl-3.5 pr-3 text-left text-[14.5px] font-medium text-ink'; // no-card-ok: a pressable pill (a <button> or <Link>), not a box
  return typeof open === 'function' ? (
    <button type="button" onClick={(e) => open(e.currentTarget)} className={cls} data-portfolio-pill={data}>
      {inner}
    </button>
  ) : (
    <Link href={open.href} className={cls} data-portfolio-pill={data}>
      {inner}
    </Link>
  );
}
