import { INC_DRESS_CODE_STARTER_NOTE } from './inc-dress-code-starter';

/**
 * The one-line note above a dress-code form that `incDressCodeStarter`
 * pre-filled — the same words on the Mood Board and in the Maker.
 */
export function IncDressCodeStarterNote() {
  return (
    <p
      role="note"
      data-inc-dress-code-starter=""
      className="rounded-md border border-terracotta/30 bg-terracotta-50/60 px-3 py-2 text-sm text-ink/75"
    >
      {INC_DRESS_CODE_STARTER_NOTE}
    </p>
  );
}
