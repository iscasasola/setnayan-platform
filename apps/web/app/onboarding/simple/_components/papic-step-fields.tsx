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
 * ACTIVE catalog (SEC-4). `parseServicesStepSelection` re-shapes and bounds whatever
 * arrives before any of it is used.
 */

import { useState } from 'react';

import { ServicesStep } from '@/app/onboarding/_shared/services-step';
import type { ServicesStepView } from '@/lib/onboarding/services-step-data';
import {
  EMPTY_SERVICES_SELECTION,
  type ServicesStepSelection,
} from '@/lib/onboarding-services-selection';

// Field names live in their own boundary-free module — commitSimpleEvent reads
// exactly these, and spelling them twice is how a field silently stops posting.
import {
  PAPIC_FIELD_POOL_RUNG,
  AI_FIELD_SELECTED,
} from './papic-step-field-names';

export function PapicStepFields({
  view,
  className,
}: {
  view: ServicesStepView;
  className?: string;
}) {
  const [selection, setSelection] = useState<ServicesStepSelection>(EMPTY_SERVICES_SELECTION);

  return (
    <div className={className}>
      <ServicesStep
        view={view}
        selection={selection}
        onSelectionChange={setSelection}
      />
      {/* Empty strings rather than omitted inputs: a field that is always present
          and sometimes blank is easier to reason about server-side than one that
          appears only under some picks, and `parseServicesStepSelection` already treats
          blank as "not buying this". */}
      <input type="hidden" name={PAPIC_FIELD_POOL_RUNG} value={selection.poolRungKey ?? ''} />
      {/* The two Papic One fields (rung + camera count) are GONE, not blanked
          (owner 2026-08-11). Cameras are free and unlimited now, so there is
          nothing here to buy — and an always-empty field would leave the next
          reader hunting for the control that fills it. */}
      <input type="hidden" name={AI_FIELD_SELECTED} value={String(selection.ai)} />
    </div>
  );
}
