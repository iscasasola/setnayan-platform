'use client';

/**
 * simple-setup-flow.tsx — the setup engine on the Get-together's one form (G1).
 *
 * /onboarding/simple stays ONE form posting to `commitSimpleEvent` (no new
 * action). This only paces it: "What do you need?" comes first (owner
 * 2026-10-08, Level 1 — `NeedsStep`, prototype frame 3: name · where · when ·
 * the preset and its rows), then — only when the person switched on more than
 * the Simple shape — the type's setup cards one per screen (the same
 * `SetupCard` the /onboarding/[type] wizard draws — never a second card), then
 * the Papic picks and the submit button. On the Simple shape the needs screen
 * IS the form: its "Make the event" submits there (matrix §0b AFTER, "ONE
 * screen"). Every step stays mounted (hidden, not unmounted), so every input
 * still posts; the cards' answers ride in ONE hidden `setup` field and the rows
 * in ONE hidden `needs` field, which the commit re-reads against the type's own
 * view (`sanitizeSetupAnswers`, `sanitizeNeeds`).
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { SetupCard } from '@/app/onboarding/_shared/setup-card';
import { NeedsStep } from '@/app/onboarding/_shared/needs-step';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  setupCardAnswered,
  setupDefaults,
  type SetupAnswers,
  type SetupCardId,
  type SetupView,
} from '@/lib/onboarding/setup-answers';
import {
  defaultPresetFor,
  limitLineFor,
  needRows,
  needsAreTheWholeOnboarding,
  needsForPreset,
  applyNeedsToSetup,
  toggleNeed,
  type EventNeeds,
  type NeedPreset,
} from '@/lib/event-needs';
import { SIMPLE_NEEDS_FIELD, SIMPLE_SETUP_FIELD } from './simple-setup-field';

type Props = {
  /** NULL = the type is not admitted to the engine: the form is yesterday's, unpaced. */
  view: SetupView | null;
  steps: SetupCardId[];
  /** Step 0 when the engine is off — the page's own name + date fields. */
  start: ReactNode;
  /** The last step — the Papic picks and the submit buttons. */
  finish: ReactNode;
  /** The type's name for the title ("New get-together"). */
  label?: string;
  /** False on a vendor-free type: no Suppliers row (`needRows`). */
  marketplace?: boolean;
};

export function SimpleSetupFlow({ view, steps, start, finish, label = 'event', marketplace = false }: Props) {
  if (!view) {
    return (
      <>
        {start}
        {finish}
      </>
    );
  }
  return <Paced view={view} steps={steps} start={start} finish={finish} label={label} marketplace={marketplace} />;
}

function Paced({ view, steps, finish, label, marketplace }: Props & { view: SetupView; label: string; marketplace: boolean }) {
  const scope = useMemo(() => ({ marketplace }), [marketplace]);
  const [answers, setAnswers] = useState<SetupAnswers>(() => setupDefaults(view));
  const [preset, setPreset] = useState<NeedPreset>(() => defaultPresetFor(view.eventType));
  const [needs, setNeeds] = useState<EventNeeds>(() => needsForPreset(defaultPresetFor(view.eventType), scope));
  const [name, setName] = useState('');
  const [when, setWhen] = useState('');
  const [step, setStep] = useState(0);
  const startRef = useRef<HTMLDivElement>(null);
  const only = needsAreTheWholeOnboarding(needs);
  // The cards the rows leave: never the place (asked on the needs screen), never "Add your guests" without a list.
  const cards = only ? [] : steps.filter((c) => c !== 'setup_where' && (needs.guestList || c !== 'setup_guests'));
  const last = cards.length + 1;
  const card = step >= 1 && step <= cards.length ? cards[step - 1]! : null;

  // What posts: the cards' answers as the needs screen leaves them (its "Where", its rows).
  const place = answers.whereText.trim();
  const posted: SetupAnswers = applyNeedsToSetup({ ...answers, where: place ? 'place' : null, whereText: place }, needs);

  function next() {
    if (step === 0) {
      // The name is required; ask the browser to say so before moving on.
      const fields = startRef.current?.querySelectorAll('input') ?? [];
      for (const f of Array.from(fields)) {
        if (!f.checkValidity()) {
          f.reportValidity();
          return;
        }
      }
    }
    setStep((s) => Math.min(last, s + 1));
  }

  return (
    <>
      <input type="hidden" name={SIMPLE_SETUP_FIELD} value={JSON.stringify(posted)} />
      <input type="hidden" name={SIMPLE_NEEDS_FIELD} value={JSON.stringify(needs)} />
      <div
        ref={startRef}
        hidden={step !== 0}
        // Enter on a field moves on instead of submitting early (the Simple shape submits from its button).
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !only) {
            e.preventDefault();
            next();
          }
        }}
      >
        <NeedsStep
          title={`New ${label.toLowerCase()}`}
          limitLine={limitLineFor(view.eventType)}
          solemn={view.solemn}
          name={name}
          onName={setName}
          where={answers.whereText}
          onWhere={(v) => setAnswers((a) => ({ ...a, whereText: v, where: v.trim() ? 'place' : null }))}
          when={only ? { value: when, onChange: setWhen } : null}
          preset={preset}
          onPreset={(p) => {
            setPreset(p);
            setNeeds(needsForPreset(p, scope));
          }}
          needs={needs}
          rows={needRows(scope)}
          onToggle={(row) => setNeeds((n) => toggleNeed(n, row, scope))}
          fieldNames={{ name: 'display_name', when: 'event_date' }}
          cta={
            only ? (
              <SubmitButton className="button-primary h-12 w-full" pendingLabel="Making…">
                Make the event
              </SubmitButton>
            ) : (
              <button type="button" className="button-primary h-12 w-full" onClick={next}>
                Continue
              </button>
            )
          }
        />
      </div>
      {card ? (
        <SetupCard
          card={card}
          view={view}
          answers={answers}
          onChange={(p) => setAnswers((a) => ({ ...a, ...p }))}
          onNext={next}
          n={step + 1}
          total={cards.length + 1}
        />
      ) : null}
      <div hidden={only || step !== last} className="space-y-6">
        {finish}
      </div>
      {!only && step > 0 && step < last ? (
        <div className="flex gap-3">
          <button type="button" className="button-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={card !== null && !setupCardAnswered(card, answers)}
            onClick={next}
          >
            Continue
          </button>
        </div>
      ) : null}
    </>
  );
}
