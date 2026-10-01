'use client';

/**
 * simple-setup-flow.tsx — the setup engine on the Get-together's one form (G1).
 *
 * /onboarding/simple stays ONE form posting to `commitSimpleEvent` (no new
 * action). This only paces it: the name + date the page renders come first,
 * then the type's setup cards one per screen (the same `SetupCard` the
 * /onboarding/[type] wizard draws — never a second card), then the Papic picks
 * and the submit button. Every step stays mounted (hidden, not unmounted), so
 * every input still posts; the cards' answers ride in ONE hidden `setup` field,
 * which the commit re-reads against the type's own view (`sanitizeSetupAnswers`).
 */

import { useRef, useState, type ReactNode } from 'react';
import { SetupCard } from '@/app/onboarding/_shared/setup-card';
import {
  setupCardAnswered,
  setupDefaults,
  type SetupAnswers,
  type SetupCardId,
  type SetupView,
} from '@/lib/onboarding/setup-answers';
import { SIMPLE_SETUP_FIELD } from './simple-setup-field';

type Props = {
  /** NULL = the type is not admitted to the engine: the form is yesterday's, unpaced. */
  view: SetupView | null;
  steps: SetupCardId[];
  /** Step 0 — the page's own name + date fields. */
  start: ReactNode;
  /** The last step — the Papic picks and the submit buttons. */
  finish: ReactNode;
};

export function SimpleSetupFlow({ view, steps, start, finish }: Props) {
  if (!view) {
    return (
      <>
        {start}
        {finish}
      </>
    );
  }
  return <Paced view={view} steps={steps} start={start} finish={finish} />;
}

function Paced({ view, steps, start, finish }: Props & { view: SetupView }) {
  const [answers, setAnswers] = useState<SetupAnswers>(() => setupDefaults(view));
  const [step, setStep] = useState(0);
  const startRef = useRef<HTMLDivElement>(null);
  const last = steps.length + 1;
  const card = step >= 1 && step <= steps.length ? steps[step - 1]! : null;

  function next() {
    if (step === 0) {
      // The name and date are required; ask the browser to say so before moving on.
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
      <input type="hidden" name={SIMPLE_SETUP_FIELD} value={JSON.stringify(answers)} />
      <div
        ref={startRef}
        hidden={step !== 0}
        className="space-y-6"
        // Enter on the name moves on to the cards instead of submitting early.
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            next();
          }
        }}
      >
        {start}
      </div>
      {card ? (
        <SetupCard
          card={card}
          view={view}
          answers={answers}
          onChange={(patch) => setAnswers((a) => ({ ...a, ...patch }))}
          onNext={next}
          n={step + 1}
          total={steps.length + 1}
        />
      ) : null}
      <div hidden={step !== last} className="space-y-6">
        {finish}
      </div>
      {step < last ? (
        <div className="flex gap-3">
          {step > 0 ? (
            <button type="button" className="button-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </button>
          ) : null}
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
