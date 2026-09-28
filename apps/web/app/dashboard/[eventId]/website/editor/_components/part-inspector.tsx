'use client';

import { useEffect, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, PencilLine, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { HUB_FONT_FACES, hubFontBoldWeight, hubFontPreviewStack } from '@/lib/hub-fonts';
import {
  HUB_EL_DELAY,
  HUB_EL_DELAY_LABEL,
  HUB_EL_DURATION,
  HUB_EL_DURATION_LABEL,
  HUB_EL_DURING_LABEL,
  HUB_EL_DURING_WORDS,
  HUB_EL_IN,
  HUB_EL_IN_LABEL,
  HUB_EL_OUT,
  HUB_EL_OUT_LABEL,
  HUB_EL_TIMELINE,
  HUB_EL_TIMELINE_LABEL,
  HUB_ELEMENT_ALIGNS,
  HUB_ELEMENT_ALIGN_LABEL,
  HUB_ELEMENT_FIELDS,
  HUB_ELEMENT_FONTS,
  HUB_ELEMENT_LABEL,
  HUB_ELEMENT_WEIGHTS,
  HUB_ELEMENT_WEIGHT_LABEL,
  HUB_JOINER_MAX,
  HUB_JOINER_WORDS,
  HUB_LINK_DEFAULT_WORDS,
  HUB_LINK_WORDS_MAX,
  hasTextStyle,
  hubSpacingLabel,
  sanitizeHubJoinerWord,
  sanitizeHubLinkWords,
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
 *   ARRANGE  Show: Shown · Hidden · Where it sits (rails on) · Open the Hero editor
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
  { key: 'animate', label: 'Animate' },
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
}: {
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
  const has = (f: HubElementField) => fields.includes(f) && (!onRange || f === 'font' || f === 'color' || f === 'size');
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
      {has('word') && el === 'link' ? <LinkWordsRow word={style.word ?? null} onWord={(w) => choose('word', w)} /> : null}

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
          <PickMenu
            label="Font"
            dataAttr="data-element-font"
            value={face.font ?? 'hub'}
            options={[
              { key: 'hub', label: 'Event Hub font' },
              ...HUB_ELEMENT_FONTS.map((f) => ({
                key: f.key,
                label: f.label,
                fontFamily: hubFontPreviewStack(f.key),
                group: f.pickGroup,
              })),
            ]}
            onPick={(key) => choose('font', key === 'hub' ? null : key)}
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
          <ISegmented label="Alignment" grow={false}>
            {HUB_ELEMENT_ALIGNS.map((a) => {
              const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
              return (
                <ISeg key={a} on={style.align === a} onClick={() => chooseAlign(style.align === a ? null : a)} title={HUB_ELEMENT_ALIGN_LABEL[a]} data={`align-${a}`} className="w-12 flex-none lg:w-10">
                  <Icon aria-label={HUB_ELEMENT_ALIGN_LABEL[a]} className="h-4 w-4" strokeWidth={2} />
                </ISeg>
              );
            })}
          </ISegmented>
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

/** 🔗 The Joiner's word — and · & · + · Your own… (answer 2). */
function JoinerRow({ word, onWord }: { word: string | null; onWord: (w: string | null) => void }) {
  const own = word !== null && !(HUB_JOINER_WORDS as readonly string[]).includes(word);
  const [typing, setTyping] = useState(own);
  const [text, setText] = useState(own ? word : '');
  useEffect(() => {
    setTyping(word !== null && !(HUB_JOINER_WORDS as readonly string[]).includes(word));
    if (word !== null && !(HUB_JOINER_WORDS as readonly string[]).includes(word)) setText(word);
  }, [word]);
  const ok = sanitizeHubJoinerWord(text);
  return (
    <>
      <IRow label="Joiner" data="joiner">
        <ISegmented label="The word between the names">
          {HUB_JOINER_WORDS.map((w) => (
            <ISeg key={w} data={`joiner-${w}`} on={!typing && (word ?? 'and') === w} onClick={() => { setTyping(false); onWord(w === 'and' && word === null ? null : w); }}>
              {w}
            </ISeg>
          ))}
          <ISeg data="joiner-own" on={typing} onClick={() => setTyping(true)}>
            Your own…
          </ISeg>
        </ISegmented>
      </IRow>
      {typing ? (
        <form
          className="flex items-center gap-2 border-b border-ink/[0.07] py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onWord(ok);
          }}
        >
          <label className="sr-only" htmlFor="joiner-own-word">
            Your own word between the names
          </label>
          <input
            id="joiner-own-word"
            value={text}
            maxLength={HUB_JOINER_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="at saka"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink lg:min-h-9 lg:text-[14px]"
          />
          <IButton type="submit" fill disabled={!ok}>
            Use it
          </IButton>
        </form>
      ) : null}
    </>
  );
}

/**
 * 🔗 The link's words — the couple's own line, the card's words as the hint.
 * Cleared, it goes back to the card's words (an absence, the joiner's rule);
 * taking the link off the page is Arrange → Hidden.
 */
function LinkWordsRow({ word, onWord }: { word: string | null; onWord: (w: string | null) => void }) {
  const [text, setText] = useState(word ?? '');
  useEffect(() => setText(word ?? ''), [word]);
  const blank = text.trim().length === 0;
  const ok = blank ? null : sanitizeHubLinkWords(text);
  const changed = (ok ?? null) !== word;
  return (
    <form
      className="flex items-center gap-2 border-b border-ink/[0.07] py-2.5"
      data-row="link-words"
      onSubmit={(e) => {
        e.preventDefault();
        if (blank || ok) onWord(blank ? null : ok);
      }}
    >
      <label className="sr-only" htmlFor="link-own-words">
        Words
      </label>
      <input
        id="link-own-words"
        value={text}
        maxLength={HUB_LINK_WORDS_MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder={HUB_LINK_DEFAULT_WORDS}
        className="min-h-11 min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink lg:min-h-9 lg:text-[14px]"
      />
      <IButton type="submit" fill disabled={!changed || (!blank && !ok)}>
        Use it
      </IButton>
    </form>
  );
}

export function PartAnimateTab({
  motion,
  moveTo,
  onPreview,
  resetMotion,
  proMark = null,
}: {
  /** 💎 How a part moves is Event Hub Pro — its `<PaidMark>`, or null (none to draw). */
  proMark?: ReactNode;
  motion: HubElementMotion;
  moveTo: (part: keyof HubElementMotion, value: string | null) => void;
  /** ▶ Preview — replay the part's In on the canvas. */
  onPreview?: () => void;
  resetMotion: (() => void) | null;
}) {
  const scroll = motion.timeline === 'scroll';
  return (
    <div data-part-tab="animate">
      {proMark ? (
        <p className="pt-2.5" data-part-animate-pro="">
          {proMark}
        </p>
      ) : null}
      <IRow data="timeline">
        <ISegmented label="Plays once or follows the scroll">
          {HUB_EL_TIMELINE.map((t) => (
            <ISeg key={t} on={(motion.timeline ?? 'once') === t} onClick={() => moveTo('timeline', t === 'once' ? null : t)}>
              {HUB_EL_TIMELINE_LABEL[t]}
            </ISeg>
          ))}
        </ISegmented>
      </IRow>
      {/* In is a ▾ like Keynote's Build In. In and During play TOGETHER. */}
      <IRow label="In" data="in">
        <PickMenu
          label="How it comes in"
          dataAttr="data-element-in"
          value={motion.in ?? 'none'}
          options={HUB_EL_IN.map((v) => ({ key: v, label: HUB_EL_IN_LABEL[v] }))}
          onPick={(v) => moveTo('in', v === 'none' ? null : v)}
          className="min-h-11 min-w-0 flex-1 lg:min-h-9"
        />
      </IRow>
      <IRow label="During" data="during">
        <ISegmented label="While they read">
          {HUB_EL_DURING_WORDS.map((v) => (
            <ISeg key={v} on={(motion.during ?? 'still') === v} onClick={() => moveTo('during', v === 'still' ? null : v)}>
              {HUB_EL_DURING_LABEL[v]}
            </ISeg>
          ))}
        </ISegmented>
      </IRow>
      {scroll ? (
        <IRow label="Out" wrap data="out">
          <ISegmented label="How it leaves">
            {HUB_EL_OUT.map((v) => (
              <ISeg key={v} on={(motion.out ?? 'stay') === v} onClick={() => moveTo('out', v === 'stay' ? null : v)}>
                {HUB_EL_OUT_LABEL[v]}
              </ISeg>
            ))}
          </ISegmented>
        </IRow>
      ) : null}
      {/* Timed: Duration and Delay apply. Following the scroll: distance is the control, so they dim. */}
      <div className={scroll || !motion.in ? 'pointer-events-none opacity-40' : ''} aria-disabled={scroll || !motion.in} data-part-timed="">
        <IRow label="Duration" data="duration">
          <ISegmented label="Duration">
            {HUB_EL_DURATION.map((v) => (
              <ISeg key={v} on={(motion.duration ?? 'normal') === v} onClick={() => moveTo('duration', v === 'normal' ? null : v)}>
                {HUB_EL_DURATION_LABEL[v]}
              </ISeg>
            ))}
          </ISegmented>
        </IRow>
        <IRow label="Delay" data="delay">
          <ISegmented label="Delay">
            {HUB_EL_DELAY.map((v) => (
              <ISeg key={v} on={(motion.delay ?? 'none') === v} onClick={() => moveTo('delay', v === 'none' ? null : v)}>
                {HUB_EL_DELAY_LABEL[v]}
              </ISeg>
            ))}
          </ISegmented>
        </IRow>
      </div>
      {scroll ? (
        <IHint data="scroll">
          Following the scroll: the guest’s thumb sets the pace, so there is no duration. Out is the hand-off to the next scene.
        </IHint>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 py-2.5">
        {onPreview && motion.in ? (
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
  onOpenHero,
}: {
  el: HubElementKey;
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  /** The hero's parts: their words are written in the Hero editor. */
  onOpenHero?: () => void;
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
      <IHint>
        Parts keep {onOpenHero ? 'the hero’s' : 'the scene’s'} order on every screen — rails on, so nothing lands off a phone.
        {onOpenHero ? ' Change the words in the Hero editor.' : ''}
      </IHint>
      {onOpenHero ? (
        <div className="py-1.5">
          <IButton onClick={onOpenHero} data="open-hero">
            <PencilLine aria-hidden className="h-4 w-4" strokeWidth={2} />
            Open the Hero editor
          </IButton>
        </div>
      ) : null}
    </div>
  );
}
