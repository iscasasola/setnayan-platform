import { PrintSaveButton } from '@/app/dashboard/[eventId]/launch/_components/print-save-button';
import { SharePdfButton } from '@/app/_components/share-pdf-button';

/**
 * Budget's files, at the top of the page (the masthead's actions): ONE 📤 Share for the budget (the shared
 * `SharePdfButton`, with `Paper ▾` A4 · Letter · Long bond) — a PDF handed to the
 * phone's share sheet (Print, Files, AirDrop, Messages, Viber…) or downloaded on a computer with Print beside it (owner
 * 2026-10-29, "Print Budget can be just a share button if it has the print and share there as well") — then the
 * spreadsheet and the calendar file, on the same template and the same save (`usePrintSave`): every file is SAVED,
 * never shown in place (owner 2026-10-27).
 *
 * Its own component so `/dev/budget-lab` draws the page's REAL actions, not a copy.
 *
 * `moneyAnswered` false → no Share and no spreadsheet: the route can only say "try again" then, so the buttons would
 * be a promise the page already knows it cannot keep. The calendar file reads its own rows and stays.
 */
export function BudgetFileActions({ eventId, fileSlug, moneyAnswered }: { eventId: string; fileSlug: string; moneyAnswered: boolean }) {
  return (
    <div className="flex flex-wrap items-start gap-2" data-budget-files="">
      {moneyAnswered ? (
        <>
          <SharePdfButton
            href={`/api/budget/${eventId}/export?format=pdf`}
            fileName={`setnayan-${fileSlug}-budget.pdf`}
            name="Share your budget (PDF)"
            papers="document"
          />
          <PrintSaveButton
            variant="action"
            quiet
            href={`/api/budget/${eventId}/export?format=csv`}
            file={`setnayan-${fileSlug}-budget.csv`}
            label="Spreadsheet (.csv)"
          />
        </>
      ) : null}
      <PrintSaveButton
        variant="action"
        quiet
        href={`/api/budget/${eventId}/ics`}
        file={`setnayan-${fileSlug}-budget.ics`}
        label="Upcoming dates (.ics)"
      />
    </div>
  );
}
