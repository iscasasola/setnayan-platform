import { InfoTip } from '@/app/_components/info-tip';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';

/**
 * THE TWO MARKS EVERY EVENT HUB MAKER FORM CARRIES — exactly one of them.
 *
 *   <form action={setWidgetMotion}><HubDraftField /> … </form>
 *       → the writer diverts to the draft (`isHubDraftWrite`). Guests see
 *         nothing until Apply.
 *
 *   <form action={updateSiteColors}><HubSavesImmediately /> … </form>
 *       → this writer has no draft door (yet). The couple is TOLD, on the page,
 *         that it goes straight to their live Event Hub.
 *
 * Owner 2026-09-25: the host edits a PUBLIC page; work in progress must never
 * reach a guest silently. A live write is allowed only when it says so.
 * `lib/every-maker-form-drafts-or-says-so.test.ts` holds every form rendered
 * inside the Maker to one mark or the other, with a reason for each live one.
 *
 * 🔑 NO `'use client'`, NO SERVER IMPORTS. Server panels (`sections-panel.tsx`)
 * and client panels (`pro-panels.tsx`) both render these, and render tests load
 * those panels under `tsx` — so this module pulls in nothing but the pure draft
 * constants and the one `(i)`. (`hub-draft-bar.tsx` imports the server action and
 * the Maker context; importing THAT from a panel would drag both into every
 * test that renders one.)
 */

/** The hidden field that sends an existing Event Hub form's save to the draft. */
export function HubDraftField() {
  return <input type="hidden" name={HUB_DRAFT_FIELD} value="1" />;
}

/**
 * "Saves immediately ⓘ" — beside a control whose writer is NOT in the draft.
 * The words are on the page (a consequence is never hidden behind the `(i)`);
 * the tip explains that Apply, Undo and Restore do not cover it.
 */
export function HubSavesImmediately({ className }: { className?: string }) {
  return (
    <span
      data-hub-saves-immediately=""
      className={`inline-flex text-[11.5px] font-medium text-terracotta-700${className ? ` ${className}` : ''}`}
    >
      <InfoTip label="Saves immediately" align="start">
        This goes straight to your live Event Hub — guests see it as soon as you save. It is not part
        of your draft, so Apply, Undo and Restore do not cover it.
      </InfoTip>
    </span>
  );
}
