/**
 * 📋 SETNAYAN'S STARTING "WHAT'S INCLUDED" TEMPLATES, one or more per service (DECISION_LOG 2026-11-17 4906a9a8 +
 * 7596f63a; table `service_included_templates`, migration 20271351904391). Admin adds, edits and deletes them on
 * Admin › Categories › the service's panel ("Quick Forms"); a supplier loads one into the card's What's included.
 *
 * 🚫 NO PRICE (2026-11-11 "an included line has no price"): a template row is words, and the database refuses a row
 * carrying any amount. `basis` only says how a CHOICE would add to the price once the supplier types an amount.
 *
 * Pure — no I/O.
 */

export type IncludedBasis = 'none' | 'flat' | 'per_pax' | 'tasting';
export type IncludedTemplateRow =
  | { name: string; kind: 'plain'; basis: IncludedBasis }
  | { name: string; kind: 'choice'; options: string[]; basis: IncludedBasis };

export type IncludedTemplate = {
  id: string;
  name: string;
  rows: IncludedTemplateRow[];
  /** Drafted for the owner's review (the seed) — the admin panel tags it "Proposal". */
  isProposal: boolean;
};

export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATE_ROW_MAX = 60;
export const TEMPLATE_ROWS_MAX = 30;
const BASES: readonly IncludedBasis[] = ['none', 'flat', 'per_pax', 'tasting'];

/** The words an included line may not hold: a peso amount. */
const PRICE_WORDS = /₱|\bphp\b|\bpesos?\b|\bP\s?\d/i;

/** One stored row → a row, or null when it does not hold together. */
function readRow(raw: unknown): IncludedTemplateRow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return null;
  const basis = BASES.includes(r.basis as IncludedBasis) ? (r.basis as IncludedBasis) : 'none';
  if (r.kind === 'choice') {
    const options = Array.isArray(r.options) ? r.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '').map((o) => o.trim()) : [];
    if (options.length < 2) return null;
    return { name, kind: 'choice', options, basis };
  }
  return { name, kind: 'plain', basis };
}

/** A stored `rows` value → rows. A row that does not hold together is dropped, never invented. */
export function readTemplateRows(raw: unknown): IncludedTemplateRow[] {
  return Array.isArray(raw) ? raw.map(readRow).filter((r): r is IncludedTemplateRow => r !== null) : [];
}

/**
 * The words a template adds to a card's What's included (`vendor_service_inclusions.label`, ≤ 80, words only).
 * A choice row becomes ONE line naming its choices ("Type: Buffet or Plated") — the card's included lines are words;
 * the price a choice adds is set on the card's tiers, never here.
 */
export function templateLines(rows: readonly IncludedTemplateRow[]): string[] {
  return rows
    .map((r) => {
      if (r.kind === 'plain') return r.name;
      const opts = r.options;
      const list = opts.length === 2 ? `${opts[0]} or ${opts[1]}` : `${opts.slice(0, -1).join(', ')} or ${opts[opts.length - 1]}`;
      return `${r.name}: ${list}`;
    })
    .map((l) => l.slice(0, 80));
}

/** Lines to append to what is already typed: a line already there (any case) is not added twice. */
export function linesToAdd(existing: readonly string[], fromTemplate: readonly string[]): string[] {
  const have = new Set(existing.map((l) => l.trim().toLowerCase()).filter(Boolean));
  const out: string[] = [];
  for (const l of fromTemplate) {
    const k = l.trim().toLowerCase();
    if (!k || have.has(k)) continue;
    have.add(k);
    out.push(l.trim());
  }
  return out;
}

// ── The admin's text box: one row per line ────────────────────────────────────
//   Tables and chairs
//   Type: Buffet / Plated            ← a choice (2 or more, split by "/")
//   Type: Buffet / Plated | per pax  ← how a choice would add to the price (per pax · flat · tasting)

const BASIS_WORDS: Record<string, IncludedBasis> = {
  'per pax': 'per_pax',
  'per guest': 'per_pax',
  flat: 'flat',
  tasting: 'tasting',
  none: 'none',
};
const BASIS_LABEL: Record<IncludedBasis, string> = { none: '', flat: 'flat', per_pax: 'per pax', tasting: 'tasting' };

export function templateToText(rows: readonly IncludedTemplateRow[]): string {
  return rows
    .map((r) => {
      const head = r.kind === 'choice' ? `${r.name}: ${r.options.join(' / ')}` : r.name;
      const b = BASIS_LABEL[r.basis];
      return b ? `${head} | ${b}` : head;
    })
    .join('\n');
}

export type ParsedTemplate = { ok: true; rows: IncludedTemplateRow[] } | { ok: false; error: string };

export function parseTemplateText(text: string): ParsedTemplate {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: 'Add at least one row.' };
  if (lines.length > TEMPLATE_ROWS_MAX) return { ok: false, error: `Up to ${TEMPLATE_ROWS_MAX} rows.` };
  const rows: IncludedTemplateRow[] = [];
  for (const line of lines) {
    if (PRICE_WORDS.test(line)) return { ok: false, error: `“${line}” has a price. Included rows carry no price.` };
    const [head = '', basisRaw = ''] = line.split('|').map((s) => s.trim());
    const basis = basisRaw ? BASIS_WORDS[basisRaw.toLowerCase()] : 'none';
    if (!basis) return { ok: false, error: `“${basisRaw}” — write per pax, flat or tasting after the |.` };
    const colon = head.indexOf(':');
    const name = (colon >= 0 ? head.slice(0, colon) : head).trim();
    if (!name || name.length > TEMPLATE_ROW_MAX) return { ok: false, error: `Each row needs a name of up to ${TEMPLATE_ROW_MAX} characters.` };
    if (colon >= 0) {
      const options = head
        .slice(colon + 1)
        .split('/')
        .map((o) => o.trim())
        .filter(Boolean);
      if (options.length < 2) return { ok: false, error: `“${name}” needs two or more choices, split by /.` };
      if (options.some((o) => o.length > TEMPLATE_ROW_MAX)) return { ok: false, error: `A choice of “${name}” is too long.` };
      rows.push({ name, kind: 'choice', options: options.slice(0, 12), basis });
    } else {
      rows.push({ name, kind: 'plain', basis });
    }
  }
  return { ok: true, rows };
}

export function cleanTemplateName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.trim().replace(/\s+/g, ' ');
  return n.length > 0 && n.length <= TEMPLATE_NAME_MAX ? n : null;
}
