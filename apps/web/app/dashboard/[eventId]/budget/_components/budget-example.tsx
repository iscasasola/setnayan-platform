/**
 * 👻 THE BUDGET'S EXAMPLE (Build 5 Lane H; owner 2026-11-09, DECISION_LOG 🧱👻 ×2; approved prototype
 * `prototypes/empty_looks_user_event_2026-11-10/` frame "Event · Budget"): under the shipped empty books — the dashed
 * Target, the three groups at 0 and "Nothing added yet. Use ＋ Add expense …" — the same books filled, faded: the real
 * `BudgetFigures` on fixture money, then the three groups' own heads and rows (`budget-page.module.css`).
 *
 * Inert by construction: rows are plain spans (no buttons, no swipe) inside the shared `ExamplePreview`. Mounted by
 * `BudgetScreen` only when all three groups were READ and came back empty — a refused group draws "Couldn't load …"
 * and never an Example.
 */
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { SAMPLE_BUDGET as B } from '@/lib/empty-look-samples';
import { shortDate } from '@/lib/budget-page-view';
import { formatCount } from '@/lib/format-number';
import { BudgetFigures, Peso } from './budget-figures';
import styles from './budget-page.module.css';

const pct = (n: number) => Math.round((n / B.targetPhp) * 100);

function Head({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.grp}>
      <h2>{title}</h2>
      <span className={`${styles.cnt} ${styles.num}`}>{formatCount(count)}</span>
    </div>
  );
}

function Owed({ owedPhp, dueDate, id }: { owedPhp: number; dueDate: string | null; id: string }) {
  return owedPhp > 0 ? (
    <small className={`${styles.wine} ${styles.num}`}>
      <Peso value={owedPhp} id={id} /> owed{dueDate ? ` · ${shortDate(dueDate)}` : ''}
    </small>
  ) : (
    <small className={styles.ok}>paid ✓</small>
  );
}

export function BudgetExample() {
  return (
    <ExamplePreview className="mt-3">
      <BudgetFigures
        label="Example budget"
        cells={[
          { key: 'target', label: 'Target', value: B.targetPhp, id: 'ex-budget-target' },
          { key: 'agreed', label: 'Agreed', value: B.agreedPhp, id: 'ex-budget-agreed' },
          { key: 'paid', label: 'Paid', value: B.paidPhp, id: 'ex-budget-paid', tone: 'ok' },
          { key: 'owed', label: 'Owed', value: B.owedPhp, id: 'ex-budget-owed', tone: 'wine' },
        ]}
        meter={{
          agreedPct: pct(B.agreedPhp),
          paidPct: pct(B.paidPhp),
          overPct: 0,
          ids: { agreed: 'ex-budget-m-agreed', paid: 'ex-budget-m-paid', over: 'ex-budget-m-over' },
        }}
        swatches={['paid', 'agreed', 'target']}
        next={{ ...B.next, action: null }}
      />
      <div className={styles.list}>
        <Head title="Booked suppliers" count={B.suppliers.length} />
        {B.suppliers.map((s, i) => (
          <div key={s.name} className={styles.row}>
            <span className={styles.logo}>{s.initials}</span>
            <span className={styles.mid}>
              <span className={styles.name}>{s.name}</span>
              <span className={`${styles.svc} ${styles.num}`}>
                {s.service} ·{' '}
                {s.owedPhp > 0 ? (
                  <>
                    <Peso value={s.paidPhp} id={`ex-bs-${i}-paid`} /> paid
                  </>
                ) : (
                  'paid in full'
                )}
              </span>
            </span>
            <span className={styles.end}>
              <span className={styles.amt}>
                <b className={styles.num}>
                  <Peso value={s.agreedPhp} id={`ex-bs-${i}`} />
                </b>
                <Owed owedPhp={s.owedPhp} dueDate={s.dueDate} id={`ex-bs-${i}-owed`} />
              </span>
            </span>
          </div>
        ))}
        <Head title="Bought on Setnayan" count={B.orders.length} />
        {B.orders.map((o, i) => (
          <div key={o.name} className={styles.row}>
            <span className={`${styles.logo} ${styles.logoS}`}>S</span>
            <span className={styles.mid}>
              <span className={styles.name}>{o.name}</span>
              <span className={styles.svc}>{shortDate(o.bookedOn)} · receipt</span>
            </span>
            <span className={styles.end}>
              <span className={styles.amt}>
                <b className={styles.num}>
                  <Peso value={o.amountPhp} id={`ex-bo-${i}`} />
                </b>
                <Owed owedPhp={0} dueDate={null} id={`ex-bo-${i}-owed`} />
              </span>
            </span>
          </div>
        ))}
        <Head title="Your expenses" count={B.expenses.length} />
        {B.expenses.map((e, i) => (
          <div key={e.name} className={styles.row}>
            <span className={styles.logo}>{e.initials}</span>
            <span className={styles.mid}>
              <span className={styles.name}>{e.name}</span>
              <span className={styles.svc}>{e.category} · paid in full</span>
            </span>
            <span className={styles.end}>
              <span className={styles.amt}>
                <b className={styles.num}>
                  <Peso value={e.amountPhp} id={`ex-be-${i}`} />
                </b>
                <Owed owedPhp={0} dueDate={null} id={`ex-be-${i}-owed`} />
              </span>
            </span>
          </div>
        ))}
      </div>
    </ExamplePreview>
  );
}
