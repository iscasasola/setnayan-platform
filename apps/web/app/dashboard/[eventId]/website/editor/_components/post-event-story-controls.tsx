'use client';

/**
 * 📖🎁 POST EVENT'S TWO STORY-WIDE CONTROLS — at the top of the Post Event scene list (owner 2026-11-13, DECISION_LOG
 * "POST EVENT = A STORY (ONE SCENE PER SCREEN) — SIX CALLS SETTLED"; `post-event-story-fable.html` § 4, "Reads as"
 * above the list):
 *
 *   · Reads as   (1) Story — one scene per screen, the default — or Page, today's long page. A DRAFT like every Maker
 *                edit: posts `{ editorial: { readAs } }` through the one draft door (`hubDraftAction` intent=save),
 *                built by `lib/post-event-draft.ts`; guests see it at Apply. Free.
 *   · Peek now   (6) The couple's surprise is ON by default: the chapters' photos stay hidden from the couple until
 *                Post Event opens. This switch lets them see early — their own choice about what THEY see, so it is
 *                written at once (`hubDraftAction` intent=peek, the couple's own session), never drafted. Shown only
 *                before Post Event opens; afterwards every chapter is theirs anyway. Guests are never affected.
 *
 * One dropdown and one switch (the house kinds: any set of choices is a dropdown; on/off is a switch). What each does
 * is behind its ⓘ. A failed save is said under the row, never the look of success.
 */
import { useEffect, useState, useTransition } from 'react';
import { FormRow, FormRows, SwitchRow } from '@/app/_components/form-row';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { MERGE_BASE_FIELD } from '@/lib/merge-base-field';
import { POST_EVENT_READS_AS, POST_EVENT_READS_AS_LABEL, type PostEventArrangement, type PostEventReadsAs } from '@/lib/post-event-draft';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { PickMenu } from './pick-menu';

type DraftAction = (eventId: string, formData: FormData) => Promise<HubDraftActionResult>;
const NOT_SAVED = 'That change could not be saved. Please try again — nothing was lost.';

export function PostEventStoryControls({
  eventId,
  arrangement,
  chaptersPeek,
  dayHappened,
  draftAction,
}: {
  eventId: string;
  /** Live with the draft laid over it (`readPostEventForMaker`). */
  arrangement: PostEventArrangement;
  /** `events.chapters_peek`; null = it could not be read. */
  chaptersPeek: boolean | null;
  dayHappened: boolean;
  draftAction: DraftAction;
}) {
  const [, start] = useTransition();
  const [readAs, setReadAs] = useState<PostEventReadsAs | null>(null);
  const [peek, setPeek] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* What is drawn at once, until the Maker's fresh props say the same. */
  useEffect(() => setReadAs(null), [arrangement.readAs]);
  useEffect(() => setPeek(null), [chaptersPeek]);
  const shownReadAs = readAs ?? arrangement.readAs;
  const shownPeek = peek ?? chaptersPeek ?? false;

  /* The answer of one save: a refusal puts the drawn choice back and says why, under the row. */
  const settle = (r: HubDraftActionResult | null, undo: () => void) => {
    if (r && r.ok) return;
    undo();
    setError((r && !r.ok && r.error) || NOT_SAVED);
  };

  const pickReadsAs = (key: string) => {
    const next: PostEventReadsAs = key === 'page' ? 'page' : 'story';
    if (next === shownReadAs) return;
    setReadAs(next);
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ editorial: { readAs: next } }));
    fd.set(MERGE_BASE_FIELD, JSON.stringify({ editorial: { readAs: arrangement.readAs } }));
    setError(null);
    start(async () => {
      // one-render: keep (batched) — the Maker's one save door refreshes ONCE after the last save in flight.
      const r = await makerSave(() => draftAction(eventId, fd), requestMakerRefresh).catch(() => null);
      settle(r, () => setReadAs(null));
    });
  };

  const flipPeek = (on: boolean) => {
    setPeek(on);
    const fd = new FormData();
    fd.set('intent', 'peek');
    fd.set('on', on ? '1' : '0');
    setError(null);
    start(async () => {
      // one-render: keep (batched) — the Maker's one save door refreshes ONCE after the last save in flight.
      const r = await makerSave(() => draftAction(eventId, fd), requestMakerRefresh).catch(() => null);
      settle(r, () => setPeek(null));
    });
  };

  return (
    <div data-post-event-story-controls="" className="w-full min-w-0">
      <FormRows data="post-event-story">
        <FormRow
          data="reads-as"
          name="Reads as"
          about={{
            words:
              'Story shows one scene per screen, with bars on top — guests swipe or scroll to the next. Page is one long scroll. Saved to your draft; guests see it when you Apply.',
          }}
        >
          <PickMenu
            label="Reads as"
            dataAttr="data-post-event-reads-as"
            value={shownReadAs}
            options={POST_EVENT_READS_AS.map((k) => ({ key: k, label: POST_EVENT_READS_AS_LABEL[k] }))}
            onPick={pickReadsAs}
          />
        </FormRow>
        {!dayHappened ? (
          <SwitchRow
            data="peek"
            name="Peek now"
            line={chaptersPeek === null ? 'Could not be read just now — open the Maker again in a moment.' : shownPeek ? 'You see your chapters’ photos now.' : 'A surprise until Post Event opens.'}
            about={{
              words:
                'Your chapters’ photos stay hidden from you until the morning Post Event opens, so the story is a surprise. Turn this on to see them now. Your own shots are always yours. Guests see nothing new.',
            }}
            on={shownPeek}
            disabled={chaptersPeek === null}
            onChange={flipPeek}
            attrs={{ 'data-post-event-peek': shownPeek ? 'on' : 'off' }}
          />
        ) : null}
      </FormRows>
      {error ? (
        <p role="alert" data-post-event-story-error="" className="px-1 pt-1 text-[12.5px] font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
