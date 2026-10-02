/**
 * request-row.tsx — one supplier category request, as a ghost row: what they
 * typed, the drafted proposal, then the three answers.
 *
 * ⚠ THE NEAR-MATCHES SIT ABOVE THE BUTTONS, NEVER BELOW THEM. A queue with a
 * suggestion attached is a queue people stop reading; the person in the
 * middle is only there if the alternatives are met before the button is in
 * reach. Pinned by near-matches-sit-above-the-button.test.ts.
 */
import type { RequestDraft, SupplierRequest } from './model';
import type { Choice } from './pickers';
import { DeclinePick, MapToPick, PromoteRequestForm } from './request-controls';

/**
 * The drafted proposal (C4, 2026-08-28). ⛔ IT PRESSES NOTHING AND OFFERS NO
 * CONTROL OF ITS OWN — text a reviewer reads before choosing an answer.
 */
export function RequestDraftNotes({ draft }: { draft: RequestDraft | null }) {
  if (!draft) return null;
  return (
    <div className="space-y-1.5 rounded-xl bg-cream/70 p-3 text-sm text-ink">
      {draft.verdict === 'existing' && draft.closestExisting ? (
        <p className="font-semibold">
          We think we already have this — {draft.closestExisting.label}. Map it rather than adding a second name for
          the same trade.
        </p>
      ) : draft.nearMatches.length === 0 ? (
        <p className="font-semibold">Nothing we have means this. That is a reason to look harder, not a reason to add it.</p>
      ) : null}
      {draft.nearMatches.length > 0 ? (
        <ul className="space-y-0.5">
          {draft.nearMatches.map((m) => (
            <li key={m.canonical}>
              <span className="font-medium">{m.label}</span> — {m.whyNot}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-ink/70">
        {draft.suggestedTileLabel
          ? `suggested place: ${draft.suggestedTileLabel}${draft.tileReason ? ` — ${draft.tileReason}` : ''} · the weakest part of any draft, check it`
          : 'no place suggested — you place this one'}
        {` · drafted by ${draft.draftedBy} · a suggestion, not a decision`}
      </p>
    </div>
  );
}

export function RequestRow({
  request,
  targets,
  categories,
  back,
}: {
  request: SupplierRequest;
  targets: ReadonlyArray<{ canonical: string; label: string; closest: boolean }>;
  categories: readonly Choice[];
  back: Record<string, string>;
}) {
  const draft = request.draft;
  return (
    <li id={`req-${request.requestId}`} className="space-y-2 rounded-2xl border border-dashed border-sky-300 bg-sky-50/40 p-3" data-request-row="">
      <p className="text-sm text-ink">
        <span className="font-semibold">“{request.proposedLabel}”</span> from {request.supplierName}
        {request.proposedNote ? <span className="text-ink/70"> · “{request.proposedNote}”</span> : null}
      </p>
      <RequestDraftNotes draft={draft} />
      <div className="flex flex-wrap items-end gap-2">
        <PromoteRequestForm
          requestId={request.requestId}
          defaultLabel={draft?.suggestedLabel ?? request.proposedLabel}
          suggestedTileId={draft?.suggestedTileId ?? null}
          categories={categories}
          back={back}
        />
        <MapToPick requestId={request.requestId} targets={targets} back={back} />
        <DeclinePick requestId={request.requestId} back={back} />
      </div>
    </li>
  );
}
