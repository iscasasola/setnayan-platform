'use client';

import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasWriteKey, draftedCanvasOr, noteDraftedCanvas } from '@/lib/maker-draft-store';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import {
  RSVP_DRAFT_TYPE,
  RSVP_PREVIEW_EVENT,
  RSVP_REPLY_BY_EVENT,
  RSVP_SCENE_WORDS,
  RSVP_WORD_LABEL,
  rsvpReplyByLine,
  type RsvpStageScene,
} from '@/lib/rsvp-stage';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { updatePaxSettings } from '../../actions';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { DetailsPieceOnly } from './details-piece';
import {
  RSVP_ASK_FIELDS,
  RSVP_ASK_LABEL,
  readOneAtATime,
  rsvpAnswerWord,
  rsvpAsks,
  RSVP_WORD_LINES,
  RSVP_WORD_MAX,
  type RsvpAskConfig,
  type RsvpWordKey,
} from '@/lib/rsvp-ask';
import {
  GUESTS_GET_IN_LABEL,
  guestsGetInLabel,
  guestsGetInOptions,
  guestsGetInPatch,
  isGuestsGetIn,
  readGuestsGetIn,
} from '@/lib/who-can-reply';
import { formatCount } from '@/lib/format-number';

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
}: {
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
    stage ? (draftedCanvasOr(RSVP_DRAFT_TYPE, server as HubSectionCanvas) as RsvpAskConfig) : server;
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

  const save = (patch: RsvpAskConfig, what?: string) => {
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
      void (async () => {
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
        if (res === SUPERSEDED) return;
        if (res.ok) {
          saved.current = next;
          return;
        }
        if (tap !== newest.current) return;
        /* Only what did not save goes back — on the panel AND on the canvas —
           and it is said in words. */
        const back = saved.current;
        latest.current = back;
        setLocal(back);
        announceRsvpPreview(back);
        noteDraftedCanvas(RSVP_DRAFT_TYPE, back as HubSectionCanvas, current as HubSectionCanvas);
        setError(`${what ?? rsvpSettingName(patch)} did not save, so it is back as it was. ${res.error || 'Please try again.'}`);
      })();
      return;
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
  };

  /** One word typed (or picked) — the whole `words` object travels, as one config. */
  const saveWord = (key: RsvpWordKey, text: string) => {
    const words = { ...(latest.current.words ?? {}) };
    if (text === '') delete words[key];
    else words[key] = text.slice(0, RSVP_WORD_MAX[key]);
    save({ words }, `“${sceneWordName(key)}”`);
  };

  const oneAtATime = readOneAtATime(local);
  /* 🎟 HOW GUESTS GET IN — "Will guests reply? / Entry" and the guest-list type
     as ONE dropdown (owner 2026-10-02, DECISION_LOG "EVERY ANSWER ABOUT AN EVENT
     LIVES IN EVENT DETAILS ('YOUR INFO') — ONE HOME, MAPPED"). Every choice is a
     view over the SAME `rsvp_ask_config` keys onboarding writes
     (`readGuestsGetIn` / `guestsGetInPatch`, lib/who-can-reply.ts), saved whole
     through the draft door like every other key here. The Guest list may show
     it; only Your info sets it. */
  const getInNow = readGuestsGetIn(local);
  const getIn = (
    <section className="flex flex-col gap-2" data-rsvp-setting="who-can-rsvp">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {GUESTS_GET_IN_LABEL}
      </p>
      <PickMenu
        label={GUESTS_GET_IN_LABEL}
        dataAttr="data-rsvp-who-pick"
        value={getInNow}
        buttonText={guestsGetInLabel(getInNow)}
        options={guestsGetInOptions()}
        onPick={(value) =>
          value === getInNow || !isGuestsGetIn(value) ? undefined : save(guestsGetInPatch(value), `“${GUESTS_GET_IN_LABEL}”`)
        }
      />
    </section>
  );

  /* ══ 🗳 THE RSVP STAGE — one scene's controls ══
     The form: its YES / NO words, then how it asks (one at a time), what it
     asks, who may ask, and by when. The thank-you and the decline: a heading
     and a message. Presentation only — who replied, requests and reminders
     belong to the Guest list (DECISION_LOG 2026-09-30, "THE MAKER EDITS HOW IT
     LOOKS; THE GUEST LIST MANAGES THE PEOPLE"). */
  if (scene !== undefined) {
    const words = local.words ?? {};
    const status = error ? (
      <p role="alert" className="text-[13px] text-terracotta-700" data-rsvp-stage-error="">
        {error}
      </p>
    ) : null;
    const wordRows = RSVP_SCENE_WORDS[scene].map((key) => (
      <WordField
        key={key}
        wordKey={key}
        value={words[key] ?? ''}
        placeholder={key === 'attending' || key === 'declined' ? rsvpAnswerWord(null, key, solemn) : sceneWordPlaceholder(key)}
        lines={RSVP_WORD_LINES[key][solemn ? 'solemn' : 'celebrate']}
        onChange={(text) => saveWord(key, text)}
      />
    ));
    if (scene !== 'form') {
      return (
        <div className="flex flex-col gap-5 px-1" data-rsvp-stage-controls={scene}>
          <p className="text-[13px] text-ink/65">
            {scene === 'thanks'
              ? 'What a guest sees right after they say yes — with their Digital tickets under it.'
              : 'What a guest sees after they say they can’t come.'}
          </p>
          {wordRows}
          <p className="text-xs text-ink/60">Type {'{name}'} and each guest sees their own name.</p>
          {drafted || newest.current > 0 ? <DraftNote /> : null}
          {status}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-5 px-1" data-rsvp-stage-controls="form">
        <section className="flex flex-col gap-3" data-rsvp-setting="answers">
          <p className="text-sm font-semibold text-ink">The answers</p>
          {wordRows}
        </section>
        <section className="flex flex-col gap-1" data-rsvp-setting="one-at-a-time">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            Ask one question at a time
          </p>
          <Switch
            label={oneAtATime ? 'On · one question per screen' : 'Off · one scrolling page'}
            on={oneAtATime}
            onChange={(v) => save({ oneAtATime: v })}
          />
        </section>
        <section className="flex flex-col gap-1" data-made-once="rsvp-ask">
          <p className="text-sm font-semibold text-ink">What do you ask your guests?</p>
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/5 py-2 text-sm text-ink/55">
            <span>Attending</span>
            <span className="text-xs">always</span>
          </div>
          <div className="flex flex-col">
            {RSVP_ASK_FIELDS.map((field) => (
              <Switch
                key={field}
                label={
                  <>{RSVP_ASK_LABEL[field]}</>
                }
                on={rsvpAsks(local, field)}
                onChange={(v) => save({ [field]: v })}
              />
            ))}
          </div>
        </section>
        {getIn}
        <section className="flex flex-col gap-1" data-rsvp-setting="reply-by">
          <p className="text-sm font-semibold text-ink">Reply by</p>
          {replyByOwn ? (
            <ReplyByField
              eventId={eventId}
              own={replyByOwn.deadline}
              pricingMode={replyByOwn.pricingMode}
              live
              fallback={replyByFallback}
              action={replyByAction}
            />
          ) : (
            <p role="alert" className="text-[13px] text-terracotta-700">
              We couldn&rsquo;t read your reply-by date just now, so it can&rsquo;t be changed here. Nothing was changed.
            </p>
          )}
        </section>
        {drafted || newest.current > 0 ? <DraftNote /> : null}
        {status}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-1" data-made-once="rsvp-page">
      <DetailsPieceOnly item="rsvp" piece="questions">
      {/* ── Ask one question at a time ── */}
      <section className="flex flex-col gap-1" data-rsvp-setting="one-at-a-time">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          Ask one question at a time
        </p>
        <Switch
          label={oneAtATime ? 'On · one question per screen' : 'Off · one scrolling page'}
          on={oneAtATime}
          onChange={(v) => save({ oneAtATime: v })}
        />
      </section>

      {/* ── What do you ask your guests? (moved here from Details) ── */}
      <section className="flex flex-col gap-1" data-made-once="rsvp-ask">
        <p className="text-sm font-semibold text-ink">What do you ask your guests?</p>
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/5 py-2 text-sm text-ink/55">
          <span>Attending</span>
          <span className="text-xs">always</span>
        </div>
        <div className="flex flex-col">
          {RSVP_ASK_FIELDS.map((field) => (
            <Switch
              key={field}
              label={
                <>{RSVP_ASK_LABEL[field]}</>
              }
              on={rsvpAsks(local, field)}
              onChange={(v) => save({ [field]: v })}
            />
          ))}
        </div>
      </section>
      </DetailsPieceOnly>

      <DetailsPieceOnly item="rsvp" piece="who">
      {/* ── How guests get in — ONE stored setting, ONE dropdown ── */}
      {getIn}
      </DetailsPieceOnly>

      <DetailsPieceOnly item="rsvp" piece="reply-by">
      {/* ── Reply by — typed right here (no link out) ── */}
      <section className="flex flex-col gap-1" data-rsvp-setting="reply-by">
        <p className="text-sm font-semibold text-ink">Reply by</p>
        {replyBy ? (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-semibold text-ink" data-reply-by={replyBy.date}>
              {formatDay(replyBy.date)}
            </span>
            <span className="text-sm text-ink/60">{replyBy.isDefault ? '· 30 days before' : '· your date'}</span>
          </p>
        ) : (
          <p className="text-sm text-ink/60">Set your event date first.</p>
        )}
        {replyByOwn ? (
          <ReplyByField eventId={eventId} own={replyByOwn.deadline} pricingMode={replyByOwn.pricingMode} />
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

      {drafted ? (
        <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The setting a refused save put back, as the couple reads it on this page. */
function rsvpSettingName(patch: RsvpAskConfig): string {
  if ('oneAtATime' in patch) return '“Ask one question at a time”';
  if ('whoCanRsvp' in patch) return `“${GUESTS_GET_IN_LABEL}”`;
  const field = RSVP_ASK_FIELDS.find((f) => f in patch);
  return field ? `“${RSVP_ASK_LABEL[field]}”` : 'That change';
}

/** The whole config, drawn — the RSVP stage's frames lay it on the page (`maker-rsvp-stage.tsx`). */
function announceRsvpPreview(config: RsvpAskConfig): void {
  window.dispatchEvent(new CustomEvent(RSVP_PREVIEW_EVENT, { detail: config }));
}

/** The reply-by sentence, drawn — the stage lays it on the form's "Please reply by …". */
function announceReplyByLine(line: string): void {
  window.dispatchEvent(new CustomEvent(RSVP_REPLY_BY_EVENT, { detail: { line } }));
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

function DraftNote() {
  return (
    <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
      In your draft — guests see it after you Apply.
    </p>
  );
}

/**
 * ONE WORD, TYPED OR PICKED (owner 2026-09-30: *"Joyfully Accepts can be
 * renamed"* — type your own, or a premade line). The box is the couple's own
 * words; Wording ▾ drops a premade line into it. Empty = today's wording.
 * `data-rsvp-word-field` lets a tap on the canvas bring its box up.
 */
function WordField({
  wordKey,
  value,
  placeholder,
  lines,
  onChange,
}: {
  wordKey: RsvpWordKey;
  value: string;
  placeholder: string;
  lines: readonly string[];
  onChange: (text: string) => void;
}) {
  const id = useId();
  const long = RSVP_WORD_MAX[wordKey] > 80;
  return (
    <div className="flex flex-col gap-1.5" data-rsvp-word-field={wordKey}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {RSVP_WORD_LABEL[wordKey]}
        </label>
        {lines.length > 0 ? (
        <PickMenu
          label={`${RSVP_WORD_LABEL[wordKey]} — premade lines`}
          dataAttr="data-rsvp-word-lines"
          value={null}
          buttonText="Wording"
          options={lines.map((line) => ({ key: line, label: line }))}
          onPick={(line) => onChange(line)}
        />
        ) : null}
      </div>
      {long ? (
        <textarea
          id={id}
          value={value}
          rows={2}
          maxLength={RSVP_WORD_MAX[wordKey]}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          maxLength={RSVP_WORD_MAX[wordKey]}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink"
        />
      )}
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="sn-press self-start text-[12.5px] font-semibold text-ink/65 underline underline-offset-2"
        >
          Use the automatic words
        </button>
      ) : null}
    </div>
  );
}

/** "18 November 2026" from `YYYY-MM-DD`, without a timezone shift. */
function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** One on/off row — the switch the six questions have always used. */
function Switch({
  label,
  on,
  onChange,
}: {
  label: React.ReactNode;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  // `label` is usually an <InfoTip>, which renders a <button>. A <label> with
  // no `for` controls its FIRST labelable descendant — that ⓘ button — so a tap
  // on the row opened the tip instead of flipping the switch. `htmlFor` pins the
  // label to the checkbox; the ⓘ stays its own button
  // (lib/a-label-controls-its-switch.test.ts).
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-b border-ink/5 py-2 last:border-0"
    >
      <span className="flex items-center gap-1.5 text-sm text-ink">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={on}
        aria-checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors duration-sn-control ease-sn after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-sn-control after:ease-sn peer-checked:bg-terracotta-700 peer-checked:after:translate-x-5"
      />
    </label>
  );
}

/**
 * THE REPLY-BY DATE, TYPED WHERE IT IS SHOWN. `events.guest_list_edit_deadline`
 * — its ONE editor (Event settings' Pricing card no longer shows it; it only
 * posts the stored date back hidden, `lib/pax-settings-form.ts`). Saved through
 * `updatePaxSettings`, which writes the pricing view beside it, so the current
 * one is posted back unchanged. Empty = back to the default.
 * It is not drafted — the deadline is the guest list's, not the Event Hub's
 * look — so it says it saves immediately.
 */
function ReplyByField({
  eventId,
  own,
  pricingMode,
  live = false,
  fallback = null,
  action = updatePaxSettings,
}: {
  eventId: string;
  own: string | null;
  pricingMode: 'realtime' | 'final_only';
  action?: typeof updatePaxSettings;
  /** 🗳 The RSVP stage: no Save button — the date shows on the canvas at once and saves behind it. */
  live?: boolean;
  /** The 30-day default the line reads while no date of their own is set. */
  fallback?: string | null;
}) {
  if (live) return <LiveReplyByField eventId={eventId} own={own} pricingMode={pricingMode} fallback={fallback} action={action} />;
  return <SavedReplyByField eventId={eventId} own={own} pricingMode={pricingMode} />;
}

/**
 * ⚡ THE REPLY-BY DATE ON THE RSVP STAGE — on the canvas at the pick
 * (`RSVP_REPLY_BY_EVENT` → "Please reply by …" on the form), saved behind it:
 * one write after a pause (`makerLatestWrite`), `held` (no render of the Maker)
 * and `maker_quiet` (the action revalidates no path — a `revalidatePath` in an
 * action makes its answer carry a whole render of the page it was sent from).
 * A refused save puts the date back and says so.
 */
function LiveReplyByField({
  eventId,
  own,
  pricingMode,
  fallback,
  action,
}: {
  eventId: string;
  own: string | null;
  pricingMode: 'realtime' | 'final_only';
  fallback: string | null;
  action: typeof updatePaxSettings;
}) {
  const [value, setValue] = useState(own ?? '');
  const saved = useRef(own ?? '');
  const newest = useRef(0);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const shown = value || fallback;
  const pick = (next: string) => {
    setValue(next);
    setNote(null);
    announceReplyByLine(rsvpReplyByLine(next || fallback));
    const tap = ++newest.current;
    void (async () => {
      let res: { ok: boolean; message?: string } | typeof SUPERSEDED;
      try {
        res = await makerSave(
          () =>
            makerLatestWrite('events.guest_list_edit_deadline', () => {
              const fd = new FormData();
              fd.set('event_id', eventId);
              fd.set('guest_list_edit_deadline', next);
              fd.set('adaptive_pricing_mode', pricingMode);
              fd.set('maker_quiet', '1');
              return action(fd);
            }),
          requestMakerRefresh,
          { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
        );
      } catch {
        res = { ok: false, message: 'Please try again.' };
      }
      if (res === SUPERSEDED || tap !== newest.current) return;
      if (res.ok) {
        saved.current = next;
        setNote({ ok: true, text: 'Saved.' });
        return;
      }
      setValue(saved.current);
      announceReplyByLine(rsvpReplyByLine(saved.current || fallback));
      setNote({ ok: false, text: `The reply-by date did not save, so it is back as it was. ${res.message ?? ''}`.trim() });
    })();
  };
  return (
    <div className="flex flex-col gap-1.5" data-reply-by-field="live">
      {shown ? (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold text-ink" data-reply-by={shown}>
            {formatDay(shown)}
          </span>
          <span className="text-sm text-ink/60">{value ? '· your date' : '· 30 days before'}</span>
        </p>
      ) : (
        <p className="text-sm text-ink/60">Set your event date first.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => pick(e.target.value)}
          aria-label="Reply by — your own date"
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink"
        />
        {value ? (
          <button
            type="button"
            onClick={() => pick('')}
            className="sn-press inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-ink/70 underline underline-offset-2"
          >
            Use the default
          </button>
        ) : null}
      </div>
      <p className="text-xs text-ink/60">After this date your guests can no longer reply on your Event Hub.</p>
      <HubSavesImmediately />
      {note ? (
        <p role={note.ok ? 'status' : 'alert'} className={`text-[13px] ${note.ok ? 'text-success-800' : 'text-terracotta-700'}`}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}

function SavedReplyByField({
  eventId,
  own,
  pricingMode,
}: {
  eventId: string;
  own: string | null;
  pricingMode: 'realtime' | 'final_only';
}) {
  const [value, setValue] = useState(own ?? '');
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setValue(own ?? ''), [own]);
  const dirty = value !== (own ?? '');
  const saveReplyBy = () =>
    start(async () => {
      setNote(null);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('guest_list_edit_deadline', value);
      fd.set('adaptive_pricing_mode', pricingMode);
      try {
        const r = await makerSave(() => updatePaxSettings(fd), requestMakerRefresh);
        setNote(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.message });
      } catch {
        setNote({ ok: false, text: 'That did not save. Please try again.' });
      }
    });
  return (
    <div className="flex flex-col gap-1.5" data-reply-by-field="">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Reply by — your own date"
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink"
        />
        <button
          type="button"
          onClick={saveReplyBy}
          disabled={pending || !dirty}
          className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {own ? (
          <button
            type="button"
            onClick={() => setValue('')}
            disabled={pending}
            className="sn-press inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-ink/70 underline underline-offset-2"
          >
            Use the default
          </button>
        ) : null}
      </div>
      <p className="text-xs text-ink/60">After this date your guests can no longer reply on your Event Hub.</p>
      <HubSavesImmediately />
      {note ? (
        <p role={note.ok ? 'status' : 'alert'} className={`text-[13px] ${note.ok ? 'text-success-800' : 'text-terracotta-700'}`}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
