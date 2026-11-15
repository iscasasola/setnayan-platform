import { ChevronRight } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import type { sentFormState } from '@/lib/vendor-forms';

/**
 * 📋 "Forms from <shop>" — ONE list of every form the shop sent, open ones first, each with its state; a row jumps to its
 * form below. 📐 Design template (14 Nov 2026, rules 2 · 5): plain hairline rows with a terracotta ›, the state a soft
 * chip. Pure drawing (no reads), so the dev lab draws the same list (`/dev/forms-lab?m=couple-list`).
 */
export function FormsFromShopList({
  shopName,
  rows,
}: {
  shopName: string;
  rows: { formId: string; title: string; state: ReturnType<typeof sentFormState> }[];
}) {
  return (
    <section className="space-y-2" aria-label={`Forms from ${shopName}`} data-forms-from-shop>
      <InfoTip label={`Forms from ${shopName} · ${formatCount(rows.length)}`} labelAs="p" labelClassName="text-[17px] font-semibold text-ink" align="start">
        From {shopName}. Only the two of you and {shopName} read your answers.
      </InfoTip>
      <ul className="divide-y divide-ink/10">
        {rows.map(({ formId, title, state: st }) => (
          <li key={formId}>
            <a
              href={`#form-${formId}`}
              className="flex min-h-14 items-center justify-between gap-3 py-2.5"
              data-forms-from-row={st.key}
            >
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{title}</span>
              <Badge tone={st.key === 'open' || st.key === 'some' ? 'wait' : 'ok'}>{st.words}</Badge>
              <ChevronRight aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={1.75} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
