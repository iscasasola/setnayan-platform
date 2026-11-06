'use client';

import { DressCodeFields } from '../../../studio/mood-board/_components/dress-code-fields';
import { IncDressCodeStarterNote } from '../../../studio/mood-board/_components/inc-dress-code-starter-note';
import type { DressCodeConfig } from '../../../studio/mood-board/dress-code-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { HubDraftField } from '../../_components/hub-draft-field';
import { SafeForm } from '@/app/dashboard/[eventId]/_components/safe-form';

/**
 * 👗 THE MAKER'S DRESS CODE PANEL — the whole form (fields + Save), moved out of `authoring-panels.tsx`
 * unchanged (2026-10-21, Maker headroom).
 *
 * WHY ITS OWN CLIENT FILE: the Dress code row's panel draws only when that row is opened, yet its fields
 * (`GroupAttireField` · `RoleAttireField` and the attire tables, ~8.6KB gz) rode the Maker's first load,
 * which sat over its 507KB ceiling (`scripts/check-maker-js-budget.mjs`). As a client module it can be
 * reached through `next/dynamic` — `website/editor/page.tsx` imports the `DressCodePanel` stand-in from
 * `launch/_components/details-lazy.tsx` (chunk `maker-details`, warmed at idle with the rest).
 * 🔑 It moves as a WHOLE panel — the form, every field and its Save — so a panel that has not arrived is
 * a slot, never half a form: `updateDressCode` reads every field on each save.
 */

const PANEL = 'border-t border-dashed border-ink/10 bg-cream/40 p-3';

export function DressCodePanel({
  action,
  eventId,
  config,
  eventNoun,
  eventRoles = [],
  incStarter = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  config: DressCodeConfig;
  eventNoun: string;
  /** `config` holds the INC starter guidance, not a saved answer (`incDressCodeStarter`). */
  incStarter?: boolean;
  /** The roles on this event's guest list — so each role's outfit is set right here. */
  eventRoles?: React.ComponentProps<typeof DressCodeFields>['eventRoles'];
}) {
  return (
    <SafeForm action={action} className={PANEL}>
      <HubDraftField />
      <input
        type="hidden"
        name="return_to"
        value={`/dashboard/${eventId}/website/editor?open=dress-code`}
      />
      {incStarter ? (
        <div className="mb-3">
          <IncDressCodeStarterNote />
        </div>
      ) : null}
      <DressCodeFields config={config} eventNoun={eventNoun} eventRoles={eventRoles} compact />
      <SubmitButton
        pendingLabel="Saving…"
        className="mt-3 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink/90"
      >
        Save
      </SubmitButton>
    </SafeForm>
  );
}
