import Link from 'next/link';
import { formatCount } from '@/lib/format-number';
import { slotsIn } from '@/lib/emcee-lines';
import { ToolEmpty, ToolFail, ToolLine, ToolPage, ToolPin, ToolSection } from '../../_components/tool-page';
import { LineRows, type LineActivity, type LineRow, type ShownLine } from './line-rows';

/**
 * MY LINES — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 09). Look
 * only: the lines you say (text, where they match, used N×, the blanks they fill; edit + Save; Tied to + Update match;
 * Remove — now a swipe with Undo), notes to yourself ("Never reused", Remove only), the footer and its link back to
 * Clients, the empty and failed-read lines. Presentational — the page and `/dev/supplier-tools-lab` mount it.
 *
 * The three things this screen must not get wrong (owner-locked 2026-08-01) still hold: the TEMPLATE is shown, slots
 * and all; private lines are separate and labelled never-reused; editing here never touches a wedding.
 */

/** How a saved line will be found again — the rung, in his words not ours. */
export function matchedBy(line: LineRow, activityLabel: string | null): string {
  if (line.activity_id) return `Your segment · ${activityLabel ?? 'a segment of yours'}`;
  if (line.label_key) return `When a moment is called “${line.label_key}”`;
  if (line.block_type) return `Any ${line.block_type.replace(/_/g, ' ')} — only when there is just one`;
  return 'Not matched to anything yet';
}

const TIP = 'Every line you write on a wedding lands here, names blanked. The next wedding opens already written. Only you see it.';

export function LinesView({
  lines,
  activities,
  linesRead,
  error,
}: {
  lines: LineRow[];
  /** His segments — null when that read was refused (the "Tied to" picker says so). */
  activities: LineActivity[] | null;
  /** The lines read ran. */
  linesRead: boolean;
  error: string | null;
}) {
  const label = new Map((activities ?? []).map((a) => [a.activity_id, a.label]));
  const shown: ShownLine[] = lines.map((l) => ({
    ...l,
    matched: matchedBy(l, l.activity_id ? label.get(l.activity_id) ?? null : null),
    slots: slotsIn(l.body),
  }));
  const spoken = shown.filter((l) => !l.is_private_note);
  const notes = shown.filter((l) => l.is_private_note);

  return (
    <ToolPage name="lines">
      <ToolPin
        route="/vendor-dashboard/lines"
        title="My lines"
        right={linesRead ? `${formatCount(lines.length)} ${lines.length === 1 ? 'line' : 'lines'}` : undefined}
      />

      {error ? (
        <p role="alert" className="py-2 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
          {error}
        </p>
      ) : null}

      {!linesRead ? (
        <ToolSection label="Lines you say" tip={TIP} data="lines">
          <ToolFail data="lines" title="We couldn’t load your lines just now." line="They have not been deleted. Reload in a moment." retryHref="/vendor-dashboard/lines" />
        </ToolSection>
      ) : lines.length === 0 ? (
        <ToolSection label="Lines you say" tip={TIP} data="lines">
          <ToolEmpty data="lines">Nothing here yet — write your lines on your next wedding and they land here on their own.</ToolEmpty>
        </ToolSection>
      ) : null}

      {spoken.length > 0 ? (
        <ToolSection label="Lines you say" count={spoken.length} tip={TIP} data="lines-spoken">
          <LineRows lines={spoken} activities={activities} />
        </ToolSection>
      ) : null}

      {notes.length > 0 ? (
        <ToolSection
          label="Notes to yourself"
          count={notes.length}
          tip="Written on private moments, so they are kept for you but never reused on another wedding."
          data="lines-notes"
        >
          <LineRows lines={notes} activities={activities} notes />
        </ToolSection>
      ) : null}

      <ToolLine data="lines-footer">
        <span>
          Editing a line here changes what future weddings start from. It never changes a script you have already
          written for a couple —{' '}
          <Link href="/vendor-dashboard/customers" className="font-semibold text-[rgb(var(--color-link))] underline underline-offset-2">
            those stay as you left them
          </Link>
          .
        </span>
      </ToolLine>
    </ToolPage>
  );
}
