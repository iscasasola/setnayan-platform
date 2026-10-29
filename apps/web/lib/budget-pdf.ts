/**
 * lib/budget-pdf.ts — 📤 THE BUDGET AS A FILE TO SHARE: one A4 PDF, drawn with the PDF engine every other paper in this
 * app is drawn with (`pdf-lib` — the seat plan, the concept book, the prints).
 *
 * Owner 2026-10-29, from the iPhone app: *"Print Budget can be just a share button if it has the print and share there
 * as well? and maximize every other method to share that file? … fix how that pdf file/page looks"*. So Budget's
 * "Print" page (an HTML page with "‹ Done" and a print button in it) became ONE Share button, and Share hands the
 * phone THIS file — the system sheet then offers Print, Save to Files, AirDrop, Messages, Viber, Mail… A file has no
 * buttons in it and no device chrome, so nothing on paper can say "‹ Done" again.
 *
 * ── HOW IT LOOKS ────────────────────────────────────────────────────────────
 * It is the FIRST view on the shared Share-as-PDF engine (`lib/share-pdf.ts`, owner 2026-10-29: *"each print lives
 * where its data lives"*): this file only turns the budget into a `SharePdfDoc`; the engine draws every Setnayan PDF
 * the same way (house type, paper, mark, pagination, page numbers) on A4 · Letter · Long bond.
 *
 *   page 1 · the mark + SETNAYAN · the event's name · date · venue · Target · Agreed · Paid · Owed · one meter
 *   then   · each category as a section: its lines (item · supplier · agreed · paid · owed · due) and its total
 *   last   · categories planned but with nothing agreed yet
 *   every page · "Generated …" and "Page n of N" at the foot
 *
 * A row is never split across pages, and a category's heading never sits alone at the foot of one (the engine's rule).
 *
 * ── ONE SET OF BOOKS · AGREED MONEY ONLY ───────────────────────────────────
 * Every figure is `/budget`'s own: `EventMoney` (`resolveEventMoney`) and `BudgetLedger` (`buildBudgetLedger`), the
 * lines filtered and ordered by `exportableLines` exactly as the CSV is. Quotes (`kind === 'estimated'`) never print.
 *
 * ── 🛑 A FAILED READ NEVER PRINTS ₱0 ───────────────────────────────────────
 * When any of the three money reads was refused (`EventMoney.reads`), Agreed and Paid are sums over rows that are not
 * there — a floor, not a fact — and a file of them would be a confident wrong budget sent to a parent or a planner.
 * `budgetPdf` REFUSES (`BudgetUnreadError`) instead; the route turns that into a sentence and no file. A figure that is
 * simply absent (no target set) prints "—", never "₱0". Guard: `lib/budget-share-is-one-file.test.ts`.
 *
 * Pure layout: the route (`app/api/budget/[eventId]/export/route.ts`) does every read and hands the answers in.
 */
import type { EventMoney, MoneyLine } from '@/lib/budget-truth';
import { moneyReadsAllOk } from '@/lib/budget-truth';
import type { BudgetLedger } from '@/lib/budget-ledger';
import { categoryLabeller, exportableLines } from '@/lib/budget-export';
import { formatCount } from '@/lib/format-number';
import { dueWord, peso, sharePdf, type SharePdfColumn, type SharePdfDoc, type SharePdfPaper, type SharePdfSection } from '@/lib/share-pdf';

export { peso };

export type BudgetPdfInput = {
  eventName: string;
  /** The event's date as paper prints it (`printedDate` — as precise as the Event Hub holds it). Null → no date. */
  eventDate: string | null;
  /** The Event Hub's venues on one line (`venueNamesLine`). Null → no venue. */
  venue: string | null;
  money: EventMoney;
  ledger: BudgetLedger;
  generatedAt: Date;
  /** Default A4. */
  paper?: SharePdfPaper;
};

/** The money reads were not all answered — a file now would print a floor as a fact. */
export class BudgetUnreadError extends Error {
  constructor() {
    super("Your budget can't be shared right now — part of it didn't load. Please try again in a few minutes.");
    this.name = 'BudgetUnreadError';
  }
}

// ── the model: what is printed, in order ────────────────────────────────────
export type BudgetPdfSection = {
  bucketId: string;
  label: string;
  plannedPhp: number | null;
  plannedSuggested: boolean;
  lines: MoneyLine[];
  total: { agreedPhp: number; paidPhp: number; owedPhp: number };
};

/** Categories with agreed lines (as sections, in the export's order), then categories planned with nothing agreed. */
export function budgetPdfModel(money: EventMoney, ledger: BudgetLedger): {
  sections: BudgetPdfSection[];
  plannedOnly: Array<{ label: string; plannedPhp: number; suggested: boolean }>;
} {
  const label = categoryLabeller(money, ledger);
  const byRow = new Map(ledger.rows.map((r) => [r.bucketId, r]));
  const sections: BudgetPdfSection[] = [];
  for (const l of exportableLines(money, label)) {
    let s = sections[sections.length - 1];
    if (!s || s.bucketId !== l.bucket) {
      const r = byRow.get(l.bucket);
      s = {
        bucketId: l.bucket,
        label: label(l.bucket),
        plannedPhp: r?.plannedPhp ?? null,
        plannedSuggested: r?.plannedSource === 'suggested',
        lines: [],
        total: { agreedPhp: 0, paidPhp: 0, owedPhp: 0 },
      };
      sections.push(s);
    }
    s.lines.push(l);
  }
  // A category's total is the resolver's own (the ledger row = `byBucket`), the figure `/budget` prints for it; the
  // sum of its printed lines only where the ledger has no row for it.
  for (const s of sections) {
    const r = byRow.get(s.bucketId);
    s.total = r
      ? { agreedPhp: r.agreedPhp, paidPhp: r.paidPhp, owedPhp: r.owedPhp }
      : {
          agreedPhp: s.lines.reduce((a, l) => a + l.amountPhp, 0),
          paidPhp: s.lines.reduce((a, l) => a + l.paidPhp, 0),
          owedPhp: s.lines.reduce((a, l) => a + l.stillOwedPhp, 0),
        };
  }
  const withLines = new Set(sections.map((s) => s.bucketId));
  const plannedOnly = ledger.rows
    .filter((r) => !withLines.has(r.bucketId) && r.plannedPhp != null && r.plannedPhp > 0)
    .map((r) => ({ label: r.label, plannedPhp: r.plannedPhp as number, suggested: r.plannedSource === 'suggested' }));
  return { sections, plannedOnly };
}

// ── the document ─────────────────────────────────────────────────────────────
const COLUMNS: SharePdfColumn[] = [
  { label: 'Agreed', width: 62 },
  { label: 'Paid', width: 62 },
  { label: 'Owed', width: 62 },
  { label: 'Due', width: 62, align: 'left' },
];

/** The budget as the engine's document: `/budget`'s own figures, agreed money only. Refuses on a refused read. */
export function budgetPdfDoc(input: BudgetPdfInput): SharePdfDoc {
  const { money, ledger } = input;
  // 🛑 A refused read is not a smaller budget. Refuse rather than print a floor as a fact.
  if (!moneyReadsAllOk(money)) throw new BudgetUnreadError();
  const { sections, plannedOnly } = budgetPdfModel(money, ledger);

  const notes: Array<{ text: string; tone?: 'ink' | 'soft' | 'accent' }> = [];
  const meter: Array<{ fraction: number; tone: 'gold' | 'accent' }> = [];
  if (money.targetPhp == null) notes.push({ text: 'No target set yet.' });
  else if (money.targetPhp > 0) {
    meter.push({ fraction: money.committed / money.targetPhp, tone: 'gold' }, { fraction: money.paid / money.targetPhp, tone: 'accent' });
    notes.push(
      money.isOverBudget
        ? { text: `Agreed is ${peso(money.overBudgetByPhp)} over your target.`, tone: 'accent' }
        : { text: `${formatCount(Math.round((money.committed / money.targetPhp) * 100))}% of your target is agreed.`, tone: 'soft' },
    );
  }
  if (money.overpaid > 0) notes.push({ text: `${peso(money.overpaid)} was paid beyond what was agreed.`, tone: 'soft' });

  const out: SharePdfSection[] = sections.map((s) => ({
    title: s.label,
    aside: s.plannedPhp != null && s.plannedPhp > 0 ? `Planned ${peso(s.plannedPhp)}${s.plannedSuggested ? ' (suggested)' : ''}` : null,
    columns: COLUMNS,
    rows: s.lines.map((l: MoneyLine) => ({
      main: l.label || 'Untitled',
      sub: l.vendorName,
      cells: [
        peso(l.amountPhp),
        { text: peso(l.paidPhp), tone: 'soft' as const },
        { text: peso(l.stillOwedPhp), tone: l.stillOwedPhp > 0 ? ('ink' as const) : ('soft' as const) },
        { text: dueWord(l.dueDate), tone: l.dueState === 'overdue' ? ('accent' as const) : ('soft' as const) },
      ],
    })),
    total: {
      label: `Total · ${s.label}`,
      cells: [peso(s.total.agreedPhp), peso(s.total.paidPhp), { text: peso(s.total.owedPhp), tone: s.total.owedPhp > 0 ? 'accent' : 'ink' }, ''],
    },
  }));
  if (!out.length) {
    out.push({ title: 'Nothing agreed yet.', columns: [], rows: [], empty: 'When you book a supplier or add an expense, it is listed here.' });
  }
  if (plannedOnly.length) {
    out.push({
      title: 'Planned, nothing agreed yet',
      columns: [{ label: 'Planned', width: 90 }],
      rows: plannedOnly.map((p) => ({ main: p.label, cells: [{ text: `${peso(p.plannedPhp)}${p.suggested ? '*' : ''}`, tone: 'soft' as const }] })),
      note: plannedOnly.some((p) => p.suggested) ? '* suggested split — you have not set your own figure for it yet.' : null,
    });
  }

  return {
    kind: 'Budget',
    title: input.eventName,
    fileTitle: `${input.eventName} — budget`,
    meta: [input.eventDate, input.venue],
    summary: {
      figures: [
        { label: 'Target', value: peso(money.targetPhp) },
        { label: 'Agreed', value: peso(money.committed) },
        { label: 'Paid', value: peso(money.paid) },
        { label: 'Owed', value: peso(money.stillOwed) },
      ],
      meter,
      notes,
    },
    sections: out,
    notes: ["Agreed money only — quotes you're still weighing aren't included."],
    generatedAt: input.generatedAt,
    paper: input.paper,
  };
}

/** The budget's PDF bytes. Throws `BudgetUnreadError` when any money read was refused. */
export async function budgetPdf(input: BudgetPdfInput): Promise<Uint8Array> {
  return sharePdf(budgetPdfDoc(input));
}
