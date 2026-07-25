import { DressCodeFields } from '../../dress-code/_components/dress-code-fields';
import { PhotoMomentsEditor } from '../../photo-moments/_components/photo-moments-editor';
import type { DressCodeConfig } from '../../dress-code/actions';
import { SubmitButton } from '@/app/_components/submit-button';

/**
 * Authoring panels for the unified editor (PR-8) — the last multi-field
 * settings, brought inline so the couple never leaves the editor.
 *
 * Both reuse the sub-editors' OWN field components rather than re-typing them:
 * `DressCodeFields` (extracted in this PR and now rendered by both surfaces) and
 * `PhotoMomentsEditor` (already a self-contained client component). That matters
 * for correctness, not just tidiness — `updateDressCode` and `updatePhotoMoments`
 * read every field on each save, so a partial hand-written form would silently
 * wipe the lists it didn't post. Sharing the fields makes that impossible and
 * keeps the panel and the page from drifting.
 */

const PANEL = 'border-t border-dashed border-ink/10 bg-cream/40 p-3';

export function DressCodePanel({
  action,
  eventId,
  config,
  eventNoun,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  config: DressCodeConfig;
  eventNoun: string;
}) {
  return (
    <form action={action} className={PANEL}>
      <input
        type="hidden"
        name="return_to"
        value={`/dashboard/${eventId}/website/editor?open=dress-code`}
      />
      <DressCodeFields config={config} eventNoun={eventNoun} compact />
      <SubmitButton
        pendingLabel="Saving…"
        className="mt-3 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink/90"
      >
        Save
      </SubmitButton>
    </form>
  );
}

/**
 * Photo moments — the client editor owns its own form + submit (it manages a
 * dynamic list), so the panel is just its container. It posts to the same
 * `updatePhotoMoments` action as the sub-page.
 */
export function PhotoMomentsPanel({
  eventId,
  initial,
}: {
  eventId: string;
  initial: React.ComponentProps<typeof PhotoMomentsEditor>['initial'];
}) {
  return (
    <div className={PANEL}>
      <PhotoMomentsEditor eventId={eventId} initial={initial} />
    </div>
  );
}
