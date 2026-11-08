/**
 * 🚩 THE SUPPLIER REPORT — pure rules (owner 2026-11-08 "REPORT = SUBJECT · NOTE · ORIGIN"; THE ONE BUILD §5.4).
 *
 * The report is a `help_messages` row: subject ≤ 160, body ≤ 4000 (the shipped CHECKs), plus its origin. The page
 * slug matches the database CHECK `help_messages_origin_page_chk` (`^[a-z][a-z0-9_.]{1,63}$`) and is always
 * `clients.<page>` — a fixed word from the picked-client menu, never anything the supplier typed.
 */
export const REPORT_SUBJECT_MAX = 160;
export const REPORT_BODY_MAX = 4000;

const PAGES = new Set(['details', 'chat', 'schedule', 'quote', 'payments', 'forms', 'files', 'hub', 'report']);

/** `clients.<page>` for a known picked-client page; anything else is `clients.report`. */
export function reportOriginPage(page: string): string {
  const p = page.trim().toLowerCase();
  return `clients.${PAGES.has(p) ? p : 'report'}`;
}

const PAGE_WORD: Record<string, string> = {
  details: 'Details',
  chat: 'Chat',
  schedule: 'Schedule',
  quote: 'Quotation',
  payments: 'Payment',
  forms: 'Forms',
  files: 'Files',
  hub: 'Hub',
  report: 'Report',
};

/** "Clients › Report" — how the origin page reads to a person (the chip and the admin line). */
export function reportOriginWords(originPage: string | null): string | null {
  if (!originPage) return null;
  const m = /^clients\.([a-z_]+)$/.exec(originPage);
  if (!m) return originPage;
  return `Clients › ${PAGE_WORD[m[1]!] ?? m[1]}`;
}
