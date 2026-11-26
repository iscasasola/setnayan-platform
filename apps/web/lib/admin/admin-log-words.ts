/**
 * admin-log-words.ts — an admin-log action in plain words (A8·C-11).
 *
 * `admin_audit_log.action` is a machine key (`vendor_tier_set`,
 * `taxonomy.set_hidden`, `approval_request_created`). The log used to print it
 * with `_` swapped for a space, so a person read "vendor tier set". Each key is
 * split into its words and every word that is a code or a banned word is
 * replaced (supplier, never vendor — docs/brand.md). Pure, so every action
 * the code writes is checked by `admin-log-words.test.ts`.
 */
const WORD: Record<string, string> = {
  vendor: 'supplier',
  vendors: 'suppliers',
  taxonomy: 'catalogue',
  canonical: 'service',
  sku: 'price row',
  rpc: '',
  hq: 'HQ',
  ai: 'AI',
  qr: 'QR',
  php: 'peso',
  pct: 'percent',
  pax: 'headcount',
  upsert: 'save',
  insert: 'add',
  vocab: 'word list',
  std: 'save-the-date',
  papic: 'Papic',
  maya: 'Maya',
  apple: 'Apple',
  setnayan: 'Setnayan',
};

export function adminLogActionWords(action: string): string {
  const words = action
    .replace(/^approval_(?!request)/, 'request_')
    .split(/[_.:\s-]+/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      return Object.hasOwn(WORD, lower) ? (WORD[lower] ?? '') : lower;
    })
    .filter(Boolean);
  if (words.length === 0) return 'Admin action';
  const out = words.join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}
