'use client';

import { useActionState, useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { ArrowRight, Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { supplierPlanExtra, type PlanExtraResult } from '@/app/vendor-dashboard/plan-extras-actions';
import { IN_OUR_WORDS, OUR_STORY_LINK, STORY_NOTE_MAX } from '@/lib/ultra-story-pages';

/**
 * 📖 "IN OUR WORDS" — an Ultra shop's own note for one published celebration (owner 2026-11-14, item 8: *"Decided:
 * the shop writes its own short 'In our words' note"*). It shows on the shop's page for that event; a blank save
 * removes it. Drawn under the story's row in Shop › Promote › Share your work — the one place the shop's published
 * stories already live — with a link to the page itself.
 */
export function StoryNoteForm({ eventId, initial, pageHref }: { eventId: string; initial: string; pageHref: string }) {
  const [state, action, pending] = useActionState<PlanExtraResult | null, FormData>(supplierPlanExtra, null);
  const [note, setNote] = useState(initial);
  return (
    <form action={action} className="mt-2 space-y-2 pb-1" data-story-note-form="">
      <input type="hidden" name="op" value="story_note" />
      <input type="hidden" name="event_id" value={eventId} />
      <FormRows>
        <TypedRow name={IN_OUR_WORDS} value={note} empty="Add a line or two" long boxed maxLength={STORY_NOTE_MAX} fieldName="body" onKeep={(t) => setNote(t)} data="story-note" />
      </FormRows>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          tone="ok"
          type="submit"
          waiting={pending}
          icon={<Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
          label="Save note"
        />
        <a href={pageHref} className="sn-press inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-sn-accent" data-story-page-link="">
          {OUR_STORY_LINK}
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </a>
      </div>
      {state ? (
        <p role={state.ok ? 'status' : 'alert'} className={`text-[13px] ${state.ok ? 'text-success-900' : 'text-danger-700'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
