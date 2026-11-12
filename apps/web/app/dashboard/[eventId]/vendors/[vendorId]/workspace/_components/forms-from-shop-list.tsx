import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import type { sentFormState } from '@/lib/vendor-forms';

/**
 * 📋 "Forms from <shop>" — ONE list of every form the shop sent, open ones first, each with its state; a row jumps to its
 * form below. Pure drawing (no reads), so the dev lab draws the same list (`/dev/forms-lab?m=couple-list`).
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
      <ul className="space-y-2">
        {rows.map(({ formId, title, state: st }) => (
          <li key={formId}>
            <a
              href={`#form-${formId}`}
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3.5 py-2.5"
              data-forms-from-row={st.key}
            >
              <span className="min-w-0 truncate text-[15px] font-medium text-ink">{title}</span>
              <span
                className={`flex-none rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                  st.key === 'open' || st.key === 'some' ? 'bg-warn-100 text-warn-900' : 'bg-success-100 text-success-800'
                }`}
              >
                {st.words}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
