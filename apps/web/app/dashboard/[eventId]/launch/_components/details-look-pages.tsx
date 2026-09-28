'use client';

import { useEffect, useRef, useState } from 'react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { makerPageCanvasSrc } from '@/lib/maker-made-once-pages';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { REVEAL_STAGE_CHOICES } from '@/lib/reveal-stages';
import { canvasKeyOfSelection } from '@/lib/maker-selection';
import { CanvasStaysOnThePage } from '../../website/editor/_components/maker-canvas-guard';
import { MakerPageFrame, MakerPageSwitch } from './maker-page';
import { MAKER_PLAY_SCENE_EVENT } from './maker-play-menu';
import { useMaker } from './maker-context';
import { DetailsGoTo } from './details-go';

/**
 * 🎨 LOGO · HERO · REVEAL, MOVED INTO DETAILS WHOLE (Details part 3; owner
 * 2026-09-28, DECISION_LOG "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS;
 * THE TOP MENU IS THE FOUR STAGES + DETAILS").
 *
 * They were Maker pages of their own (`MakerWork`'s `pageView`, 2026-09-25).
 * Nothing about them is redrawn here: the SAME nodes the work area always
 * built (`website/editor/page.tsx` `madeOnce` — `MakerLogoPanel`,
 * `MakerHeroPanel` with the Main background row, `MakerRevealPanel`) are
 * registered by `MakerWork` (`MakerLookPages`) and drawn in Details' columns
 * with the split they shipped with:
 *
 *   · Logo   — the studio IS the body; it lays its own panel beside its canvas
 *              (`detailsItemLayout` 'whole'). Opening it still writes nothing —
 *              its save gate is the studio's own (`the-logo-never-saves-on-open`).
 *   · Hero   — the guest page, the hero alone (`makerPageCanvasSrc` 'hero'),
 *              fills the body; Designs 1–4, its parts and the photo are the
 *              editor on the right ('fill').
 *   · Reveal — the opening playing on the stage it plays on, with the same
 *              "Play it on" switch; its picker on the right ('fill').
 *
 * ▶ The toolbar's "Play this scene" plays them in THIS frame: the Reveal by
 * loading it again (its page IS the opening), the Hero by the bridge's replay.
 *
 * ⏳ Until the work area has registered them (the first paint, before
 * hydration) the item says it is opening — and if they never arrive, it SAYS
 * they could not be opened, never an empty column that reads as "no logo".
 */

export type LookPageKey = 'logo' | 'hero' | 'reveal';

const WORD: Record<LookPageKey, string> = { logo: 'Logo', hero: 'hero', reveal: 'reveal' };

/** The body of a Look item: its page. */
export function DetailsLookBody({ item }: { item: LookPageKey }) {
  const maker = useMaker();
  const look = maker?.lookPages ?? null;
  const late = useLate(Boolean(look));
  if (!maker || !look) return <Waiting item={item} late={late} />;
  if (item === 'logo') {
    return look.logo ? (
      <div className="flex min-h-0 flex-1 flex-col" data-details-look="logo">
        {look.logo}
      </div>
    ) : (
      <CouldNotOpen item={item} />
    );
  }
  return <LookFrame item={item} />;
}

/** The editor of a Look item: the controls its page always had beside it. */
export function DetailsLookEditor({ item }: { item: Exclude<LookPageKey, 'logo'> }) {
  const maker = useMaker();
  const look = maker?.lookPages ?? null;
  const late = useLate(Boolean(look));
  if (!maker || !look) return <Waiting item={item} late={late} />;
  const node = look[item];
  return node ? <div data-details-look-editor={item}>{node}</div> : <CouldNotOpen item={item} />;
}

function LookFrame({ item }: { item: Exclude<LookPageKey, 'logo'> }) {
  const maker = useMaker()!;
  const look = maker.lookPages!;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [revealPick, setRevealPick] = useState<LifecyclePhase | null>(null);
  const stages = look.revealStages;
  const revealStage = revealPick && stages.includes(revealPick) ? revealPick : (stages[0] ?? null);
  const src = makerPageCanvasSrc(look.publicLandingUrl, item, maker.stage, { revealStage });
  const frameKey = `${item}:${src}:${maker.renderStamp}`;
  const showing = maker.selection?.kind === 'tool' && maker.selection.key === 'details' && maker.detailsItem === item;

  /* ▶ "Play this scene" — only while this item is the one showing. */
  useEffect(() => {
    if (!showing) return;
    const onPlay = () => {
      const f = frameRef.current;
      if (item === 'reveal') {
        try {
          f?.contentWindow?.location.reload();
        } catch {
          /* a frame we cannot reach is left as it is */
        }
        return;
      }
      const key = canvasKeyOfSelection({ kind: 'tool', key: 'hero' }, []);
      if (key) f?.contentWindow?.postMessage({ source: 'setnayan-editor', t: 'play', key }, window.location.origin);
    };
    window.addEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
    return () => window.removeEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
  }, [showing, item]);

  if (!src || !look.publicLandingUrl) {
    return (
      <div className="m-auto flex max-w-sm flex-col items-center gap-1 px-4 text-center text-sm text-ink/70" data-maker-page-no-address="">
        <p>Your page shows here once it has an address.</p>
        <DetailsGoTo item="address">Choose your Event Hub address</DetailsGoTo>
      </div>
    );
  }
  const title =
    item === 'reveal'
      ? `Your reveal — ${PUBLIC_STAGE_LABELS[revealStage ?? 'save_the_date']}`
      : `Your hero — ${PUBLIC_STAGE_LABELS[maker.stage === 'rsvp' || maker.stage === 'event' ? maker.stage : 'rsvp']}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-details-look={item}>
      {item === 'reveal' && stages.length > 1 ? (
        <MakerPageSwitch
          label="Play it on"
          value={revealStage ?? 'save_the_date'}
          onChange={(v) => setRevealPick(v as LifecyclePhase)}
          options={REVEAL_STAGE_CHOICES.filter((s) => stages.includes(s)).map((s) => [s, PUBLIC_STAGE_LABELS[s]] as const)}
        />
      ) : null}
      <MakerPageFrame src={src} title={title} device={maker.device} frameKey={frameKey} frameRef={frameRef} />
      <CanvasStaysOnThePage
        frameRef={frameRef}
        pagePath={look.publicLandingUrl}
        resetKey={frameKey}
        stageLabel={title}
        onBack={() => {
          const f = frameRef.current;
          const at = f?.getAttribute('src');
          if (f && at) f.src = at;
        }}
      />
    </div>
  );
}

/** True a few seconds after mount while the pages have still not arrived. */
function useLate(arrived: boolean): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (arrived) {
      setLate(false);
      return;
    }
    const t = window.setTimeout(() => setLate(true), 4000);
    return () => window.clearTimeout(t);
  }, [arrived]);
  return late;
}

function Waiting({ item, late }: { item: LookPageKey; late: boolean }) {
  if (late) return <CouldNotOpen item={item} />;
  return (
    <p role="status" className="m-auto px-4 text-center text-sm text-ink/60" data-details-look-waiting={item}>
      Opening your {WORD[item]}…
    </p>
  );
}

function CouldNotOpen({ item }: { item: LookPageKey }) {
  return (
    <p role="alert" className="m-auto max-w-sm px-4 text-center text-sm text-terracotta-700" data-details-look-failed={item}>
      Your {WORD[item]} could not be opened just now. Nothing was changed — please reopen this in a moment.
    </p>
  );
}
