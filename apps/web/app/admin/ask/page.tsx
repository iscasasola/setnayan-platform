/**
 * /admin/ask — "What can I ask?" (owner approved 14 Nov 2026, DECISION_LOG "ADMIN FOCUS | FULL — APPROVED (v6)" (3);
 * prototype M2EWM32A9Y9LrJBsYXgagq, "Cheat sheet" + "The A4 page"). Opened from the ? at the end of the ask box, the
 * last suggestion in the ask panel, and the avatar menu. Download lives here: one A4 page that prints as is.
 *
 * 🔑 IT LISTS ONLY WHAT THE BOX DOES TODAY. Every row below is answered by the shipped search — pages by their words
 * (`lib/admin-map`), records by name, shop, person or order code (`lib/ugat/data.ts` `ugatSearch`). The drawing also
 * draws a shop summary, an address search and a progress card; those are not built yet, and a cheat sheet that
 * promised them would send the admin to a search that finds nothing.
 */
import { requireAdmin } from '@/lib/admin/require-admin';
import { PrintButton } from './print-button';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'What can I ask? · Admin' };

const ROWS: ReadonlyArray<{ type: string; get: string }> = [
  { type: '“refunds”, “fees owed”, “prices”', get: 'That page' },
  { type: '“disputes”, “verify”, “payouts”', get: 'That list' },
  { type: '“Liwanag”, a shop’s link name', get: 'The shop' },
  { type: '“Bea Santos”, an email', get: 'The person' },
  { type: 'A wedding’s name', get: 'The event' },
  { type: 'An order code', get: 'The order' },
];

export default async function AdminAskPage() {
  await requireAdmin();
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-5 print:max-w-none print:p-0" data-admin-ask-sheet>
      <PageMasthead title="What can I ask?" />

      <dl className="mt-3 grid grid-cols-[1fr_auto] text-[14.5px] print:hidden">
        <dt className="py-2 pr-3 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--sn-ink-500)]">You type</dt>
        <dd className="py-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--sn-ink-500)]">You get</dd>
        {ROWS.map((r) => (
          <div key={r.type} className="contents">
            <dt className="border-t py-2.5 pr-3 text-[color:var(--sn-ink-900)]" style={{ borderColor: 'var(--sn-line)' }}>
              {r.type}
            </dt>
            <dd className="border-t py-2.5 font-semibold text-[color:var(--sn-ink-900)]" style={{ borderColor: 'var(--sn-line)' }}>
              {r.get}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 print:hidden">
        <PrintButton />
      </div>

      {/* The A4 page — what Download saves. Shown only in print. */}
      <section className="hidden print:flex print:flex-col print:gap-3 print:p-10" aria-label="The A4 page">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]">SETNAYAN · Admin</p>
        <h2 className="text-[18px] font-bold">What you can ask the admin box</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[13px]">
          <li>Go to a page. Type its name: refunds, prices, disputes.</li>
          <li>Look something up. A name, a shop, an email, an order code.</li>
        </ol>
        <dl className="mt-2 grid grid-cols-[1fr_auto] text-[12.5px]">
          {ROWS.map((r) => (
            <div key={r.type} className="contents">
              <dt className="border-t py-1.5 pr-3">{r.type}</dt>
              <dd className="border-t py-1.5 font-semibold">{r.get}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[10px]">One A4 page · prints as is</p>
      </section>
    </div>
  );
}
