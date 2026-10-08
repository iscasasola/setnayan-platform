'use client';

import { StageStyle } from './stage-panel/stage-style';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { IntoLowerThird, LOWER_THIRD_TILE, LOWER_THIRD_TILE_ON, LOWER_THIRD_TILE_PART } from './maker-lower-third';
import { MakerPage } from './maker-page';
import { MakerRsvpSettings, type CelebrationInputs } from './maker-rsvp-ask';
import { useMaker } from './maker-context';
import type { RsvpAskConfig, RsvpWordKey } from '@/lib/rsvp-ask';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { draftedCanvasOr } from '@/lib/maker-draft-store';
import {
  RSVP_PREVIEW_EVENT,
  RSVP_REPLY_BY_EVENT,
  RSVP_SCENE_WORDS,
  RSVP_SITE_SOURCE,
  RSVP_STAGE_SCENES,
  RSVP_BRIDGE_SOURCE,
  RSVP_DRAFT_TYPE,
  RSVP_WORD_LABEL,
  isRsvpStageScene,
  rsvpPreviewMessages,
  rsvpStageCanvasSrc,
  rsvpWordBridgeKey,
  type RsvpStageScene,
} from '@/lib/rsvp-stage';
import {
  RSVP_PICK_MESSAGE,
  RSVP_STAGE_ASK_EVENT,
  RSVP_STAGE_BAR_SLOT,
  RSVP_STAGE_SCENE_EVENT,
  RSVP_TOP_MESSAGE,
  RSVP_TYPED_MESSAGE,
  RSVP_TYPE_STOP_MESSAGE,
  RSVP_TYPING_MESSAGE,
  RSVP_WORD_TYPED_EVENT,
} from '@/app/[slug]/_components/rsvp-canvas-parts';
import { SP_KEY_BAR, SP_KEY_DONE } from '@/lib/maker-stage-room';
import { useStagePanelNow } from './stage-panel/store';
import {
  RSVP_CELEBRATE_EVENT,
  RSVP_CELEBRATE_MESSAGE,
  isRsvpCelebration,
  readCelebrationKey,
  type RsvpCelebration,
} from '@/lib/rsvp-celebration';

/**
 * 🧰 THE RSVP'S THREE SCREENS AS THE LOWER THIRD'S PARTS (owner 2026-10-05,
 * frame 6: *"on RSVP there is the RSVP, when yes, when no"*) — the shipped
 * screens (`RSVP_STAGE_SCENES`), each tile titled in his words.
 */
/** 🧩 The parts whose tools ARE this stage's controls — the form and the two notes; nothing picked shows them too. */
function rsvpToolPart(picked: string | null): boolean {
  return picked === null || picked === 'rsvp' || picked === 'yesnote' || picked === 'nonote';
}

const RSVP_STAGE_TILE: Record<RsvpStageScene, { label: string; caption: string }> = {
  /* 📑 The titles the owner approved (2026-10-05): RSVP form · When yes · When
     no. Each caption says what the screen is, never the title again. */
  form: { label: 'RSVP form', caption: 'Their reply' },
  thanks: { label: 'When yes', caption: 'The thank-you' },
  decline: { label: 'When no', caption: 'Can’t come' },
};

/**
 * 🗳 THE RSVP STAGE — the Maker's stage between Save the Date and Invitation
 * (owner 2026-09-30, DECISION_LOG "THE MAKER RE-PLAN…" and "RE-PLAN
 * REVISIONS…"). The Maker's three parts, like every stage:
 *
 *   LEFT   the scenes — 1 RSVP form · 2 When yes · 3 When no;
 *   MIDDLE the REAL guest page for that scene, drawn for a SAMPLE guest in the
 *          canvas (`rsvpStageCanvasSrc` — `?editor=1`, host-verified; no real
 *          guest is read or written);
 *   RIGHT  the scene's controls (`MakerRsvpSettings` with `scene`) — the SAME
 *          component Details' RSVP item draws, so there is one set of controls.
 *
 * ⚡ REALTIME, NEVER A RELOAD (owner 2026-09-30: *"make sure what we rebuild is
 * fast and realtime and changes instantly"*). Every change the panel makes is
 * announced (`RSVP_PREVIEW_EVENT`, `RSVP_REPLY_BY_EVENT`) and posted into the
 * frames here as the editor bridge's messages (`rsvpPreviewMessages`); the
 * page lays it on what it already drew (`rsvp-canvas-bridge.tsx`). A frame is
 * loaded once per scene and KEPT (hidden while another scene shows), so going
 * back to a scene is instant too. A frame that loads later says `rsvpReady`
 * and is sent what the panel holds now.
 *
 * 🧩 IN THE NEW MAKER (Stages, a phone) EVERY PIECE OF A SCREEN IS A PART (owner
 * 2026-10-07/08: *"RSVP cannot select anything"* · *"it is the actual RSVP not
 * an editing way"* · *"no way to access yes and no response"*). The Stages panel
 * (`stage-tools.tsx`) hears a screen's taps and picks the part, frames it and
 * walks it like any stage's; this stage answers what it asks
 * (`RSVP_STAGE_ASK_EVENT`: show a screen · open the picked part's tools), says
 * which screen is on show (`RSVP_STAGE_SCENE_EVENT`), opens a screen its tab
 * picked from the TOP (`rsvpTop`), draws the tools of the part picked, and
 * carries a word typed on the page into the panel's own save (`rsvpType` →
 * `RSVP_WORD_TYPED_EVENT`) under the one "Typing · … Done" bar.
 *
 * Loaded lazily, inside the `maker-details` chunk (`details-lazy.tsx`): the
 * Maker's first load does not carry it.
 */
export function MakerRsvpStage({
  eventId,
  publicLandingUrl,
  solemn,
  current,
  drafted,
  replyBy,
  replyByOwn,
  replyByFallback,
  frameSrc,
  draftAction,
  replyByAction,
  celebration,
}: {
  /**
   * 🎉 The When yes Celebration's inputs, measured by the launch page — Event
   * Hub Pro (its ◆ marks) and the Mood Board's colours (its previews) — handed
   * through to the panel, which draws the mark (`CelebrationPick`).
   */
  celebration?: CelebrationInputs;
  /** The dev lab only (`/dev/rsvp-stage-lab`): its own frames and saves, to measure the stage without a sign-in. */
  frameSrc?: (scene: RsvpStageScene) => string | null;
  draftAction?: ComponentProps<typeof MakerRsvpSettings>['draftAction'];
  replyByAction?: ComponentProps<typeof MakerRsvpSettings>['replyByAction'];
  eventId: string;
  /** `/<slug>`, or null before the event has an address. */
  publicLandingUrl: string | null;
  solemn: boolean;
  current: RsvpAskConfig;
  drafted: boolean;
  replyBy: { date: string; isDefault: boolean } | null;
  replyByOwn: { deadline: string | null; pricingMode: 'realtime' | 'final_only' } | null;
  replyByFallback: string | null;
}) {
  const maker = useMaker();
  const [scene, setScene] = useState<RsvpStageScene>('form');
  /* 📱 The screen's controls, opened by its tile in the lower third. */
  const [controlsOpen, setControlsOpen] = useState(false);
  /* ⌨ The word being typed on the page now (its `rsvp:<key>`), or null. */
  const [typingWord, setTypingWord] = useState<string | null>(null);
  /* 🧭 The new Maker (Stages, a phone): the part picked there, and whether this stage is its. */
  const pickedPart = useStagePanelNow().picked;
  const stagesNow = useRef(false);
  stagesNow.current = maker?.stagesStudio === true;
  /* "Where you are" says the screen on show. */
  const setLtWhere = maker?.setLtWhere;
  useEffect(() => {
    setLtWhere?.(RSVP_STAGE_TILE[scene].label);
  }, [setLtWhere, scene]);
  useEffect(() => () => setLtWhere?.(null), [setLtWhere]);
  /* Each scene's frame is loaded the first time it is shown, then kept. */
  const [opened, setOpened] = useState<ReadonlySet<RsvpStageScene>>(() => new Set(['form']));
  const frames = useRef<Partial<Record<RsvpStageScene, HTMLIFrameElement | null>>>({});
  /* What the panel holds now — sent to a frame that (re)loads after an edit. */
  const latest = useRef<RsvpAskConfig | null>(null);
  /* …starting from the Maker's own copy when this visit's edits are newer than
     the last render (`maker-draft-store.ts`) — a frame then shows them too. */
  if (latest.current === null) {
    const own = draftedCanvasOr(RSVP_DRAFT_TYPE, current as HubSectionCanvas) as RsvpAskConfig;
    if (own !== (current as unknown)) latest.current = own;
  }
  const replyLine = useRef<string | null>(null);

  const post = useCallback(
    (frame: HTMLIFrameElement | null | undefined) => {
      const win = frame?.contentWindow;
      if (!win) return;
      const origin = window.location.origin;
      if (latest.current) for (const m of rsvpPreviewMessages(latest.current, solemn)) win.postMessage(m, origin);
      if (replyLine.current !== null) {
        win.postMessage({ source: RSVP_BRIDGE_SOURCE, t: 'words', key: rsvpWordBridgeKey('reply-by'), text: replyLine.current }, origin);
      }
    },
    [solemn],
  );
  const postAll = useCallback(() => {
    for (const f of Object.values(frames.current)) post(f);
  }, [post]);

  /* 🎉 THE WHEN YES CELEBRATION, PLAYED ON THE PAGE (owner 2026-10-06): a pick
     in Celebration ▾, "Play it again", or opening the When yes scene asks the
     thank-you frame to play the pick once (`when-yes-celebration.tsx`). */
  const serverConfig = useRef(current);
  serverConfig.current = current;
  const celebrate = useCallback((kind?: RsvpCelebration) => {
    const win = frames.current.thanks?.contentWindow;
    if (!win) return;
    const pick = kind ?? readCelebrationKey(latest.current ?? serverConfig.current);
    win.postMessage({ source: RSVP_BRIDGE_SOURCE, t: RSVP_CELEBRATE_MESSAGE, kind: pick }, window.location.origin);
  }, []);
  const sceneNow = useRef<RsvpStageScene>('form');
  const readyPlayed = useRef(new WeakSet<HTMLIFrameElement>());

  /* A word tapped on the canvas: its scene, then its box. */
  const openWordField = useCallback((bridgeKey: string) => {
    const key = bridgeKey.replace(/^rsvp:/, '') as RsvpWordKey | 'reply-by';
    const owner = (Object.keys(RSVP_SCENE_WORDS) as RsvpStageScene[]).find((s) =>
      (RSVP_SCENE_WORDS[s] as readonly string[]).includes(key),
    );
    if (owner) setScene(owner);
    setControlsOpen(true);
    window.setTimeout(() => {
      const box =
        key === 'reply-by'
          ? document.querySelector<HTMLElement>('[data-rsvp-stage-controls] [data-reply-by-field] input')
          : document.querySelector<HTMLElement>(`[data-rsvp-word-field="${key}"] input, [data-rsvp-word-field="${key}"] textarea`);
      box?.focus();
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }, []);

  useEffect(() => {
    const onPreview = (e: Event) => {
      latest.current = (e as CustomEvent<RsvpAskConfig>).detail;
      postAll();
    };
    const onReplyBy = (e: Event) => {
      replyLine.current = (e as CustomEvent<{ line: string }>).detail?.line ?? '';
      postAll();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; t?: string; key?: unknown } | null;
      if (!d || d.source !== RSVP_SITE_SOURCE) return;
      const from = Object.values(frames.current).find((f) => f?.contentWindow === e.source);
      if (!from) return;
      if (d.t === 'rsvpReady') {
        post(from);
        /* The When yes frame plays its pick the FIRST time it is ready — a later
           reload of the same frame (a Maker refresh) does not replay it. */
        if (from === frames.current.thanks && sceneNow.current === 'thanks' && !readyPlayed.current.has(from)) {
          readyPlayed.current.add(from);
          celebrate();
        }
      }
      /* 🧩 A tap on a screen. In the new Maker the Stages panel picks the part (`stage-tools.tsx`); everywhere else
         a tapped WORD brings its box up, as it always has. */
      if (d.t === RSVP_PICK_MESSAGE && !stagesNow.current) {
        const word = (d as { word?: unknown }).word;
        if (typeof word === 'string') openWordField(word);
      }
      /* ⌨ Typed on the page: the panel's own save takes it (one value, two doors), and the one bar says so. */
      if (d.t === RSVP_TYPED_MESSAGE && typeof d.key === 'string') {
        const text = (d as { text?: unknown }).text;
        if (typeof text === 'string') {
          window.dispatchEvent(new CustomEvent(RSVP_WORD_TYPED_EVENT, { detail: { key: d.key.replace(/^rsvp:/, ''), text } }));
        }
      }
      if (d.t === RSVP_TYPING_MESSAGE) {
        const m = d as { phase?: unknown; word?: unknown };
        setTypingWord(m.phase === 'start' && typeof m.word === 'string' ? m.word : null);
      }
    };
    const onCelebrate = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: unknown }>).detail?.kind;
      if (isRsvpCelebration(kind)) celebrate(kind);
    };
    window.addEventListener(RSVP_PREVIEW_EVENT, onPreview);
    window.addEventListener(RSVP_REPLY_BY_EVENT, onReplyBy);
    window.addEventListener(RSVP_CELEBRATE_EVENT, onCelebrate);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener(RSVP_PREVIEW_EVENT, onPreview);
      window.removeEventListener(RSVP_REPLY_BY_EVENT, onReplyBy);
      window.removeEventListener(RSVP_CELEBRATE_EVENT, onCelebrate);
      window.removeEventListener('message', onMessage);
    };
  }, [post, postAll, openWordField, celebrate]);

  /* Opening the When yes scene plays its pick (a frame already loaded; a new
     one plays on its `rsvpReady`, above). */
  useEffect(() => {
    sceneNow.current = scene;
    if (scene === 'thanks') celebrate();
  }, [scene, celebrate]);

  const pick = useCallback((next: RsvpStageScene) => {
    setScene(next);
    setOpened((o) => (o.has(next) ? o : new Set([...o, next])));
  }, []);

  /* 🧭 What the Stages panel asks: show a screen · open (or fold) the picked part's tools. */
  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent<{ scene?: unknown; controls?: unknown }>).detail;
      if (isRsvpStageScene(d?.scene)) pick(d.scene);
      if (typeof d?.controls === 'boolean') setControlsOpen(d.controls);
    };
    window.addEventListener(RSVP_STAGE_ASK_EVENT, onAsk);
    return () => window.removeEventListener(RSVP_STAGE_ASK_EVENT, onAsk);
  }, [pick]);

  /* 🔝 THE SCREEN ON SHOW IS SAID, AND A SCREEN JUST OPENED STARTS AT ITS TOP — the two things every Stages tab
     keeps (`hub-tab-dom.ts`): the panel's label follows what is on screen, and a kept frame that was left
     scrolled is put back to its top and held there until the couple moves it (`rsvpTop`, the bridge's
     `createRsvpCanvasTop`). A frame loading for the first time starts at its top by itself. */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(RSVP_STAGE_SCENE_EVENT, { detail: scene }));
    frames.current[scene]?.contentWindow?.postMessage({ source: RSVP_BRIDGE_SOURCE, t: RSVP_TOP_MESSAGE }, window.location.origin);
  }, [scene]);

  /* ⌨ Done: the words are left (the page says so back — `rsvpTyping` end). */
  const doneTyping = useCallback(() => {
    for (const f of Object.values(frames.current)) {
      f?.contentWindow?.postMessage({ source: RSVP_BRIDGE_SOURCE, t: RSVP_TYPE_STOP_MESSAGE }, window.location.origin);
    }
    setTypingWord(null);
  }, []);
  /* The bar rides on the keyboard (the visual viewport's foot), as the shipped typing bar does. */
  const [keysTop, setKeysTop] = useState(0);
  useEffect(() => {
    if (!typingWord) return;
    const vv = window.visualViewport;
    const read = () => setKeysTop(Math.max(0, window.innerHeight - ((vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight))));
    read();
    vv?.addEventListener('resize', read);
    vv?.addEventListener('scroll', read);
    return () => {
      vv?.removeEventListener('resize', read);
      vv?.removeEventListener('scroll', read);
    };
  }, [typingWord]);

  const phone = maker ? maker.device !== 'desktop' : false;
  /* The new Maker is a phone's only (`maker-shell.tsx` `ss`). */
  const stagesRsvp = maker?.stagesStudio === true;
  const sceneMeta = RSVP_STAGE_SCENES.find((s) => s.key === scene)!;

  const page = publicLandingUrl ? (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row" data-rsvp-stage-body="">
      {/* LEFT — the scenes (a list on a wide screen, one picker on a phone). */}
      <nav aria-label="RSVP scenes" className="hidden w-56 shrink-0 flex-col gap-1 border-r border-ink/10 p-3 lg:flex" data-rsvp-stage-scenes="">
        {RSVP_STAGE_SCENES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={scene === s.key}
            data-rsvp-stage-scene={s.key}
            onClick={() => pick(s.key)}
            className={`sn-press flex min-h-11 items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-sn-control ease-sn ${
              scene === s.key ? 'bg-white shadow-sm' : 'hover:bg-ink/5'
            }`}
          >
            <span className="mt-0.5 font-mono text-[11px] text-ink/50">{i + 1}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-ink">{s.label}</span>
              <span className="text-[12px] leading-snug text-ink/60">{s.sub}</span>
            </span>
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* 📱 The three screens are the lower third's tiles; a tile opens its controls there. */}
        {maker?.ltNav ? (
          <IntoLowerThird to={maker.ltNav}>
            {RSVP_STAGE_SCENES.map((s) => (
              <button
                key={s.key}
                type="button"
                data-lt-tile={`rsvp:${s.key}`}
                data-lt-group="rsvp"
                data-rsvp-stage-scene-tile={s.key}
                aria-pressed={scene === s.key}
                onClick={() => {
                  pick(s.key);
                  setControlsOpen(true);
                }}
                className={`${LOWER_THIRD_TILE} ${LOWER_THIRD_TILE_PART} ${scene === s.key ? LOWER_THIRD_TILE_ON : ''}`}
              >
                <span className="flex min-h-0 flex-1 items-center justify-center px-1.5 text-center text-[12.5px] font-semibold leading-tight text-ink">
                  {RSVP_STAGE_TILE[s.key].label}
                </span>
                <span className="block w-full truncate border-t border-ink/10 px-1 py-1.5 text-center text-[11.5px] text-ink/65">
                  {RSVP_STAGE_TILE[s.key].caption}
                </span>
              </button>
            ))}
          </IntoLowerThird>
        ) : null}
        {/* MIDDLE — the guest's page, one frame per scene visited, kept. */}
        <div className="relative flex min-h-0 flex-1 items-stretch justify-center px-2 py-2 lg:px-6 lg:pb-5 lg:pt-4">
          {RSVP_STAGE_SCENES.filter((s) => opened.has(s.key)).map((s) => (
            <iframe
              key={s.key}
              ref={(el) => {
                frames.current[s.key] = el;
              }}
              src={(frameSrc ? frameSrc(s.key) : rsvpStageCanvasSrc(publicLandingUrl, s.key)) ?? undefined}
              title={`${s.label} — as a guest sees it`}
              data-rsvp-stage-frame={s.key}
              onLoad={(e) => post(e.currentTarget)}
              hidden={scene !== s.key}
              className={`min-h-0 w-full flex-1 rounded-md border-0 bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)] ${
                phone ? 'max-w-[430px]' : 'max-w-none'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  ) : (
    <p className="m-auto max-w-sm px-4 text-center text-sm text-ink/70" data-maker-page-no-address="">
      Set your Event Hub address in Event Details to see your RSVP here.
    </p>
  );

  const typingKey = typingWord ? typingWord.replace(/^rsvp:/, '') : null;
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col" data-rsvp-stage={scene}>
      {/* ⌨ THE ONE BAR WHILE WORDS ARE TYPED ON THE PAGE — "Typing · Heading" and Done, which brings the panel
          back (the shipped typing bar's own words and look, `type-in-place.tsx`). */}
      {typingKey && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="toolbar"
              aria-label={`${RSVP_WORD_LABEL[typingKey as RsvpWordKey] ?? 'Words'} — words`}
              data-type-bar="rsvp"
              data-type-bar-keys=""
              style={{ bottom: keysTop }}
              className={`fixed inset-x-0 z-[85] ${SP_KEY_BAR}`}
            >
              <span className="min-w-0 truncate">Typing · {RSVP_WORD_LABEL[typingKey as RsvpWordKey] ?? 'Words'}</span>
              <button type="button" onClick={doneTyping} data-type-done="" className={SP_KEY_DONE}>
                <span className="inline-flex h-8 items-center rounded-full bg-[#2C2A29] px-4 text-[13px] font-semibold text-white">Done</span>
              </button>
            </div>,
            document.body,
          )
        : null}
      <MakerPage
        pageKey="rsvp-page"
        open={controlsOpen}
        onOpenChange={setControlsOpen}
        toolName={RSVP_STAGE_TILE[scene].label}
        page={
          /* 🧭 THE SCREENS, THEN THE STAGES TAB ROW — two children of the page's one flex column (`MakerPage`'s
             body), in this order: the screens take what is left ABOVE the row, at every height of the lower third.
             The row itself is the Stages panel's (`stage-tools.tsx` draws it into this slot); outside the new
             Maker the slot is empty and takes no room. Never an overlay: this layer covers the work area, so a row
             drawn over the work area's foot was under it, out of a finger's reach (measured 08 Oct). */
          <>
            {page}
            <div {...{ [RSVP_STAGE_BAR_SLOT]: '' }} className="shrink-0 lg:hidden" />
          </>
        }
        controls={
          stagesRsvp ? (
            /* 🧭 THE NEW MAKER'S RSVP STAGE (phone): the screen's controls are its Style › Look, under the same quiet
               bar ("Edit the RSVP · Studio ›") as every part (DECISION_LOG 2026-10-07). */
            <div className="-mx-3 -mb-6 -mt-2 flex min-h-0 flex-1 flex-col">
              <StageStyle
                look={
                  /* 🧩 The tools are the PICKED part's: the form's and the two notes' are these controls; any other
                     part (the mark, the names, the date, each guest's own name and ticket) has its one door above
                     (`QuietBar`) and nothing here. Kept mounted either way — a word typed on the page is its save.
                     (A class, not `hidden`: `flex` would out-rank the attribute.) */
                  <div className={`flex-col gap-3 pb-4 ${rsvpToolPart(pickedPart) ? 'flex' : 'hidden'}`} data-rsvp-stage-look="">
                    <MakerRsvpSettings
                      eventId={eventId}
                      current={current}
                      drafted={drafted}
                      replyBy={replyBy}
                      replyByOwn={replyByOwn}
                      requests={{ count: null, list: null }}
                      scene={scene}
                      solemn={solemn}
                      replyByFallback={replyByFallback}
                      draftAction={draftAction}
                      replyByAction={replyByAction}
                      celebration={celebration ? { ...celebration, storeShell: maker?.storeShell ?? false } : undefined}
                    />
                  </div>
                }
                background={null}
                arrange={null}
              />
            </div>
          ) : (
          <>
            {/* The desktop's title — on a phone the lower third's column names the screen. */}
            <p className="hidden px-1 text-[13px] font-semibold text-ink/70 lg:block" data-rsvp-stage-scene-title="">
              Scene {RSVP_STAGE_SCENES.indexOf(sceneMeta) + 1} · {sceneMeta.label}
            </p>
            <MakerRsvpSettings
              eventId={eventId}
              current={current}
              drafted={drafted}
              replyBy={replyBy}
              replyByOwn={replyByOwn}
              requests={{ count: null, list: null }}
              scene={scene}
              solemn={solemn}
              replyByFallback={replyByFallback}
              draftAction={draftAction}
              replyByAction={replyByAction}
              celebration={celebration ? { ...celebration, storeShell: maker?.storeShell ?? false } : undefined}
            />
          </>
          )
        }
      />
    </div>
  );
}
