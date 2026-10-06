'use client';

import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { HUB_FONT_FACES, hubFontBoldWeight } from '@/lib/hub-fonts';
import { FontPick } from './font-pick';
import {
  HUB_EL_DELAY,
  HUB_EL_DELAY_LABEL,
  HUB_EL_DURING_LABEL,
  HUB_EL_DURING_WORDS,
  HUB_EL_TIMELINE,
  HUB_EL_TIMELINE_LABEL,
  HUB_ELEMENT_ALIGNS,
  HUB_ELEMENT_ALIGN_LABEL,
  HUB_ELEMENT_FIELDS,
  HUB_ELEMENT_LABEL,
  HUB_ELEMENT_WEIGHTS,
  HUB_ELEMENT_WEIGHT_LABEL,
  HUB_JOINER_MAX,
  HUB_JOINER_WORDS,
  HUB_PART_LINE_MAX,
  HUB_PART_WORDS_HINT,
  hasTextStyle,
  hubSpacingLabel,
  sanitizeHubJoinerWord,
  sanitizeHubElementWord,
  HUB_PART_SENTENCE_MAX,
  stepHubElementSize,
  stepHubSpacing,
  type HubElementAlign,
  type HubElementChoiceValue,
  type HubElementField,
  type HubElementKey,
  type HubElementMotion,
  type HubElementStyle,
} from '@/lib/element-style';
import { ColourWell } from './colour-well';
import { IButton, IHint, IReset, IRow, ISection, ISeg, ISegmented, IStepper } from './inspector-kit';
import { PickMenu } from './pick-menu';
import { MotionFxRows, MotionSpeedRow } from './motion-fx-rows';
import { motionFxOn, type MotionFx } from '@/lib/motion-effects';

/**
 * 🔤 THE PART INSPECTOR'S TABS — Pages' Text inspector for one part, with
 * Keynote's Animate beside it (owner 2026-09-27: *"Toolbars needs to be
 * redesigned. something like how page fix their toolbar so the toolbar is
 * familiar"*; approved prototype frame B).
 *
 *   Part ▾   the part picker at the top, like Pages' "Body ▾"
 *   TEXT     Joiner (its word) · Font ▾ · Weight · Size − / + · B I U · Colour
 *            (split well + panel, the "Hard to read" warning under it) ·
 *            Alignment · Line · Letter · ↺ Use the Event Hub style
 *   ANIMATE  Plays once / Follows the scroll · In ▾ · During · Out · Duration ·
 *            Delay · ▶ Preview · ↺ Move with the scene
 *   ARRANGE  Show: Shown · Hidden · Where it sits (rails on)
 *
 * 💎 FREE VS PRO (owner 2026-09-28, *"free to change design, change text,
 * size, color, background color, only when you start adding themes will it be
 * pro"*): every Text row is free EXCEPT Font ▾, and the Animate tab is Pro —
 * `HUB_ELEMENT_PRO_FIELDS` in `lib/hub-look-pro.ts` is the one list, and these
 * two are the only rows that wear the mark (`fontMark` · `proMark` — drawn by
 * the sheet, which is where the couple's `ownsPro` is read).
 *
 * These are the ROWS only — the sheet (`element-sheet.tsx`) owns the saving,
 * the instant preview and the one-letter selection, and hands each row the
 * choice to make. Every row here moves pixels: a row the part cannot take
 * (`HUB_ELEMENT_FIELDS`) is not drawn.
 */

export type PartTab = 'text' | 'animate' | 'arrange';
export const PART_TABS: ReadonlyArray<{ key: PartTab; label: string }> = [
  { key: 'text', label: 'Text' },
  { key: 'animate', label: 'Motion' },
  { key: 'arrange', label: 'Arrange' },
];

/** Part ▾ — every part of this scene, in its order. */
export function PartPicker({
  parts,
  value,
  onPick,
}: {
  parts: readonly HubElementKey[];
  value: HubElementKey;
  onPick: (el: HubElementKey) => void;
}) {
  return (
    <IRow label="Part" data="part">
      <PickMenu
        label="Which part"
        dataAttr="data-part-pick"
        value={value}
        options={parts.map((k) => ({ key: k, label: HUB_ELEMENT_LABEL[k] }))}
        onPick={(k) => onPick(k as HubElementKey)}
        className="min-h-11 min-w-0 flex-1 lg:min-h-9"
      />
    </IRow>
  );
}

export type PartFace = Pick<HubElementStyle, 'font' | 'color' | 'size'> & HubElementStyle;

export function PartTextTab({
  el,
  face,
  style,
  onRange,
  choose,
  chooseAlign,
  resetText,
  themeColours,
  usedColours,
  shownColour,
  contrast,
  eventId,
  onPreviewColour,
  fontMark = null,
  hideFont = false,
  threeControls = false,
}: {
  /**
   * 🔤 THE NEW MAKER'S TEXT TOOL (`makerStagesStudioEnabled`): exactly Font ·
   * Colour · Size (`MAKER_PART_TEXT_TOOLS`, `lib/maker-parts.ts`) — owner
   * 2026-10-06 *"no"* to Weight, Bold/Italic/Underline, line and letter
   * spacing (DECISION_LOG "TEXT STYLING STAYS THREE CONTROLS"). The words are
   * typed on the page, and Alignment is Style › Arrange's. False — every couple
   * today — draws every shipped row.
   */
  threeControls?: boolean;
  /** 💎 Font ▾ is Event Hub Pro — its `<PaidMark>`, or null (none to draw). */
  fontMark?: ReactNode;
  /** The store shell, not owned: a Pro row is hidden, never shown locked. */
  hideFont?: boolean;
  el: HubElementKey;
  /** What the rows show: a selected run's own font · colour · size, or the part's. */
  face: PartFace;
  /** The whole part's style (weight, spacing … are never per-run). */
  style: HubElementStyle;
  /** True while the rows style a selection inside the part (a run). */
  onRange: boolean;
  choose: (field: Exclude<HubElementField, 'motion'>, value: HubElementChoiceValue) => void;
  chooseAlign: (value: HubElementAlign | null) => void;
  resetText: () => void;
  themeColours: readonly string[];
  usedColours: readonly string[];
  /** The colour the words wear now (the theme's), for the well while none is chosen. */
  shownColour: string;
  contrast: { ratio: number; ok: boolean } | null;
  eventId: string;
  onPreviewColour?: (hex: string) => void;
}) {
  const fields = HUB_ELEMENT_FIELDS[el];
  const has = (f: HubElementField) =>
    fields.includes(f) && (!onRange || f === 'font' || f === 'color' || f === 'size') && (!threeControls || f === 'font' || f === 'color' || f === 'size');
  const faceInfo = face.font ? HUB_FONT_FACES[face.font] : null;
  const weights = faceInfo ? HUB_ELEMENT_WEIGHTS.filter((w) => faceInfo.weights.includes(w)) : [];
  const bold = face.font ? hubFontBoldWeight(face.font) : 700;
  const italicOk = faceInfo ? faceInfo.italic : true;
  const down = stepHubElementSize(face.size, -1, el);
  const up = stepHubElementSize(face.size, 1, el);
  const leadDown = stepHubSpacing('leading', style.leading, -1, el);
  const leadUp = stepHubSpacing('leading', style.leading, 1, el);
  const trackDown = stepHubSpacing('tracking', style.tracking, -1, el);
  const trackUp = stepHubSpacing('tracking', style.tracking, 1, el);

  return (
    <div data-part-tab="text">
      {has('word') && el === 'joiner' ? <JoinerRow word={style.word ?? null} onWord={(w) => choose('word', w)} /> : null}
      {has('word') && el !== 'joiner' ? (
        <PartWordsRow el={el} word={style.word ?? null} hint={HUB_PART_WORDS_HINT[el] ?? ''} onWord={(w) => choose('word', w)} />
      ) : null}

      {has('font') && !hideFont ? (
        <IRow
          label={
            fontMark ? (
              <span className="inline-flex items-center gap-1">
                Font
                {fontMark}
              </span>
            ) : (
              'Font'
            )
          }
          data="font"
        >
          {/* 🔤 The one font dropdown (owner 2026-09-29) — Recently used ·
              Most used · All fonts, "In use" marked; `font-pick.tsx`. */}
          <FontPick
            eventId={eventId}
            label="Font"
            dataAttr="data-element-font"
            value={face.font ?? null}
            lead="Event Hub font"
            onPick={(key) => choose('font', key)}
            className="min-h-11 min-w-0 flex-1 lg:min-h-9"
          />
        </IRow>
      ) : null}

      {/* Weight only where the face has more than one loaded ("pick a script
          face and Weight disappears"). */}
      {has('weight') && weights.length > 1 ? (
        <IRow label="Weight" data="weight">
          <ISegmented label="Weight">
            {weights.map((w) => (
              <ISeg key={w} on={style.weight === w} onClick={() => choose('weight', style.weight === w ? null : w)}>
                {HUB_ELEMENT_WEIGHT_LABEL[w]}
              </ISeg>
            ))}
          </ISegmented>
        </IRow>
      ) : null}

      {has('size') ? (
        <IRow label="Size" wrap data="size">
          {/* − / + ONLY, no number (owner, answer 3: "-+ only"). Rails on. */}
          <IStepper
            label="Size"
            data="size"
            canDown={down !== false}
            canUp={up !== false}
            onDown={() => down !== false && choose('size', down ?? 100)}
            onUp={() => up !== false && choose('size', up ?? 100)}
          />
          {has('weight') || has('italic') || has('underline') ? (
            <span className="ml-auto">
              <ISegmented label="Bold, italic, underline" grow={false}>
                {has('weight') && bold ? (
                  <ISeg
                    on={style.weight === bold}
                    onClick={() => choose('weight', style.weight === bold ? null : bold)}
                    title="Bold"
                    data="bold"
                    className="w-11 flex-none font-serif font-extrabold lg:w-9"
                  >
                    B
                  </ISeg>
                ) : null}
                {has('italic') && italicOk ? (
                  <ISeg on={Boolean(style.italic)} onClick={() => choose('italic', style.italic ? null : true)} title="Italic" data="italic" className="w-11 flex-none font-serif italic lg:w-9">
                    I
                  </ISeg>
                ) : null}
                {has('underline') ? (
                  <ISeg on={Boolean(style.underline)} onClick={() => choose('underline', style.underline ? null : true)} title="Underline" data="underline" className="w-11 flex-none font-serif underline lg:w-9">
                    U
                  </ISeg>
                ) : null}
              </ISegmented>
            </span>
          ) : null}
        </IRow>
      ) : null}

      {has('color') ? (
        <>
          <IRow label="Colour" data="color">
            <ColourWell
              value={face.color ?? null}
              shown={shownColour}
              what={`the ${HUB_ELEMENT_LABEL[el].toLowerCase()}`}
              themeColours={themeColours}
              usedColours={usedColours}
              savedKey={`sn-maker-colours:${eventId}`}
              alpha
              onPreview={onPreviewColour}
              onPick={(hex) => choose('color', hex)}
              data="element"
            />
          </IRow>
          {contrast && !contrast.ok ? (
            <p className="flex flex-wrap items-center gap-1 py-1.5 text-[12px] font-semibold text-terracotta-700" role="status" data-element-contrast="low">
              Hard to read here · {contrast.ratio.toFixed(1)}:1
              <InfoTip label="" ariaLabel="Why it is hard to read" align="center">
                Guests need about 4.5:1 to read it easily. You can keep it.
              </InfoTip>
            </p>
          ) : null}
        </>
      ) : null}

      {has('align') ? (
        <IRow label="Alignment" data="align">
          {/* ONE dropdown (owner 2026-10-02: "any set of choices is a dropdown"; it was a pill row). */}
          <PickMenu
            label="Alignment"
            dataAttr="data-part-align-pick"
            value={style.align ?? 'auto'}
            options={[
              { key: 'auto', label: 'As the scene' },
              ...HUB_ELEMENT_ALIGNS.map((a) => {
                const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                return { key: a, label: HUB_ELEMENT_ALIGN_LABEL[a], icon: <Icon aria-hidden className="h-4 w-4" strokeWidth={2} /> };
              }),
            ]}
            onPick={(k) => chooseAlign(k === 'auto' ? null : (k as (typeof HUB_ELEMENT_ALIGNS)[number]))}
          />
        </IRow>
      ) : null}

      {has('leading') ? (
        <IRow label="Line" data="spacing">
          {has('leading') ? (
            <IStepper
              label="Line spacing"
              data="leading"
              value={hubSpacingLabel('leading', style.leading)}
              canDown={leadDown !== false}
              canUp={leadUp !== false}
              onDown={() => leadDown !== false && choose('leading', leadDown)}
              onUp={() => leadUp !== false && choose('leading', leadUp)}
            />
          ) : null}
        </IRow>
      ) : null}
      {has('tracking') ? (
        <IRow label="Letter" data="letter">
          {has('tracking') ? (
            <>
              <IStepper
                label="Letter spacing"
                data="tracking"
                value={hubSpacingLabel('tracking', style.tracking)}
                canDown={trackDown !== false}
                canUp={trackUp !== false}
                onDown={() => trackDown !== false && choose('tracking', trackDown)}
                onUp={() => trackUp !== false && choose('tracking', trackUp)}
              />
            </>
          ) : null}
        </IRow>
      ) : null}

      {!onRange && hasTextStyle(style) ? (
        <div className="py-1.5">
          <IReset onClick={resetText} data="text">
            Use the Event Hub style
          </IReset>
        </div>
      ) : null}
    </div>
  );
}

/**
 * ⌨ TYPING SAVES — THERE IS NO "USE IT" BUTTON (owner, live phone test
 * 2026-10-02: a "Use it" button sat greyed out while the words had already
 * saved — words typed on the canvas save themselves, so the box beside them was
 * always "unchanged" and its button always dead). Every Maker word box saves
 * the way the canvas does: a short pause, leaving the box, or Enter. The value
 * the page hands back never overwrites the box while the couple is typing in it.
 */
const TYPING_PAUSE_MS = 700;
function useSavesAsYouType<T>(
  saved: T,
  textOf: (v: T) => string,
  /** The text as it would be saved, or `undefined` when it cannot be (yet). */
  read: (text: string) => T | undefined,
  onSave: (v: T) => void,
) {
  const [text, setText] = useState(() => textOf(saved));
  const typing = useRef(false);
  useEffect(() => {
    if (!typing.current) setText(textOf(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the saved value
  }, [saved]);
  const latest = useRef({ saved, read, onSave });
  latest.current = { saved, read, onSave };
  const commit = (t: string) => {
    const next = latest.current.read(t);
    if (next !== undefined && next !== latest.current.saved) latest.current.onSave(next);
  };
  useEffect(() => {
    if (!typing.current) return;
    const id = window.setTimeout(() => commit(text), TYPING_PAUSE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a pause after the last keystroke
  }, [text]);
  return {
    value: text,
    onChange: (e: { target: { value: string } }) => {
      typing.current = true;
      setText(e.target.value);
    },
    onBlur: () => {
      typing.current = false;
      commit(text);
    },
    onEnter: () => commit(text),
  };
}

/** 🔗 The Joiner's word — and · & · + · Your own… (answer 2). */
function JoinerRow({ word, onWord }: { word: string | null; onWord: (w: string | null) => void }) {
  const own = word !== null && !(HUB_JOINER_WORDS as readonly string[]).includes(word);
  const [typing, setTyping] = useState(own);
  useEffect(() => {
    setTyping(word !== null && !(HUB_JOINER_WORDS as readonly string[]).includes(word));
  }, [word]);
  // Their own word saves as they type; a box still empty saves nothing (the picked word stays).
  const box = useSavesAsYouType<string | null>(
    own ? word : null,
    (v) => v ?? '',
    (t) => sanitizeHubJoinerWord(t) ?? undefined,
    onWord,
  );
  return (
    <>
      <IRow label="Joiner" data="joiner">
        {/* ONE dropdown (owner 2026-10-02: "any set of choices is a dropdown"; it was a pill row). */}
        <PickMenu
          label="The word between the names"
          dataAttr="data-part-joiner-pick"
          value={typing ? 'own' : (word ?? 'and')}
          options={[...HUB_JOINER_WORDS.map((w) => ({ key: w as string, label: w as string })), { key: 'own', label: 'Your own…' }]}
          onPick={(k) => {
            if (k === 'own') {
              setTyping(true);
              return;
            }
            setTyping(false);
            onWord(k === 'and' && word === null ? null : k);
          }}
        />
      </IRow>
      {typing ? (
        <form
          className="flex items-center gap-2 border-b border-ink/[0.07] py-2.5"
          data-saves-as-you-type=""
          onSubmit={(e) => {
            e.preventDefault();
            box.onEnter();
          }}
        >
          <label className="sr-only" htmlFor="joiner-own-word">
            Your own word between the names
          </label>
          <input
            id="joiner-own-word"
            value={box.value}
            maxLength={HUB_JOINER_MAX}
            onChange={box.onChange}
            onBlur={box.onBlur}
            enterKeyHint="done"
            placeholder="at saka"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink lg:min-h-9 lg:text-[14px]"
          />
        </form>
      ) : null}
    </>
  );
}

/**
 * 🔗 A part's own line — the link's, the photo caption's. `hint` is what the
 * part draws while it is empty. Cleared, it goes back to that (an absence, the
 * joiner's rule); taking the part off the page is Arrange → Hidden. Typing
 * saves (`useSavesAsYouType`) — no button.
 */
function PartWordsRow({ el, word, hint, onWord }: { el: HubElementKey; word: string | null; hint: string; onWord: (w: string | null) => void }) {
  // The part's own rule — a line (the link, the caption) or a sentence (the eyebrow, the invitation line).
  const box = useSavesAsYouType<string | null>(
    word,
    (v) => v ?? '',
    (t) => (t.trim().length === 0 ? null : (sanitizeHubElementWord(t, el) ?? undefined)),
    onWord,
  );
  return (
    <form
      className="flex items-center gap-2 border-b border-ink/[0.07] py-2.5"
      data-row="part-words"
      data-saves-as-you-type=""
      onSubmit={(e) => {
        e.preventDefault();
        box.onEnter();
      }}
    >
      <label className="sr-only" htmlFor="part-own-words">
        Words
      </label>
      <input
        id="part-own-words"
        value={box.value}
        maxLength={el === 'eyebrow' || el === 'line' ? HUB_PART_SENTENCE_MAX : HUB_PART_LINE_MAX}
        onChange={box.onChange}
        onBlur={box.onBlur}
        enterKeyHint="done"
        placeholder={hint}
        className="min-h-11 min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink lg:min-h-9 lg:text-[14px]"
      />
    </form>
  );
}

export function PartAnimateTab({
  motion,
  moveTo,
  onPreview,
  resetMotion,
  proMark = null,
  buildWords = false,
}: {
  /**
   * 🎬 The new Maker (`makerStagesStudioEnabled`) names the three steps as the
   * owner did — Build in · Action · Build out (`MAKER_PART_ANIMATE_STEPS`). The
   * rows under each are the same.
   */
  buildWords?: boolean;
  /** 💎 How a part moves is Event Hub Pro — its `<PaidMark>`, or null (none to draw). */
  proMark?: ReactNode;
  motion: HubElementMotion;
  moveTo: (part: keyof HubElementMotion, value: string | MotionFx | null) => void;
  /** ▶ Preview — replay the part's In on the canvas. */
  onPreview?: () => void;
  resetMotion: (() => void) | null;
}) {
  /* 🎛 IN THE ORDER A GUEST SEES IT (owner 2026-10-04): 1 Comes in → 2 While on
     screen → 3 Goes out → 4 When it plays. Each effect's details sit under it
     and show only once it is on, so a fresh part opens short: four None rows,
     During and When it plays. */
  const scroll = motion.timeline === 'scroll';
  const inOn = motionFxOn(motion.in);
  const outOn = motionFxOn(motion.out);
  const row = 'min-h-11 min-w-0 flex-1 lg:min-h-9';
  return (
    <div data-part-tab="animate">
      {proMark ? (
        <p className="pt-2.5" data-part-animate-pro="">
          {proMark}
        </p>
      ) : null}
      <div data-motion-step="in">
        <ISection>{buildWords ? 'Build in' : 'Comes in'}</ISection>
        <MotionFxRows end="in" fx={motion.in} onChange={(fx) => moveTo('in', fx)} />
        {inOn ? (
          <div data-part-timed="">
            <MotionSpeedRow data="speed" label="How fast it comes in" value={motion.speed} onPick={(v) => moveTo('speed', v)} />
            {/* Following the scroll, the thumb sets the pace — there is nothing to wait for. */}
            {!scroll ? (
              <IRow label="Delay" data="delay">
                <PickMenu
                  label="Delay"
                  dataAttr="data-motion-delay"
                  value={motion.delay ?? 'none'}
                  options={HUB_EL_DELAY.map((v) => ({ key: v, label: HUB_EL_DELAY_LABEL[v] }))}
                  onPick={(v) => moveTo('delay', v === 'none' ? null : v)}
                  className={row}
                />
              </IRow>
            ) : null}
          </div>
        ) : null}
      </div>
      <div data-motion-step="during">
        <ISection>{buildWords ? 'Action' : 'While on screen'}</ISection>
        {/* In and During play TOGETHER — choosing one never clears the other. */}
        <IRow label="During" data="during">
          <PickMenu
            label="While on screen"
            dataAttr="data-motion-during"
            value={motion.during ?? 'still'}
            options={HUB_EL_DURING_WORDS.map((v) => ({ key: v, label: HUB_EL_DURING_LABEL[v] }))}
            onPick={(v) => moveTo('during', v === 'still' ? null : v)}
            className={row}
          />
        </IRow>
      </div>
      {/* A part that plays once has no Out — it stays. */}
      {scroll ? (
        <div data-motion-step="out">
          <ISection>{buildWords ? 'Build out' : 'Goes out'}</ISection>
          <MotionFxRows end="out" fx={motion.out} onChange={(fx) => moveTo('out', fx)} />
          {outOn ? (
            <MotionSpeedRow data="out-speed" label="How fast it goes out" value={motion.outSpeed} onPick={(v) => moveTo('outSpeed', v)} />
          ) : null}
        </div>
      ) : null}
      <div data-motion-step="when">
        <ISection>When it plays</ISection>
        <IRow data="timeline">
          <PickMenu
            label="When it plays"
            dataAttr="data-motion-timeline"
            value={motion.timeline ?? 'once'}
            options={HUB_EL_TIMELINE.map((t) => ({ key: t, label: HUB_EL_TIMELINE_LABEL[t] }))}
            onPick={(t) => moveTo('timeline', t === 'once' ? null : t)}
            className={row}
          />
        </IRow>
      </div>
      {scroll ? (
        <IHint data="scroll">
          Following the scroll: the guest’s thumb sets the pace — Speed is how far they scroll. Goes out is the hand-off to the next scene.
        </IHint>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 py-2.5">
        {onPreview && inOn ? (
          <IButton fill onClick={onPreview} data="preview">
            <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Preview
          </IButton>
        ) : null}
        {resetMotion ? (
          <IReset onClick={resetMotion} data="motion">
            Move with the scene
          </IReset>
        ) : null}
      </div>
    </div>
  );
}

export function PartArrangeTab({
  el,
  hidden,
  setHidden,
}: {
  el: HubElementKey;
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}) {
  return (
    <div data-part-tab="arrange">
      {HUB_ELEMENT_FIELDS[el].includes('hidden') ? (
        <>
          <ISection>Show</ISection>
          <IRow data="show">
            <ISegmented label="Show or hide this part">
              <ISeg on={!hidden} onClick={() => setHidden(false)} data="shown">
                Shown
              </ISeg>
              <ISeg on={hidden} onClick={() => setHidden(true)} data="hidden">
                Hidden
              </ISeg>
            </ISegmented>
          </IRow>
          <IHint>A hidden part stays ghosted here so you can bring it back. Guests never see it.</IHint>
        </>
      ) : null}
      <ISection>Where it sits</ISection>
      {/* ✋ No "Open the Hero editor" (owner 2026-10-05): the words are typed on the page. */}
      <IHint>Parts keep the scene’s order on every screen — rails on, so nothing lands off a phone.</IHint>
    </div>
  );
}
