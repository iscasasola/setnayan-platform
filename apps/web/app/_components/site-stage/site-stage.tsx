'use client';

import Link from 'next/link';
import { useCallback, useState, type ReactNode, type Ref } from 'react';
import { ArrowRight, ExternalLink, Eye, Info, Monitor, Smartphone } from 'lucide-react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { HubRole, HubRoleView } from '@/lib/event-hub-control';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { OB } from './obsidian';

/**
 * THE STAGE ASKS WHO, AND WHEN — one frame, two switches.
 *
 * Owner, 2026-09-24, pointing at the controller's "View as" row and the four
 * bordered stage cards under it: *"this 2 can integrate to each other"*. They
 * were two halves of one question — what does my page look like, to whom, and
 * at which point in its life — answered in two places that never met. The four
 * cards are gone; their two doors (Preview ↗, and Editorial's workroom) now
 * hang off whichever stage is picked here.
 *
 * ── WHAT IS REAL AND WHAT IS DESCRIBED ─────────────────────────────────────
 *   WHEN is REAL. The frame is the couple's own `/{slug}`, and a picked stage
 *   asks it for `?phase=` — the host-gated preview `app/[slug]/page.tsx` has
 *   honoured for months. So the frame genuinely becomes that stage's page.
 *   WHO is DESCRIBED. The frame is always the HOST's signed-in page (the owner
 *   ribbon rides it, and `buildOwnerRibbon` gates on a server-verified
 *   capability alone — no param may hide it). Each role's read of the picked
 *   stage is the card under the frame, resolved server-side by
 *   `resolveHubRoleView`. Rendering a different viewer INSIDE the frame needs a
 *   server-verified "as <role>" preview that `/[slug]` does not have; the only
 *   one it has is `?as=replied`, the fabricated seat-holder.
 *
 * ── WHY IT IS A CLIENT COMPONENT ───────────────────────────────────────────
 * Owner, 2026-09-23, on the View-as chips: *"clicking here refreshes the whole
 * page, it should only refresh the lower part"*. A stage chip that navigated
 * would re-run the whole controller to swap one iframe `src`. So WHEN is state,
 * and the address bar is kept in step with `history.replaceState` (no
 * navigation) — `?stage=` stays a real deep link, resolved server-side by
 * `resolveHubStageSelection` into `initialPhase`.
 * VIEW AS keeps its shipped mechanism untouched: native radios, CSS reveals
 * the checked read (`globals.css`, `.sn-viewas-card`), works with no JS.
 *
 * 🛑 EVERY PROP IS PLAIN DATA when the parent is a server component: strings,
 * booleans, arrays of them. `frameRef` exists for a CLIENT parent (the site
 * editor, which posts into its frame) and a server parent never passes it — a
 * function or component crossing server→client took production down on
 * 2026-09-23.
 *
 * ── SHARED ON PURPOSE ──────────────────────────────────────────────────────
 * The site editor's preview (`website/editor/_components/editor-shell.tsx`)
 * draws the same When × Phone/Desktop pair with its own words. It adopts THIS
 * via `frameQuery` ('editor=1'), `frameRef` and `interactive`; the words for
 * the four stages live in `PUBLIC_STAGE_LABELS` and nowhere else.
 */
export type SiteStageStage = {
  phase: LifecyclePhase;
  /** One line on what this stage is — shown behind the (i), never on the page. */
  blurb: string;
};

type Device = 'mobile' | 'desktop';

export function SiteStage({
  slug,
  stages,
  livePhase,
  initialPhase,
  rolesByPhase,
  armedRole = null,
  workroomHref = null,
  initialDevice = 'desktop',
  urlParam = null,
  frameQuery = '',
  frameRef,
  interactive = false,
}: {
  /** The couple's address, or null when they have not set one (no frame then). */
  slug: string | null;
  /** The four stages, in order. */
  stages: readonly SiteStageStage[];
  /** The stage the guests are on TODAY — gets "Active now". */
  livePhase: LifecyclePhase;
  /** Which stage the switch opens on (`?stage=`, else `livePhase`). */
  initialPhase: LifecyclePhase;
  /**
   * VIEW AS — each role's read, resolved per stage on the server. Absent or
   * empty ⇒ no View-as switch at all (a viewer `hubPreviewRoles` refused).
   */
  rolesByPhase?: Partial<Record<LifecyclePhase, readonly HubRoleView[]>>;
  armedRole?: HubRole | null;
  /** Editorial's own door into the story workroom — shown when Editorial is picked. */
  workroomHref?: string | null;
  initialDevice?: Device;
  /** When set, the picked stage is mirrored into this search param, no navigation. */
  urlParam?: string | null;
  /** Extra query for the FRAME only (the editor passes `editor=1`). */
  frameQuery?: string;
  /** For a client parent that talks to the frame. Never passed from a server. */
  frameRef?: Ref<HTMLIFrameElement>;
  /** The editor's frame is tapped to edit; the controller's is a picture. */
  interactive?: boolean;
}) {
  const [phase, setPhase] = useState<LifecyclePhase>(initialPhase);
  const [device, setDevice] = useState<Device>(initialDevice);

  const pick = useCallback(
    (next: LifecyclePhase) => {
      setPhase(next);
      if (!urlParam || typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      url.searchParams.set(urlParam, next);
      window.history.replaceState(window.history.state, '', url);
    },
    [urlParam],
  );

  const index = stages.findIndex((s) => s.phase === phase);
  const stage = stages[index] ?? null;
  const isLive = phase === livePhase;
  const label = PUBLIC_STAGE_LABELS[phase];

  /*
    🔑 TODAY'S STAGE IS THE BARE ADDRESS. `/{slug}` with no `?phase=` is the
    page the QR opens — including a phase the couple PINNED in the editor,
    which a forced `?phase=` would override. So the frame only asks for a phase
    when the couple picked one that is not today's, and the frame and the
    "Open the live page" door under the stage then agree byte for byte.
  */
  const frameSrc = slug
    ? isLive && !frameQuery
      ? `/${slug}`
      : `/${slug}?phase=${phase}${frameQuery ? `&${frameQuery}` : ''}`
    : null;
  const previewHref = slug ? `/${slug}?phase=${phase}` : null;

  const roles = rolesByPhase?.[phase] ?? rolesByPhase?.[livePhase] ?? [];
  const armed = roles.find((r) => r.role === armedRole) ?? null;

  const chipBase =
    'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-300 ease-in-out active:scale-95';
  const chipOff = { backgroundColor: 'rgba(255,255,255,0.06)', color: OB.soft };
  const chipOn = { backgroundColor: OB.gold, color: OB.page };

  const microLabel = (text: string) => (
    <span
      className="w-14 shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
      style={{ color: OB.soft }}
    >
      {text}
    </span>
  );

  /* ══ THE TWO SWITCHES, TOGETHER ══ */
  const switches = (
    <div className="space-y-2.5">
      <div role="group" aria-label="When" className="flex flex-wrap items-center gap-2">
        {microLabel('When')}
        {stages.map((s) => {
          const on = s.phase === phase;
          const live = s.phase === livePhase;
          return (
            <button
              key={s.phase}
              type="button"
              data-phase={s.phase}
              data-live={live ? 'true' : undefined}
              aria-pressed={on}
              onClick={() => pick(s.phase)}
              className={chipBase}
              style={on ? chipOn : chipOff}
            >
              {PUBLIC_STAGE_LABELS[s.phase]}
              {live ? (
                <span
                  className="rounded-full px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-[0.12em]"
                  style={{ backgroundColor: OB.cta, color: OB.page }}
                >
                  Active now
                </span>
              ) : null}
            </button>
          );
        })}
        {/* PHONE / DESKTOP — the frame is real, so its width is the site's own
            breakpoint. Same pair the site editor has carried since 2026-07-25. */}
        <div role="group" aria-label="Preview device" className="ml-auto flex items-center gap-1">
          {(
            [
              { key: 'mobile', label: 'Phone', Icon: Smartphone },
              { key: 'desktop', label: 'Desktop', Icon: Monitor },
            ] as const
          ).map((d) => {
            const on = device === d.key;
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={on}
                aria-label={d.label}
                title={d.label}
                onClick={() => setDevice(d.key)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ease-in-out active:scale-95"
                style={on ? chipOn : chipOff}
              >
                <d.Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      </div>

      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          {microLabel('View as')}
          {roles.map((r) => (
            <label
              key={r.role}
              htmlFor={`sn-viewas-${r.role}`}
              /* NO inline colour here, unlike the WHEN chips: the checked
                 state is painted by `globals.css` (an id selector), and an
                 inline `style` would outrank it — the lit chip would keep the
                 unlit colour. The unlit fill is a class for the same reason. */
              className={`sn-viewas-chip ${chipBase} bg-white/[0.06] text-[#B6B9BE]`}
            >
              {r.name}
            </label>
          ))}
          <InfoTip label="What View as shows">
            Pick who — the read under the frame becomes theirs, at the stage you picked. The frame
            itself stays your own signed-in page: you cannot un-be the host.
          </InfoTip>
        </div>
      ) : null}
    </div>
  );

  /* ══ THE FRAME — the page itself, not a sentence about it ══
     Phone width is a clip, never a scale: the page is responsive, so a 430px
     frame renders the real mobile layout at 1:1. Desktop is the full measure
     (owner, 2026-09-23: *"remove the framing and let it consume the space"*).
     INERT on the controller — `inert` + `tabIndex={-1}` + no pointer events:
     a picture of the page; the lit door beneath it is the way in. */
  const frame = frameSrc ? (
    <div
      className={`relative mx-auto h-[300px] w-full overflow-hidden rounded-xl transition-[max-width] duration-300 ease-in-out sm:h-[420px] lg:h-[560px] ${
        device === 'mobile' ? 'max-w-[430px]' : 'max-w-none'
      }`}
      style={{ boxShadow: '0 18px 40px -18px rgba(0,0,0,0.65)' }}
    >
      <iframe
        ref={frameRef}
        src={frameSrc}
        title={`Your page at ${label}${isLive ? ' — as it stands right now' : ''}`}
        loading="lazy"
        {...(interactive
          ? { className: 'absolute inset-0 h-full w-full border-0' }
          : {
              inert: true,
              tabIndex: -1,
              className: 'pointer-events-none absolute left-0 top-0 h-[1100px] w-full border-0',
            })}
      />
    </div>
  ) : null;

  const caption = (
    <div className="space-y-3 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold" style={{ color: OB.text }}>
          {label}
        </p>
        {isLive ? (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ backgroundColor: OB.cta, color: OB.page }}
          >
            Active now
          </span>
        ) : null}
        {index >= 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: OB.soft }}>
            Stage {index + 1} of {stages.length}
          </span>
        ) : null}
        <InfoTip label={`About ${label}`}>
          {stage?.blurb}
          {slug ? (
            <>
              {' '}
              That strip across the top is yours alone — you are signed in, so your page knows you.
              Your guests never see it.
            </>
          ) : null}
        </InfoTip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            data-stage-preview={phase}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-300 ease-in-out active:scale-95"
            style={chipOff}
          >
            Preview {label}
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        ) : (
          <span className="text-[12px]" style={{ color: OB.soft }}>
            Set your link to preview
          </span>
        )}
        {/* EH5 · THE STORY IS A WORKROOM, NOT A SETTING (design § 2.4). The
            other three stages are things the couple SETS and Preview is
            enough; the story they WORK ON for weeks, so picking it offers the
            same-tab door into the existing editor — the card that carried this
            door is gone, the door is not. */}
        {phase === 'editorial' && workroomHref ? (
          <Link
            href={workroomHref}
            data-workroom
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-300 ease-in-out active:scale-95"
            style={{ backgroundColor: OB.cta, color: OB.page }}
          >
            Open the workroom
            <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </div>
  );

  /* ══ THE READ — who is looking, at the stage picked ══ */
  const cards = armed ? (
    <div className="pt-4">
      {roles.map((r) => (
        <div
          key={r.role}
          className="sn-viewas-card rounded-xl p-4"
          data-viewas={r.role}
          style={{ backgroundColor: OB.card }}
        >
          <p
            className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: OB.gold }}
          >
            {r.who} · {label}
          </p>
          <p className="mt-2 text-[15px] font-semibold" style={{ color: OB.text }}>
            {r.headline}
          </p>
          <p className="mt-1 max-w-prose text-[13px] leading-snug" style={{ color: OB.soft }}>
            {r.blurb}
          </p>
          <ul className="mt-3 space-y-1.5">
            {r.cells.map((cell) => (
              <li key={cell.text} className="flex items-start gap-2 text-[12.5px]">
                <span
                  aria-hidden
                  className="mt-px font-mono text-[11px] leading-5"
                  style={{ color: cell.mark === 'none' ? OB.soft : OB.gold }}
                >
                  {MARK_GLYPH[cell.mark]}
                </span>
                {/* 🔑 An unknown line says it could not be read. It NEVER
                    renders as a zero and never as a shape we guessed. */}
                <span style={{ color: cell.known ? OB.text : OB.soft }}>
                  <span className="sr-only">{MARK_WORD[cell.mark]} </span>
                  {cell.text}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {r.previewHref ? (
              <a
                href={r.previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-300 ease-in-out active:scale-95"
                style={{ backgroundColor: OB.cta, color: OB.page }}
              >
                <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                {r.previewLabel}
              </a>
            ) : null}
            <p className="text-[11.5px]" style={{ color: OB.soft }}>
              {r.footnote}
            </p>
          </div>
        </div>
      ))}
    </div>
  ) : null;

  /*
    🔒 THE RADIOS MUST BE EARLIER SIBLINGS OF EVERYTHING THEY REVEAL.
    `globals.css` shows a read with `#sn-viewas-<role>:checked ~ div
    .sn-viewas-card[…]` and lights its chip the same way, so the six radios sit
    first in the fieldset and the switches, frame and reads are later `div`s.
    Wrapping the radios in their own group would silently break every rule.
  */
  if (!armed) {
    return (
      <div className="space-y-4">
        {switches}
        <div>
          {frame}
          {caption}
        </div>
      </div>
    );
  }
  return (
    <fieldset className="m-0 space-y-4 border-0 p-0">
      <legend className="sr-only">Preview your page — when, and as whom</legend>
      {roles.map((r) => (
        <input
          key={r.role}
          type="radio"
          name="sn-viewas"
          id={`sn-viewas-${r.role}`}
          defaultChecked={r.role === armed.role}
          className="sr-only"
        />
      ))}
      {switches}
      <div>
        {frame}
        {caption}
      </div>
      {cards}
    </fieldset>
  );
}

/**
 * ● full · ◐ partial or read-only · ○ nothing, on purpose — the § 3.2 key.
 * Paired with a WORD for screen readers: a glyph alone tells a person using one
 * nothing at all, and "what each role sees" is the entire content here.
 */
const MARK_GLYPH = { full: '●', partial: '◐', none: '○' } as const;
const MARK_WORD = { full: 'Yes:', partial: 'Partly:', none: 'No:' } as const;

/**
 * (i) — the house rule for a helper sentence (DESIGN_BRIEF 2026-09-24 § 2):
 * never on the page, revealed on hover or on a tap.
 *
 * ⚠ The text is always in the DOM and only `hidden` toggles, so a screen
 * reader reaches it through `aria-describedby` and a test can read it. When the
 * design foundation's shared `InfoTip` (PR #5944) lands, swap this for it.
 */
function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = `sn-tip-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  return (
    <span className="relative inline-flex" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={id}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ease-in-out active:scale-95"
        style={{ color: OB.soft }}
      >
        <Info aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className="absolute left-0 top-7 z-20 w-72 max-w-[80vw] rounded-xl p-3 text-[12px] leading-snug backdrop-blur"
        style={{
          backgroundColor: 'rgba(30,34,41,0.96)',
          color: OB.soft,
          boxShadow: '0 18px 40px -12px rgba(0,0,0,0.7)',
        }}
      >
        {children}
      </span>
    </span>
  );
}
