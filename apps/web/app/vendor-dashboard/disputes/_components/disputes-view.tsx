import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { relativeTime } from '@/lib/activity';
import { formatCount } from '@/lib/format-number';
import type { Paged } from '@/lib/paginate';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { SubmitButton } from '@/app/_components/submit-button';
import { ListPager } from '../../_components/list-pager';
import { ToolChip, ToolEmpty, ToolFail, ToolPage, ToolPin, ToolSection, type ToolChipTone } from '../../_components/tool-page';
import { submitDisputeContest } from '../actions';

/**
 * Disputes — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 06). Look only:
 * category, ID, filed time, status, contest / edit while open (2,000 characters), the team's decision once ruled, the
 * pager and the partial / failed-read notices are the shipped page's. Presentational — the page and
 * `/dev/supplier-tools-lab` mount it.
 */
export type DisputeRow = {
  dispute_id: string;
  public_id: string;
  category:
    | 'no_show'
    | 'late_arrival'
    | 'quality_issue'
    | 'communication'
    | 'refund_request'
    | 'other';
  description: string;
  status: 'open' | 'resolved_for_vendor' | 'resolved_for_couple' | 'withdrawn';
  resolved_at: string | null;
  resolution_notes: string | null;
  counts_toward_demotion: boolean;
  vendor_contest: string | null;
  vendor_contested_at: string | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<DisputeRow['category'], string> = {
  no_show: 'No-show',
  late_arrival: 'Late arrival',
  quality_issue: 'Quality issue',
  communication: 'Communication',
  refund_request: 'Refund request',
  other: 'Other',
};

const STATUS_LABEL: Record<DisputeRow['status'], string> = {
  open: 'Under review',
  resolved_for_vendor: 'Resolved · in your favor',
  resolved_for_couple: 'Resolved · for the couple',
  withdrawn: 'Withdrawn',
};

const STATUS_TONE: Record<DisputeRow['status'], ToolChipTone> = {
  open: 'wait',
  resolved_for_vendor: 'ok',
  resolved_for_couple: 'info',
  withdrawn: 'quiet',
};

export function DisputesView({
  rows,
  incomplete,
  paged,
  keepParams,
}: {
  rows: DisputeRow[];
  /** The read did not reach the end — some (or all) disputes are missing. */
  incomplete: boolean;
  paged: Paged<DisputeRow>;
  keepParams: string;
}) {
  const openCount = rows.filter((r) => r.status === 'open').length;
  return (
    <ToolPage name="disputes">
      {/* The redraw (v3, 21 Nov): the scales icon, the two-sentence intro and the green box became ONE line + ⓘ under
          the pinned row; "N disputes are under review." is the chip at the row's right. Every word is kept in the ⓘ. */}
      <ToolPin
        route="/vendor-dashboard/disputes"
        title="Disputes"
        right={openCount > 0 ? <ToolChip tone="wait">{formatCount(openCount)} under review</ToolChip> : null}
        sub={
          <>
            <ShieldCheck aria-hidden className="h-4 w-4 flex-none" style={{ color: 'rgb(var(--color-ok))' }} strokeWidth={1.8} />
            <InfoTip label="An open dispute does not count against you." align="start">
              Stand up for yourself. If a couple raises a concern about a booking, a neutral Setnayan team reviews the
              record first — and you get to add your side before anything is decided. An open dispute is under review
              only — it does not count against your rating or listing unless the team resolves it in the couple&rsquo;s
              favor. Add your side below while it&rsquo;s still open.
            </InfoTip>
          </>
        }
      />

      <ToolSection label="Your disputes" count={rows.length > 0 ? rows.length : undefined} data="disputes">
        {incomplete ? (
          rows.length === 0 ? (
            <ToolFail data="disputes" title="Your disputes couldn’t load right now." line="Refresh in a moment." />
          ) : (
            <ToolFail
              data="disputes"
              title="Some of your disputes couldn’t load right now."
              line="This list may be missing some. Refresh in a moment."
            />
          )
        ) : null}

        {rows.length === 0 && !incomplete ? (
          <ToolEmpty data="disputes">
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 flex-none" style={{ color: 'rgb(var(--color-ok))' }} strokeWidth={1.8} />
            <span>No disputes — nice work. If a couple ever raises one, the team reviews it first.</span>
          </ToolEmpty>
        ) : rows.length > 0 ? (
          <>
            <ul id="disputes-list" className="sn-frame scroll-mt-24 px-4 py-1">
              {paged.items.map((r) => (
                <DisputeRowItem key={r.dispute_id} row={r} />
              ))}
            </ul>
            <ListPager
              paged={paged}
              param="dpage"
              keepParams={keepParams}
              hash="disputes-list"
              noun="disputes"
            />
          </>
        ) : null}
      </ToolSection>
    </ToolPage>
  );
}


/**
 * One dispute — a row that opens in place (the shared `Fold`: one open at a time). Shut: its category, ID · when it was
 * filed, its status chip. Open: what the couple wrote; while open, your response and its box; once ruled, the team's
 * decision and notes.
 */
function DisputeRowItem({ row }: { row: DisputeRow }) {
  const isOpen = row.status === 'open';
  return (
    <li>
      <Fold
        title={CATEGORY_LABEL[row.category]}
        line={`${row.public_id} · Filed ${relativeTime(row.created_at)}`}
        aside={<ToolChip tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</ToolChip>}
        data="dispute"
      >
        <div className="flex flex-col gap-2.5 pb-4 pt-1">
          <p className="whitespace-pre-wrap text-[14px] text-ink">{row.description}</p>

          {/* Resolution outcome, once the team has ruled */}
          {!isOpen ? (
            <div>
              <p className="text-[15px] font-bold text-ink">
                Team decision
                {row.resolved_at ? (
                  <span className="text-[13px] font-normal text-[color:var(--m-slate-2)]"> · {relativeTime(row.resolved_at)}</span>
                ) : null}
              </p>
              <p className="mt-1 text-[14px] text-ink">{STATUS_LABEL[row.status]}</p>
              {row.resolution_notes ? (
                <p className="mt-1 whitespace-pre-wrap text-[14px] text-[color:var(--m-slate-2)]">{row.resolution_notes}</p>
              ) : null}
            </div>
          ) : null}

          {/* The vendor's contest, if written — read-only once the team has ruled */}
          {row.vendor_contest && !isOpen ? (
            <div>
              <p className="text-[15px] font-bold text-ink">
                Your response
                {row.vendor_contested_at ? (
                  <span className="text-[13px] font-normal text-[color:var(--m-slate-2)]"> · {relativeTime(row.vendor_contested_at)}</span>
                ) : null}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink">{row.vendor_contest}</p>
            </div>
          ) : null}

          {/* Contest form — only while the dispute is open; the box holds your response so far */}
          {isOpen ? (
            <form action={submitDisputeContest} className="flex flex-col gap-2.5">
              <input type="hidden" name="dispute_id" value={row.dispute_id} />
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-bold text-ink">
                  Your response
                  {row.vendor_contested_at ? (
                    <span className="text-[13px] font-normal text-[color:var(--m-slate-2)]"> · {relativeTime(row.vendor_contested_at)}</span>
                  ) : null}
                </span>
                <textarea
                  name="vendor_contest"
                  rows={4}
                  required
                  maxLength={2000}
                  defaultValue={row.vendor_contest ?? ''}
                  placeholder="Explain what happened from your side. The Setnayan team reads this before making any decision — attach dates, messages, or delivery proof you can reference."
                  className="input-field w-full rounded-[22px] text-[15px]"
                  aria-label="Your response to this dispute"
                />
              </label>
              <p className="text-[14px] text-[color:var(--m-slate-2)]">
                The team reads this before deciding. You can edit it until they rule.
              </p>
              <div>
                <SubmitButton pendingLabel="Submitting…" className="button-primary text-sm">
                  {row.vendor_contest ? 'Update my response' : 'Submit my response'}
                </SubmitButton>
              </div>
            </form>
          ) : null}
        </div>
      </Fold>
    </li>
  );
}
