'use client';

import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasWriteKey, draftedCanvasOr, noteDraftedCanvas } from '@/lib/maker-draft-store';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { HUB_DRAFT_FIELD, type HubDraftActionResult } from '@/lib/hub-draft';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { ChosenRow, FormRow, FormRows, TypedRow, type FormRowAbout } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { PillSelector } from '@/app/_components/pill-selector';
import {
  RSVP_DRAFT_TYPE,
  RSVP_PREVIEW_EVENT,
  RSVP_SCENE_WORDS,
  RSVP_WORD_LABEL,
  type RsvpStageScene,
} from '@/lib/rsvp-stage';
import { RSVP_WORD_TYPED_EVENT } from '@/app/[slug]/_components/rsvp-canvas-parts';
import { rsvpFormWord, rsvpLineWord } from '@/lib/rsvp-form-words';
import type { MakerPartTool } from '@/lib/maker-parts';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { updatePaxSettings } from '../../actions';
import { DetailsPieceOnly } from './details-piece';
import {
  RSVP_ASK_FIELDS,
  RSVP_ASK_LABEL,
  readOneAtATime,
  rsvpAnswerWord,
  RSVP_WORD_KEYS,
  RSVP_WORD_LINES,
  RSVP_WORD_MAX,
  type RsvpAskConfig,
  type RsvpWordKey,
} from '@/lib/rsvp-ask';
import { GUESTS_GET_IN_LABEL, guestsGetInPatch, readGuestsGetIn } from '@/lib/who-can-reply';
/* 🔗 ONE SETTING, TWO DOORS (owner 2026-10-07, HOME_AND_GUESTS_CHECK § "Setup ↔ Event
   Hub Maker"): the get-in dropdown, the six asks and Reply by are the SAME parts Guests ›
   Setup mounts — never a second copy here (`setup-and-maker-mount-the-same-parts.test.ts`). */
/* ⚖ Loaded when first drawn, warmed at idle (the Maker's first-load budget) — `guest-setup-lazy.tsx`. */
import { GuestsGetIn, ReplyBy, RsvpAsks } from '../../_components/guest-setup/guest-setup-lazy';
import type { GuestsGetInFrame } from '../../_components/guest-setup/guests-get-in';
import type { ReplyByFrame } from '../../_components/guest-setup/reply-by';
import { formatCount } from '@/lib/format-number';
import { readCelebrationKey, type RsvpCelebration } from '@/lib/rsvp-celebration';
import { CelebrationPick } from './celebration-pick';
import { studioDraftKeep } from './studio-info';
import { STUDIO_GROUP } from '@/lib/studio-skin';

/**
 * THE RSVP PAGE'S CONTROLS — the Maker's own RSVP page (guest pathway brief
 * item 5; owner 2026-09-27: *"RSVP is its own made-once page in the Maker bar"*,
 * prototype `rsvp-variants-2026-09-27.html` → maker.png). In order:
 *
 *   · Ask one question at a time   (`rsvp_ask_config.oneAtATime`)
 *   · What do you ask your guests? (the six switches — MOVED here from Details;
 *                                   owner 2026-09-25: *"yes on and off"*)
 *   · How guests get in            (`rsvp_ask_config` guestsReply · whoCanRsvp ·
 *                                   approveEach — ONE dropdown over the keys
 *                                   onboarding writes; Guest List → Invite and
 *                                   Event Details read the same)
 *   · Reply by                     (the couple's deadline, or 30 days before) —
 *                                   a date field RIGHT HERE (Details part 2b; owner
 *                                   rule "no link-outs") — the column's ONE
 *                                   editor (`updatePaxSettings`); Event settings'
 *                                   Pricing card only carries it back hidden
 *                                   (audit HOLD, train d 2026-10-02)
 *   (· Reminder emails — REMOVED 2026-09-29: no email to guests, owner ruling;
 *      `GUEST_REMINDER_EMAILS_ON` in lib/guest-reminder-emails-core.ts)
 *   · Requests waiting             — the shipped Requests rows (Keep · Remove ·
 *                                   Link) drawn IN PLACE (`requests.list`, the
 *                                   Requests page itself with `maker=1`)
 *
 * 💾 THE DRAFT, NEVER LIVE — and ONE object. All three settings live in the
 * same `events.rsvp_ask_config`, so they share ONE local copy here and every
 * press posts the WHOLE object to `hubDraftAction` intent=save (the one generic
 * draft action; ZERO new server-action exports). Two components each holding
 * their own copy would overwrite each other's change with a stale object.
 * Guests keep what they have until the couple presses Apply.
 *
 * `attending` is not a row — the owner's own list marks it "always on, not
 * switchable" — so it is drawn as a fixed line, never a switch.
 */
/** 🎉 What the When yes Celebration needs from the launch page (`CelebrationPick`). */
export type CelebrationInputs = {
  /** Event Hub Pro, as measured for this event. */
  ownsPro: boolean;
  /** The Mood Board's colours (`celebrationColours`). */
  colours: readonly string[];
};

export function MakerRsvpSettings({
  eventId,
  current,
  drafted,
  replyBy,
  replyByOwn,
  requests,
  scene,
  solemn = false,
  replyByFallback = null,
  draftAction = hubDraftAction,
  replyByAction = updatePaxSettings,
  celebration,
  studio = false,
  picked,
}: {
  /**
   * 🧩 THE NEW MAKER'S RSVP STAGE (a phone) — what its toolbar is on: the tool, the picked part and the picked LINE
   * of it (owner 2026-10-09: "why is this grouped?" · "shouldn't it be per element?" · "why is this scrolling?").
   * With it the controls are the PICKED thing's, never the screen's whole list:
   *   · Edit, a line picked — that line's words and its own Start from ▾, and nothing else;
   *   · otherwise — the scene's own list, WITHOUT the words (each word is its line's Edit now).
   * Absent — the desktop's stage and Studio › RSVP — the scene's whole list, exactly as before.
   */
  picked?: { tool: MakerPartTool; part: string | null; line: string | null };
  /**
   * 🧭 STUDIO › RSVP (the new Maker, `makerStagesStudioEnabled` — owner 2026-10-06,
   * DECISION_LOG "'ASK ONE BY ONE' IS HOW THE GUEST'S RSVP ASKS"): the same
   * settings, drawn as the prototype's full-screen tool — Reply by · How guests
   * answer ▾ · Words · What the reply asks · Celebration ▾ ◆. "How guests get in"
   * is NOT here (Event Setup). False — every couple today — draws it as shipped.
   */
  studio?: boolean;
  /**
   * 🎉 THE WHEN YES CELEBRATION (owner 2026-10-06) — only the stage's When yes
   * scene draws it: the measured Pro entitlement and the shell (for its ◆ marks
   * and whether it is shown at all) and the Mood Board's colours (its previews).
   */
  celebration?: CelebrationInputs & { storeShell: boolean };
  /** The draft save — `hubDraftAction`; the dev lab (`/dev/rsvp-stage-lab`) hands in its own to measure. */
  draftAction?: typeof hubDraftAction;
  /** The reply-by save — `updatePaxSettings`; the dev lab hands in its own. */
  replyByAction?: typeof updatePaxSettings;
  /**
   * 🗳 THE RSVP STAGE (owner 2026-09-30, DECISION_LOG "THE MAKER RE-PLAN…" /
   * "RE-PLAN REVISIONS…"): the scene whose controls to draw — the form's (its
   * YES / NO words, one at a time, the questions, who can RSVP, reply by), the
   * thank-you's or the decline's (heading · message). ⚡ On the stage every
   * change is ON THE CANVAS FIRST (`RSVP_PREVIEW_EVENT` → the stage's frames)
   * and saved behind it, batched, with NO render of the Maker (`held`,
   * `lib/maker-refresh.ts`). Absent = Details' RSVP item, exactly as before.
   */
  scene?: RsvpStageScene;
  /** A solemn event (a wake): the premade lines and today's words are its own. */
  solemn?: boolean;
  /** The 30-day default reply-by date (`resolveReplyBy` with no deadline) — what the line reads once "Use the default" is picked. */
  replyByFallback?: string | null;
  eventId: string;
  /** The drafted-over-live config (sparse — an absent question key is ON). */
  current: RsvpAskConfig;
  /** The draft holds a different config from what guests see. */
  drafted: boolean;
  /** `resolveReplyBy` — the couple's deadline, or the 30-day default; null with no date. */
  replyBy: { date: string; isDefault: boolean } | null;
  /**
   * The couple's OWN reply-by date (`events.guest_list_edit_deadline`, null =
   * the default) and the pricing view `updatePaxSettings` writes beside it (it
   * writes both, so the current one is posted back unchanged). Null = could not
   * be read: the field is not offered, and says so.
   */
  replyByOwn: { deadline: string | null; pricingMode: 'realtime' | 'final_only' } | null;
  /** Who is waiting in Guest List → Requests: the shipped rows, drawn here
   *  (`list`, null when this viewer may not read the guest list). `count:
   *  null` = could not be read. */
  requests: { count: number | null; list: ReactNode | null };
}) {
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stage = scene !== undefined;
  /* 🗳 On the stage the panel builds on the Maker's own copy of the config
     (`lib/maker-draft-store.ts`): no render follows a save any more, so the
     server's `current` stays what it was at the last render — reopening the
     stage must not show the switches as they were before this visit's edits. */
  const seen = (server: RsvpAskConfig): RsvpAskConfig =>
    stage || studio ? (draftedCanvasOr(RSVP_DRAFT_TYPE, server as HubSectionCanvas) as RsvpAskConfig) : server;
  const [local, setLocal] = useState<RsvpAskConfig>(() => seen(current));
  /* ⚡ A SWITCH FLIPS ON THE TAP (owner 2026-09-29, this page: *"when a toggle
     is pressed. everything loads for around 3 seconds"*). It used to set
     `local` INSIDE `start(async () => …)` — and React 19 holds every update
     made inside an async transition until the whole action settles. So the
     controlled switch snapped back at once, every switch on the page went
     grey (`disabled={pending}`), and nothing moved until the server answered —
     which, for a second tap, meant waiting behind the first tap's whole-Maker
     refresh too (Next runs server actions and refreshes one at a time). Now the
     switch is drawn first, outside the transition; the draft save runs behind
     it through `makerSave`; nothing is disabled while it runs; and a refused
     save puts the switch back AND says which one, in words.
     Held by `lib/every-maker-edit-shows-before-it-saves.test.ts` (A · a write
     inside the transition does not count as drawn; D · no switch waits). */
  /** What the switches show — every save posts ALL of it (one object, above). */
  const latest = useRef<RsvpAskConfig>(local);
  /** What the draft holds, as far as this panel knows — a refused save goes back here. */
  const saved = useRef<RsvpAskConfig>(local);
  /** Saves of mine still on their way, and which tap is the newest. */
  const inFlight = useRef(0);
  const newest = useRef(0);
  /* 🔁 ONE VALUE, NOT TWO (2026-09-27, "the switch reads Off but the input
     carries checked"). The switch's label, its knob and its input are all
     drawn from `local`; `local` is re-seeded from the server's draft whenever
     that changes (Apply, Discard, another tab), so the switch can never keep
     showing a value the draft no longer holds. (A `checked=""` ATTRIBUTE left
     from the first server render is not the state — React drives the
     `checked` PROPERTY, which is what `:checked` and the form read.)
     While a tap of mine is still on its way, a render that left before it
     cannot hold it — re-seeding then would flip the switch back for a moment.
     The save's own refresh (`makerSave`, once it lands) brings the answer. */
  const currentKey = JSON.stringify(current);
  useEffect(() => {
    saved.current = seen(JSON.parse(currentKey) as RsvpAskConfig);
    if (inFlight.current > 0) return;
    latest.current = saved.current;
    setLocal(saved.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  /**
   * `said`: the control that asked says a refusal ITSELF (a Form row's own red line and Try again) — the panel's one
   * line under the list then stays quiet, so a refusal is never said twice. The answer is the save's: whether the
   * draft took it and, if not, why.
   */
  const save = (patch: RsvpAskConfig, what?: string, said = false): Promise<SaveAnswer> => {
    const next: RsvpAskConfig = { ...latest.current, ...patch };
    latest.current = next;
    setLocal(next); // ⚡ on screen at the tap — never inside the transition below
    setError(null);
    const tap = ++newest.current;
    inFlight.current += 1;
    if (stage) {
      /* ⚡ ON THE CANVAS FIRST, THEN SAVED — ONE WRITE PER PAUSE. The stage's
         frames lay the change on the page they drew (`RSVP_PREVIEW_EVENT`);
         the save waits a beat and a newer change replaces it
         (`makerLatestWrite`), so typing is one save after the pause and quick
         taps are one save. `held`: nothing is re-rendered for it; the Apply
         count comes back with the save (`HUB_DRAFT_BAR_FIELD`). */
      announceRsvpPreview(next);
      noteDraftedCanvas(RSVP_DRAFT_TYPE, next as HubSectionCanvas, current as HubSectionCanvas);
      return (async (): Promise<SaveAnswer> => {
        let res: HubDraftActionResult | typeof SUPERSEDED;
        try {
          res = await makerSave(
            () =>
              makerLatestWrite(canvasWriteKey(RSVP_DRAFT_TYPE), () => {
                const fd = new FormData();
                fd.set('intent', 'save');
                fd.set('patch', JSON.stringify({ events: { rsvp_ask_config: next } }));
                fd.set(HUB_DRAFT_BAR_FIELD, '1');
                return draftAction(eventId, fd);
              }),
            requestMakerRefresh,
            { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
          );
        } catch {
          res = { ok: false, intent: 'save', error: 'Please try again.' };
        } finally {
          inFlight.current -= 1;
        }
        /* A later change carried this one — its answer decides for both. */
        if (res === SUPERSEDED) return KEPT;
        if (res.ok) {
          saved.current = next;
          return KEPT;
        }
        if (tap !== newest.current) return KEPT;
        /* Only what did not save goes back — on the panel AND on the canvas —
           and it is said in words. */
        const back = saved.current;
        latest.current = back;
        setLocal(back);
        announceRsvpPreview(back);
        noteDraftedCanvas(RSVP_DRAFT_TYPE, back as HubSectionCanvas, current as HubSectionCanvas);
        if (!said) setError(`${what ?? rsvpSettingName(patch)} did not save, so it is back as it was. ${res.error || 'Please try again.'}`);
        return { ok: false, error: `It is back as it was. ${res.error || 'Please try again.'}` };
      })();
    }
    if (studio) {
      /* 🧭 STUDIO › RSVP — ONE REQUEST A PRESS, NO RENDER OF THE MAKER (owner rule 2026-10-08: *"the least amount of
         request for the tasks to be done"*). It was an unheld save: one draft write AND a whole render of the Maker
         per burst — per keystroke while a word was typed. Now it is kept THE ONE WAY A STUDIO PAGE KEEPS A DRAFTED
         ANSWER — `studioDraftKeep` (Studio › Info's): held, the newest change of a burst the ONE write, the Apply
         count in the answer, the pages the Maker shows redrawn in place once the last write has landed. Its key is
         the RSVP stage's own (`canvasWriteKey`), so a change made in Studio and one made on the stage never land
         out of order. The panel builds on the Maker's own copy (`noteDraftedCanvas`), and the RSVP's own screens
         are told at once (`announceRsvpPreview`). (The dev lab's stand-in for the draft door reaches this page
         through that same helper — `setStudioDraftDoor`.) */
      announceRsvpPreview(next);
      noteDraftedCanvas(RSVP_DRAFT_TYPE, next as HubSectionCanvas, current as HubSectionCanvas);
      return (async (): Promise<SaveAnswer> => {
        let res: SaveAnswer;
        try {
          res = await studioDraftKeep(eventId, canvasWriteKey(RSVP_DRAFT_TYPE), { rsvp_ask_config: next });
        } finally {
          inFlight.current -= 1;
        }
        if (res.ok) {
          /* Kept — or carried by a later change of the burst, whose own answer decides. */
          if (tap === newest.current) saved.current = next;
          return KEPT;
        }
        if (tap !== newest.current) return KEPT;
        const back = saved.current;
        latest.current = back;
        setLocal(back);
        announceRsvpPreview(back);
        noteDraftedCanvas(RSVP_DRAFT_TYPE, back as HubSectionCanvas, current as HubSectionCanvas);
        if (!said) setError(`${what ?? rsvpSettingName(patch)} did not save, so it is back as it was. ${res.error}`);
        return { ok: false, error: `It is back as it was. ${res.error}` };
      })();
    }
    start(async () => {
      let refused: string | null = null;
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { rsvp_ask_config: next } }));
        /* The RSVP page beside it and the toolbar's count read the draft: ONE
           refresh after the last switch lands (`lib/maker-refresh.ts`) — the
           action itself no longer re-renders the whole Maker, and the RSVP
           picture loads the new render BEHIND the one shown (`MakerPageFrame`). */
        const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);
        if (r.ok) saved.current = next;
        else refused = r.error;
      } catch {
        refused = 'Please try again.';
      } finally {
        inFlight.current -= 1;
      }
      /* A later tap is already on its way carrying the WHOLE object, so it
         decides; only the newest tap's refusal puts the switches back. */
      if (refused !== null && tap === newest.current) {
        latest.current = saved.current;
        setLocal(saved.current);
        setError(`${rsvpSettingName(patch)} did not save, so it is back as it was. ${refused}`);
      }
    });
    /* Event Details' own controls say a refusal on the panel's one line (above). */
    return Promise.resolve(KEPT);
  };

  /** One word typed (or picked) — the whole `words` object travels, as one config. */
  const wordsWith = (key: RsvpWordKey, text: string) => {
    const words = { ...(latest.current.words ?? {}) };
    if (text === '') delete words[key];
    else words[key] = text.slice(0, RSVP_WORD_MAX[key]);
    return words;
  };
  const saveWord = (key: RsvpWordKey, text: string, said = false) => save({ words: wordsWith(key, text) }, `“${sceneWordName(key)}”`, said);
  /* ✍ AS IT IS TYPED IN ITS ROW, the page shows it (owner 2026-09-30: *"fast and realtime and changes instantly"*) —
     a preview only: nothing is kept until the row is left (tap out or Enter), and ✕ puts the page back. */
  const previewWord = (key: RsvpWordKey, text: string) => {
    if (!stage && !studio) return;
    announceRsvpPreview({ ...latest.current, words: wordsWith(key, text) });
  };
  /* ⌨ A WORD TYPED ON THE PAGE (the RSVP stage's canvas, a second tap on the picked part's words —
     `rsvp-canvas-bridge.tsx`) IS THIS BOX'S OWN SAVE: one value, two doors. On the canvas first, drafted behind it,
     published only at Apply — exactly as a keystroke in the box below. */
  const saveWordRef = useRef(saveWord);
  saveWordRef.current = saveWord;
  useEffect(() => {
    if (!stage) return;
    const onTyped = (e: Event) => {
      const d = (e as CustomEvent<{ key?: unknown; text?: unknown }>).detail;
      if (typeof d?.text !== 'string' || !(RSVP_WORD_KEYS as readonly unknown[]).includes(d.key)) return;
      void saveWordRef.current(d.key as RsvpWordKey, d.text);
    };
    window.addEventListener(RSVP_WORD_TYPED_EVENT, onTyped);
    return () => window.removeEventListener(RSVP_WORD_TYPED_EVENT, onTyped);
  }, [stage]);

  const oneAtATime = readOneAtATime(local);
  const words = local.words ?? {};
  const status = error ? (
    <p role="alert" className="px-1 pt-2 text-[12.5px] font-semibold text-danger-700" data-rsvp-stage-error="">
      {error}
    </p>
  ) : null;

  /* ══ 🧾 THE RSVP'S ROWS — ONE SOURCE FOR EVERY DOOR ══
     (owner 2026-10-08: *"we want the whole app to be adaptive to the same feel"* · *"field follow form row style"*;
     `INTERACTION_RULES.md` § 9; the approved gallery § 1 · § 2 · § 6 · § 8 · § 10 · § 11.)
     Studio › RSVP and the RSVP stage's form draw the SAME list, in the Studio's order; the stage's two after-screens
     draw their words the same way. Each row is one approved kind:
       Reply by            Form row with a date (the one calendar)       drafted through `updatePaxSettings`
       How guests answer   Pill selector — two named things              `oneAtATime`
       Yes · No answer     Form row, typed — and Start from ▾ under it   `words`
       How guests get in   Dropdown in a Form row                        `guestsReply · whoCanRsvp · approveEach`
       RSVP asks           Chips — choose several                        the six questions
     Every one saves the ONE object into the draft and waits for ✓ Apply. Opening the page, a row or the calendar
     writes nothing. */

  /* 📅 Reply by — the shared part keeps the value and the one writer; the row is the app's own (`frame`). */
  const replyByRow = replyByOwn ? (
    <ReplyBy
      layout="frame"
      frame={replyByFrame}
      eventId={eventId}
      own={replyByOwn.deadline}
      pricingMode={replyByOwn.pricingMode}
      fallback={replyByFallback ?? (replyBy?.isDefault ? replyBy.date : null)}
      action={replyByAction}
      draft
    />
  ) : (
    <FormRow data="reply-by" name="Reply by" problem="We couldn’t read your reply-by date just now, so it can’t be changed here. Nothing was changed." />
  );
  /* ❓ How guests answer — two named things, so a pill selector (never a switch, never a list of two). */
  const answerRow = (
    <FormRow
      data="how-guests-answer"
      name={HOW_GUESTS_ANSWER_LABEL}
      about={{ words: HOW_GUESTS_ANSWER_ABOUT }}
      attrs={{ 'data-rsvp-setting': 'how-guests-answer' }}
    >
      <PillSelector
        label={HOW_GUESTS_ANSWER_LABEL}
        data="rsvp-answer"
        grow={false}
        value={oneAtATime ? 'one' : 'all'}
        options={HOW_GUESTS_ANSWER_OPTIONS}
        onPick={(value) => {
          const next = value === 'one';
          if (next !== oneAtATime) void save({ oneAtATime: next }, `“${HOW_GUESTS_ANSWER_LABEL}”`);
        }}
      />
    </FormRow>
  );
  /* ✍ ONE word — its typed row and its own Start from ▾. "Automatic" is what the page says by itself: the answer's
     and the form's three lines have words of their own; a note's heading is made for each guest, its message none. */
  const wordRow = (of: RsvpStageScene, key: RsvpWordKey) => (
    <WordRows
      key={key}
      wordKey={key}
      value={words[key] ?? ''}
      automatic={
        key === 'attending' || key === 'declined'
          ? rsvpAnswerWord(null, key, solemn)
          : key === 'eyebrow' || key === 'question' || key === 'hint'
            ? rsvpFormWord(null, key, solemn)
            : sceneWordPlaceholder(key)
      }
      lines={RSVP_WORD_LINES[key][solemn ? 'solemn' : 'celebrate']}
      about={of === 'form' ? null : { words: wordAbout(of, key) }}
      onType={(text) => previewWord(key, text)}
      onKeep={(text) => saveWord(key, text, true)}
    />
  );
  /* ✍ The words a scene holds — typed rows, each with its Start from ▾. On the new Maker's RSVP stage (`picked`)
     the list holds NONE of them: a word is typed where its LINE is picked (below), so the long list is gone. */
  const wordRows = (of: RsvpStageScene) => (picked ? [] : RSVP_SCENE_WORDS[of].map((key) => wordRow(of, key)));
  /* 🎟 HOW GUESTS GET IN — "Will guests reply? / Entry" and the guest-list type
     as ONE dropdown (owner 2026-10-02, DECISION_LOG "EVERY ANSWER ABOUT AN EVENT
     LIVES IN EVENT DETAILS ('YOUR INFO') — ONE HOME, MAPPED"). Every choice is a
     view over the SAME `rsvp_ask_config` keys onboarding writes
     (`readGuestsGetIn` / `guestsGetInPatch`, lib/who-can-reply.ts), saved whole
     through the draft door like every other key here. The Guest list may show
     it; only Your info sets it. */
  const getInNow = readGuestsGetIn(local);
  const pickGetIn = (value: Parameters<typeof guestsGetInPatch>[0]) => void save(guestsGetInPatch(value), `“${GUESTS_GET_IN_LABEL}”`);
  const getInRow = <GuestsGetIn frame={getInFrame} value={getInNow} onPick={pickGetIn} />;
  /* ✓ The six asks — the shared part draws the chips (Guests › Setup draws the same); the row around them is the app's. */
  const toggleAsk = (field: (typeof RSVP_ASK_FIELDS)[number], v: boolean) => void save({ [field]: v });
  const asksRow = <RsvpAsks frame={asksFrame} config={local} onToggle={toggleAsk} />;
  /* 🎉 Celebration ▾ ◆ — drafted in the same one object (None is stored as no key, so picking it back is no change). */
  const celebrationRow = (wrap?: (row: ReactNode) => ReactNode) =>
    celebration ? (
      <CelebrationPick
        value={readCelebrationKey(local)}
        ownsPro={celebration.ownsPro}
        storeShell={celebration.storeShell}
        colours={celebration.colours}
        wrap={wrap}
        onPick={(next: RsvpCelebration) => void save({ celebration: next === 'none' ? undefined : next }, `“Celebration”`)}
      />
    ) : null;
  /** The reply's own rows, in the Studio's order — the list Studio › RSVP and the stage's form both draw. */
  const formRows = (
    <FormRows data="rsvp">
      {replyByRow}
      {answerRow}
      {wordRows('form')}
      {getInRow}
      {asksRow}
    </FormRows>
  );
  /* Event Details' item keeps its own rows for these two until that page moves (the same parts, Guests › Setup's look). */
  const getIn = (
    <GuestsGetIn value={getInNow} onPick={pickGetIn} rowClassName="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" pickClassName="" />
  );
  const asks = <RsvpAsks config={local} onToggle={toggleAsk} rowClassName="flex flex-col gap-2" />;

  /* ══ 🗳 THE RSVP STAGE — one scene's controls ══
     The form: the reply's own rows (above). The thank-you and the decline: a heading
     and a message. Presentation only — who replied, requests and reminders
     belong to the Guest list (DECISION_LOG 2026-09-30, "THE MAKER EDITS HOW IT
     LOOKS; THE GUEST LIST MANAGES THE PEOPLE"). */
  if (scene !== undefined && picked) {
    /* 🧩 THE NEW MAKER'S RSVP STAGE: the picked thing's controls. */
    const lineWord = rsvpLineWord(picked.part, picked.line);
    if (picked.tool === 'edit' && lineWord) {
      return (
        <div className="flex flex-col px-1" data-rsvp-stage-controls={scene} data-rsvp-stage-line-edit={picked.line ?? ''}>
          <FormRows data="rsvp-line">{wordRow(scene, lineWord)}</FormRows>
          {status}
        </div>
      );
    }
    /* Anything else — the group, nothing picked, another tool: the scene's own list below, which holds no word
       here (`wordRows`). ONE list for every door, as before. */
  }
  if (scene !== undefined) {
    if (scene !== 'form') {
      /* The after-screens: ONE list — on When yes the Celebration first (the prototype's panel opens on it), then
         the heading and the message. Nothing else is printed on the panel: what each screen IS and the {name} rule
         are behind the rows' ⓘ, word for word; "In your draft…" is the count on ✓ Apply. */
      return (
        <div className="flex flex-col px-1" data-rsvp-stage-controls={scene}>
          <FormRows data={`rsvp-${scene}`}>
            {scene === 'thanks' ? celebrationRow() : null}
            {wordRows(scene)}
          </FormRows>
          {status}
        </div>
      );
    }
    return (
      <div className="flex flex-col px-1" data-rsvp-stage-controls="form">
        {formRows}
        {status}
      </div>
    );
  }

  /* ══ 🧭 STUDIO › RSVP — the same rows on the Studio's white band, then When yes ══
     No title inside the page (the Studio's own row names the tool) and no group headings: the page opens on its
     first row. */
  if (studio) {
    return (
      <div className="flex flex-col" data-studio-rsvp="">
        <div className={STUDIO_GROUP}>{formRows}</div>
        {/* 🎉 When yes — on a band of its own under the reply's rows. The band is the row's (`wrap`): where the pick
            is not shown at all (the store shell, without Pro) no empty band is left behind. */}
        {celebrationRow((row) => (
          <div className={STUDIO_GROUP}>
            <FormRows data="rsvp-celebration">{row}</FormRows>
          </div>
        ))}
        {status}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-1" data-made-once="rsvp-page">
      <DetailsPieceOnly item="rsvp" piece="questions">
      {/* ── How guests answer — the ONE control for `oneAtATime`, the same row as Studio › RSVP and the stage ── */}
      <section data-rsvp-setting="one-at-a-time">
        <FormRows data="rsvp-answer">{answerRow}</FormRows>
      </section>

      {/* ── What do you ask your guests? (moved here from Details) ── */}
      {asks}
      </DetailsPieceOnly>

      <DetailsPieceOnly item="rsvp" piece="who">
      {/* ── How guests get in — ONE stored setting, ONE dropdown ── */}
      {getIn}
      </DetailsPieceOnly>

      <DetailsPieceOnly item="rsvp" piece="reply-by">
      {/* ── Reply by — typed right here (no link out) ── */}
      <section className="flex flex-col gap-1" data-rsvp-setting="reply-by">
        <p className="text-sm font-semibold text-ink">Reply by</p>
        {/* ONE line for the date — the field's own (owner 2026-10-05: the date
            showed twice, once with "Set your event date first."). */}
        {replyByOwn ? (
          <ReplyBy
            layout="stack"
            eventId={eventId}
            own={replyByOwn.deadline}
            pricingMode={replyByOwn.pricingMode}
            fallback={replyByFallback ?? (replyBy?.isDefault ? replyBy.date : null)}
            action={replyByAction}
            draft
          />
        ) : (
          <p role="alert" className="text-[13px] text-terracotta-700">
            We couldn&rsquo;t read your reply-by date just now, so it can&rsquo;t be changed here. Nothing was changed.
          </p>
        )}
      </section>
      </DetailsPieceOnly>

      <DetailsPieceOnly item="rsvp" piece="requests">
      {/* ── Requests waiting — the shipped rows, in place (Keep · Remove · Link) ── */}
      <section className="flex flex-col gap-2" data-rsvp-setting="requests">
        <p className="text-sm font-semibold text-ink">Requests waiting</p>
        {requests.list ? (
          <div data-rsvp-requests-list="">{requests.list}</div>
        ) : requests.count === null ? (
          <p role="alert" className="text-[13px] text-terracotta-700">
            We couldn&rsquo;t count your requests just now — this does not mean there are none.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-serif text-4xl leading-none text-ink" data-requests-count={requests.count}>
              {formatCount(requests.count)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink/70">
              {requests.count === 0 ? 'Nobody is waiting' : requests.count === 1 ? 'person asked to join' : 'people asked to join'}
            </span>
          </div>
        )}
      </section>
      </DetailsPieceOnly>

      {/* No "in your draft" line under the settings (owner 2026-10-05: no captions) — the ✓ Apply count says it. */}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ── THE SHARED PARTS' ROWS — the Maker's own frame for each (`_components/guest-setup/`): the part keeps the value,
   the choices and the one writer; the Maker hands in the app's Form row, so Guests › Setup's page carries no
   template of ours and both doors still mount ONE part (`setup-and-maker-mount-the-same-parts.test.ts`). ── */

/** 📅 Reply by → the Form row with a date: the pill with the calendar mark, the one calendar behind it. (The three frames are exported for their guard, which draws each part with it.) */
export const replyByFrame = (row: ReplyByFrame) => <DateRow data="reply-by" name={row.name} value={row.own} shown={row.fallback} onKeep={row.keep} attrs={row.attrs} />;
/** 🎟 How guests get in → the dropdown in a Form row; the picked choice's one sentence is behind its ⓘ. */
export const getInFrame = (row: GuestsGetInFrame) => (
  <ChosenRow data="get-in" name={row.name} about={{ words: row.hint }} value={row.value} buttonText={row.buttonText} options={row.options} onPick={row.onPick} dataAttr={row.dataAttr} attrs={row.attrs} />
);
/** ✓ RSVP asks → a Form row whose answer is the chips under it; its sentence is behind its ⓘ. */
export const asksFrame = (row: { name: string; line: string; chips: ReactNode; attrs: Readonly<Record<`data-${string}`, string>> }) => (
  <FormRow data="asks" name={row.name} about={{ words: row.line }} attrs={row.attrs} below={<div className="pb-3 pt-0.5">{row.chips}</div>} />
);

/** What a save answers: the draft took it — or it did not, and why (the panel is already back as it was). */
type SaveAnswer = { ok: true } | { ok: false; error: string };
const KEPT: SaveAnswer = { ok: true };

/**
 * ❓ HOW GUESTS ANSWER (owner 2026-10-06: *"on RSVP, it can show all the questions or the
 * data to fill like a form or ask one by one"*) — two named things over the ONE shipped key
 * `rsvp_ask_config.oneAtATime` (`readOneAtATime`), so ONE pill selector (owner 2026-10-08, the
 * templates: a choice between two named things is a 2-way pill selector — it was a dropdown of
 * two in Studio and a switch "Ask one question at a time" on the stage and in Event Details).
 * No second setting.
 */
export const HOW_GUESTS_ANSWER_LABEL = 'How guests answer';
export const HOW_GUESTS_ANSWER_OPTIONS = [
  { key: 'all', label: 'All at once', hint: 'Every question on one page, like a form' },
  { key: 'one', label: 'One by one', hint: 'One question per screen · Next › Send' },
] as const;
/** Behind the row's ⓘ: what each of the two means — the options' own lines, word for word. */
export const HOW_GUESTS_ANSWER_ABOUT = HOW_GUESTS_ANSWER_OPTIONS.map((o) => `${o.label}: ${o.hint}.`).join(' ');

/** The setting a refused save put back, as the couple reads it on this page. */
function rsvpSettingName(patch: RsvpAskConfig): string {
  if ('oneAtATime' in patch) return `“${HOW_GUESTS_ANSWER_LABEL}”`;
  if ('whoCanRsvp' in patch) return `“${GUESTS_GET_IN_LABEL}”`;
  const field = RSVP_ASK_FIELDS.find((f) => f in patch);
  return field ? `“${RSVP_ASK_LABEL[field]}”` : 'That change';
}

/** The whole config, drawn — the RSVP stage's frames lay it on the page (`maker-rsvp-stage.tsx`). */
function announceRsvpPreview(config: RsvpAskConfig): void {
  window.dispatchEvent(new CustomEvent(RSVP_PREVIEW_EVENT, { detail: config }));
}

/** A word's name in a sentence ("“Yes answer” did not save…"). */
function sceneWordName(key: RsvpWordKey): string {
  if (key === 'thanksHeading' || key === 'thanksMessage') return `Thank-you ${RSVP_WORD_LABEL[key].toLowerCase()}`;
  if (key === 'declineHeading' || key === 'declineMessage') return `Decline ${RSVP_WORD_LABEL[key].toLowerCase()}`;
  return RSVP_WORD_LABEL[key];
}

/** What an empty heading or message box says it will show. */
function sceneWordPlaceholder(key: RsvpWordKey): string {
  if (key === 'thanksHeading') return 'Automatic — “See you on the 18th, Ana!”';
  if (key === 'declineHeading') return 'Automatic — “Thank you, Ana — you’ll be missed”';
  return 'No message';
}

/** Said behind the ⓘ of an after-screen's words — the panel's own sentences, word for word (they were printed on it). */
const RSVP_NAME_HINT = 'Type {name} and each guest sees their own name.';
const RSVP_SCREEN_LINE: Record<Exclude<RsvpStageScene, 'form'>, string> = {
  thanks: 'What a guest sees right after they say yes — with their Digital tickets under it.',
  decline: 'What a guest sees after they say they can’t come.',
};
/** A word's ⓘ: the screen's first row says what the screen IS, then the {name} rule; its second, the rule alone. */
function wordAbout(scene: Exclude<RsvpStageScene, 'form'>, key: RsvpWordKey): ReactNode {
  if (key !== RSVP_SCENE_WORDS[scene][0]) return RSVP_NAME_HINT;
  return (
    <>
      <span>{RSVP_SCREEN_LINE[scene]}</span>
      <span>{RSVP_NAME_HINT}</span>
    </>
  );
}
/** "Start from ▾": the page's own words (nothing of the couple's) · what the couple wrote themselves. */
const AUTOMATIC_WORDS = 'automatic';
const OWN_WORDS = 'own';

/**
 * ONE WORD, TYPED OR PICKED (owner 2026-09-30: *"Joyfully Accepts can be
 * renamed"* — type your own, or a premade line), on the app's Form row (owner
 * 2026-10-08: *"field follow form row style"*):
 *
 *   · the row's pill holds the couple's words — empty, it reads the words the page uses by itself, in grey;
 *   · a tap opens the field across the row (a message: the taller box). Tapping out or Enter keeps — ONE drafted
 *     write; ✕ leaves it as it was. While it is typed the page shows it (`onType`), and nothing is kept;
 *   · "Start from ▾" under it is the ONE other control of the answer: its first choice, **Automatic**, puts the
 *     page's own words back (it IS the reset — it was an underlined link, then a separate quiet button; controller
 *     2026-10-08: one control per answer, and no extra 44-px line in the short stage panel); a premade line FILLS
 *     the row (it does not become the answer); "Your own" names what the couple wrote. A word with no premade
 *     line and nothing written has nothing to start from and nothing to put back: no row.
 * `data-rsvp-word-field` lets a tap on the canvas bring its row up.
 */
function WordRows({
  wordKey,
  value,
  automatic,
  lines,
  about,
  onType,
  onKeep,
}: {
  wordKey: RsvpWordKey;
  value: string;
  /** What the page says while there are no words of the couple's own. */
  automatic: string;
  lines: readonly string[];
  about: FormRowAbout | null;
  onType: (text: string) => void;
  onKeep: (text: string) => Promise<SaveAnswer>;
}) {
  const name = RSVP_WORD_LABEL[wordKey];
  const picked = lines.includes(value) ? value : null;
  const [problem, setProblem] = useState<string | null>(null);
  /* A pick from Start from ▾ is this answer's own save too: a refusal is said under the row it belongs to. */
  const put = (text: string) => {
    setProblem(null);
    void onKeep(text).then((r) => {
      if (!r.ok) setProblem(`${name} did not save. ${r.error}`);
    });
  };
  return (
    <>
      <TypedRow
        data={`word-${wordKey}`}
        attrs={{ 'data-rsvp-word-field': wordKey }}
        name={name}
        about={about}
        value={value}
        empty={automatic}
        placeholder={automatic}
        long={RSVP_WORD_MAX[wordKey] > 80}
        maxLength={RSVP_WORD_MAX[wordKey]}
        onType={onType}
        onKeep={(text) => {
          setProblem(null);
          return onKeep(text);
        }}
      />
      {lines.length > 0 || value !== '' ? (
      <ChosenRow
        data={`word-${wordKey}-start`}
        name="Start from"
        label={`${name} — start from`}
        dataAttr="data-rsvp-word-lines"
        value={value === '' ? AUTOMATIC_WORDS : (picked ?? OWN_WORDS)}
        buttonText={value === '' ? 'Automatic' : (picked ?? 'Your own')}
        options={[
          { key: AUTOMATIC_WORDS, label: 'Automatic', hint: automatic.replace(/^Automatic — /, '') },
          ...lines.map((line) => ({ key: line, label: line })),
          ...(value && !picked ? [{ key: OWN_WORDS, label: 'Your own', hint: 'Keep what you wrote' }] : []),
        ]}
        onPick={(line) => {
          if (line === OWN_WORDS) return;
          const next = line === AUTOMATIC_WORDS ? '' : line;
          if (next !== value) put(next);
        }}
        problem={problem}
      />
      ) : null}
    </>
  );
}
