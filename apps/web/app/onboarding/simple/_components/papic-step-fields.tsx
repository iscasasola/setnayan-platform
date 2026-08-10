'use client';

/**
 * The Papic picker for `/onboarding/simple` (owner 2026-08-11).
 *
 * ── WHY THIS WRAPPER EXISTS ────────────────────────────────────────────────
 * The other two onboarding flows are CLIENT wizards: they hold the selection in
 * React state and hand it to a server action as an argument. `/onboarding/simple`
 * is not a wizard at all — it is a single server-rendered `<form>` posting
 * FormData to `commitSimpleEvent`. So the selection has to reach the server the
 * way every other field on that page does: as form inputs.
 *
 * This component is the whole adapter. It owns the state, renders the shared
 * `ServicesStep` in its interactive mode, and mirrors the result into three
 * hidden inputs. It must be rendered INSIDE the form — outside it the inputs
 * post nothing and the picker becomes a fake door, which is exactly the failure
 * the step's own docblock warns about.
 *
 * ⚠ THE HIDDEN INPUTS ARE A CLAIM, NOT A PRICE. They carry two service_codes
 * and a count. No amount is posted, and none would be trusted: the server
 * re-resolves every rung from the live tier tables and every price from the
 * ACTIVE catalog (SEC-4). `parsePapicSelection` re-shapes and bounds whatever
 * arrives before any of it is used.
 */

import { useState } from 'react';

import { ServicesStep } from '@/app/onboarding/_shared/services-step';
import type { ServicesStepView } from '@/lib/onboarding/services-step-data';
import {
  EMPTY_PAPIC_SELECTION,
  type PapicSelection,
} from '@/lib/papic-onboarding-selection';

// Field names live in their own boundary-free module — commitSimpleEvent reads
// exactly these, and spelling them twice is how a field silently stops posting.
import {
  PAPIC_FIELD_ONE_CAMERAS,
  PAPIC_FIELD_ONE_RUNG,
  PAPIC_FIELD_POOL_RUNG,
} from './papic-step-field-names';

export function PapicStepFields({
  view,
  className,
}: {
  view: ServicesStepView;
  className?: string;
}) {
  const [selection, setSelection] = useState<PapicSelection>(EMPTY_PAPIC_SELECTION);

  return (
    <div className={className}>
      <ServicesStep
        view={view}
        selection={selection}
        onSelectionChange={setSelection}
      />
      {/* Empty strings rather than omitted inputs: a field that is always present
          and sometimes blank is easier to reason about server-side than one that
          appears only under some picks, and `parsePapicSelection` already treats
          blank as "not buying this". */}
      <input type="hidden" name={PAPIC_FIELD_POOL_RUNG} value={selection.poolRungKey ?? ''} />
      <input type="hidden" name={PAPIC_FIELD_ONE_RUNG} value={selection.oneRungKey ?? ''} />
      <input
        type="hidden"
        name={PAPIC_FIELD_ONE_CAMERAS}
        value={String(selection.oneExtraCameras)}
      />
    </div>
  );
}
