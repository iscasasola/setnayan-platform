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
      <h1 className="text-[22px] font-bold tracking-tight text-[color:var(--sn-ink-900)] print:hidden">What can I ask?</h1>

      <table className="mt-3 w-full text-left text-[14.5px] print:hidden">
        <thead>
          <tr className="text-[12px] uppercase tracking-wider text-[color:var(--sn-ink-500)]">
            <th className="py-2 pr-3 font-semibold">You type</th>
            <th className="py-2 font-semibold">You get</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.type} className="border-t" style={{ borderColor: 'var(--sn-line)' }}>
              <td className="py-2.5 pr-3 text-[color:var(--sn-ink-900)]">{r.type}</td>
              <td className="py-2.5 font-semibold text-[color:var(--sn-ink-900)]">{r.get}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
        <table className="mt-2 w-full text-left text-[12.5px]">
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.type} className="border-t">
                <td className="py-1.5 pr-3">{r.type}</td>
                <td className="py-1.5 font-semibold">{r.get}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-[10px]">One A4 page · prints as is</p>
      </section>
    </div>
  );
}
