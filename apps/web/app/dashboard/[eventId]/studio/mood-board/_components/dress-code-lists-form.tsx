import { ListField } from './list-field';
import { updateDressCodeLists } from '../dress-code-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { HubDraftField } from '../../../website/_components/hub-draft-field';
import { IncDressCodeStarterNote } from './inc-dress-code-starter-note';

/**
 * ✅ THE DO'S AND DON'TS, ON THE MOOD BOARD (owner 2026-09-30: *"do's and
 * don'ts should be on the mood board as well"*).
 *
 * The SAME two `ListField`s the Dress code editor draws, over the SAME stored
 * lists (`events.dress_code_config.dos` / `.donts`) — the guest's dress-code
 * scene reads nothing else. Saved by `updateDressCodeLists`, which replaces the
 * two lists and keeps every other part of the dress code as stored.
 *
 * `inMaker`: the form carries `HubDraftField`, so the lists save into the
 * couple's draft beside the Dress code scene's own saves (the Maker's shell
 * fills in where to land). On the Mood Board's own page they save live.
 */
export function DressCodeListsForm({
  eventId,
  dos,
  donts,
  inMaker,
  incStarter = false,
}: {
  eventId: string;
  dos: string[];
  donts: string[];
  inMaker: boolean;
  /** The lists hold the INC starter guidance, not a saved answer (`incDressCodeStarter`). */
  incStarter?: boolean;
}) {
  return (
    <section id="dos-and-donts" className="scroll-mt-24 space-y-4" data-mood-board-dress-lists="">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-ink">Do&rsquo;s and don&rsquo;ts</h2>
        <p className="max-w-prose text-sm text-ink/65">
          What guests read under your dress code. The same list as the Dress code scene — change it in
          either place.
        </p>
      </header>
      {incStarter ? <IncDressCodeStarterNote /> : null}
      <form action={updateDressCodeLists.bind(null, eventId)} className="space-y-4">
        {inMaker ? (
          <HubDraftField />
        ) : (
          <input type="hidden" name="return_to" value={`/dashboard/${eventId}/studio/mood-board`} />
        )}
        <div className="space-y-1.5" data-dress-code-list="dos">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-success-700">Do</p>
          {/* Keyed on the saved list: a save made in the Dress code scene
              redraws these rows instead of leaving the old ones to be saved back. */}
          <ListField key={dos.join('\u0001')} name="dos" tone="do" initial={dos} />
        </div>
        <div className="space-y-1.5" data-dress-code-list="donts">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-danger-700">Don&rsquo;t</p>
          <ListField key={donts.join('\u0001')} name="donts" tone="dont" initial={donts} />
        </div>
        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-cream transition-colors hover:bg-ink/90"
        >
          Save
        </SubmitButton>
      </form>
    </section>
  );
}
