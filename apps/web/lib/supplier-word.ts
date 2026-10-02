/**
 * lib/supplier-word.ts — "SUPPLIER", NEVER "VENDOR", WHERE A PERSON READS IT.
 *
 * ⚖ Owner tracker d16 (2026-10-02): *"Suppliers" everywhere* — "Your Team" and
 * "vendor(s)" retire as words a host reads (tours, tiles, empty states, buttons,
 * the More sheet), and supplier-facing copy says "supplier" too. Code
 * identifiers, routes, columns and SKU codes (`vendor_profiles`,
 * `/vendor-dashboard`, `vendorId`) are NOT words on a screen and stay.
 *
 * The scan judges each occurrence by its AST position, exactly as
 * `scanRetiredNames` (lib/retired-names-scan.ts) does — JSX text and prose
 * literals are read by a person; keys, routes, columns and log lines are not —
 * plus three code shapes that word list never met: a PostgREST embed alias
 * (`vendor:vendor_profiles(…)`), a select list (`'event_id, vendor, status'`)
 * and the legal document's own title ("the Vendor Agreement § 9.1").
 *
 * `SUPPLIER_WORD_ALLOWED` is the reasoned allowlist: the places where the word
 * is NOT read by a host or a supplier, or where changing it is someone else's
 * decision (a legal text's defined term, a public page's search terms). Every
 * entry carries its reason. Anything outside it must say "supplier".
 */
import ts from 'typescript';

export const SUPPLIER_WORD_ALLOWED: ReadonlyArray<{ prefix: string; why: string }> = [
  { prefix: 'app/admin/', why: 'the staff console — read by Setnayan staff, not a host or a supplier' },
  { prefix: 'lib/admin/', why: 'the staff console’s helpers' },
  { prefix: 'app/api/', why: 'API routes — developer payloads and error codes, not screen copy' },
  { prefix: 'lib/api-keys.ts', why: 'the public API’s key descriptions (developer-facing)' },
  { prefix: 'lib/ugat/', why: 'the admin Root map’s own vocabulary (staff-facing)' },
  { prefix: 'lib/interconnect/', why: 'internal reachability probes' },
  { prefix: 'lib/security/', why: 'internal security labels' },
  { prefix: 'lib/secrets/', why: 'internal secret registry' },
  { prefix: 'lib/llms-txt', why: 'the machine-readable site summary for crawlers' },
  { prefix: 'app/llms.txt/', why: 'the machine-readable site summary for crawlers' },
  { prefix: 'app/(shell)/privacy/', why: 'legal text — "vendor" is a defined term; a legal edit, not a copy edit' },
  { prefix: 'app/(shell)/terms/', why: 'legal text — "vendor" is a defined term (the Vendor Agreement)' },
  { prefix: 'app/(shell)/acceptable-use/', why: 'legal text — the acceptable-use policy' },
  { prefix: 'app/(shell)/refunds/', why: 'legal text — the refund policy' },
  { prefix: 'lib/data-privacy-controls.ts', why: 'the DPO’s processing register (legal text)' },
  { prefix: 'lib/privacy-coverage.ts', why: 'the DPO’s processing register (legal text)' },
  { prefix: 'lib/erasure/', why: 'the DPO’s erasure register (legal text)' },
  { prefix: 'lib/data-subject-register', why: 'the DPO’s data-subject register (legal text)' },
  { prefix: 'lib/npc-filing-tasks.ts', why: 'the NPC filing checklist (regulator-facing, staff)' },
  { prefix: 'lib/two-admin-promise.ts', why: 'staff approval wording' },
  { prefix: 'lib/fraud-detection.ts', why: 'staff fraud review' },
  { prefix: 'lib/review-fraud-scoring.ts', why: 'staff fraud review' },
  { prefix: 'lib/plausibility-scoring.ts', why: 'staff plausibility review' },
  { prefix: 'lib/blog-batches/', why: 'public blog — a separate SEO pass ("wedding vendors" is what people search for)' },
  { prefix: 'lib/hiring-guide/', why: 'public hiring guides — the same SEO pass' },
  { prefix: 'lib/real-weddings.ts', why: 'public real-wedding stories — the same SEO pass' },
  { prefix: 'lib/explore-info-copy.ts', why: 'public Explore pages — the same SEO pass' },
  { prefix: 'app/(shell)/explore/', why: 'public Explore pages — the same SEO pass' },
  { prefix: 'app/(shell)/about/', why: 'public About page — the same SEO pass' },
  { prefix: 'app/(shell)/pricing/', why: 'public pricing page — the same SEO pass' },
  { prefix: 'app/(shell)/realstories/', why: 'public stories — the same SEO pass' },
  { prefix: 'app/tl/', why: 'public Tagalog pages — the same SEO pass' },
  { prefix: 'app/features/', why: 'public feature pages — the same SEO pass' },
  { prefix: 'app/waitlist/', why: 'public waitlist page — the same SEO pass' },
  { prefix: 'app/creators/', why: 'public creators page — the same SEO pass' },
  { prefix: 'app/tour/', why: 'the public product tour — the same SEO pass' },
  { prefix: 'lib/social/', why: 'public social share text — the same SEO pass' },
  { prefix: 'lib/blog.ts', why: 'public blog categories — the same SEO pass' },
  { prefix: 'lib/vendor-deep-search.ts', why: 'the staff verification AI’s research prompts' },
  { prefix: 'lib/subprocessors.ts', why: 'legal text — the published subprocessor list' },
  { prefix: 'lib/public-price-literals.ts', why: 'a guard’s own input table, never rendered' },
  { prefix: 'lib/taxonomy-merge-holders.ts', why: 'staff taxonomy tooling' },
  { prefix: 'lib/sku-catalog.ts', why: 'mirrors the service catalogue’s stored titles — rename them in the catalogue first' },
  { prefix: 'lib/papic-challenge-pool.ts', why: 'mirrors the seeded challenge titles in the database (papic-challenge-sql)' },
];

/**
 * Exact strings that are DATA, not copy: the database stores or matches them,
 * so changing the word in code alone would break the match. Each says where.
 */
export const SUPPLIER_WORD_DATA: ReadonlyArray<{ text: string; why: string }> = [
  {
    // Spelt in two halves on purpose: `amount-to-pay.test.ts` counts the files
    // that hold the whole note as WRITERS of it, and this list writes nothing.
    text: 'Deposit (date held · awaiting ' + 'vendor confirmation)',
    why: 'event_vendor_payments.notes — the deposit stamp trigger matches it (NEW.notes IN (…))',
  },
  {
    text: 'Downpayment (lock · awaiting ' + 'vendor confirmation)',
    why: 'event_vendor_payments.notes — the deposit stamp trigger matches it (NEW.notes IN (…))',
  },
  { text: 'Wedding Vendor', why: 'mirrors the SQL screen-name fallback (fix_screen_name_slug_collision_namespace)' },
];

export function supplierWordAllowed(rel: string): string | null {
  const hit = SUPPLIER_WORD_ALLOWED.find((a) => rel.startsWith(a.prefix));
  return hit ? hit.why : null;
}

export type VendorWordHit = { start: number; end: number; line: number; word: string; text: string };

const GLUED_BEFORE = /[A-Za-z0-9_/.\-@#=?&:$]$/;
const GLUED_AFTER = /^(?:[A-Za-z0-9_/\-(]|!(?:inner|left)|\.[a-z_]|:\w)/;
const SELECT_LIST = /^[a-z0-9_\s,:!().*]+$/;

function isVisible(text: string, i: number, len: number, jsx: boolean, prose: boolean): boolean {
  const before = text.slice(0, i);
  const after = text.slice(i + len);
  if (/[A-Za-z0-9]$/.test(before) || /^[A-Za-z0-9]/.test(after)) return false;
  // Names, not the word: the legal document's title (a legal edit) and the
  // supplier AI add-on's catalogue name "Vendor AI" (renamed in the catalogue first).
  if (/^\s+(?:Agreement|AI)\b/.test(after)) return false;
  // A template slot (`{vendor}` in the Setnayan AI templates) is a key.
  if (before.endsWith('{') && after.startsWith('}')) return false;
  if (jsx) return true;
  if (prose) return !GLUED_BEFORE.test(before) && !GLUED_AFTER.test(after);
  const bare = text.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
  return bare.length === len && /^[A-Z][a-z]/.test(bare);
}

/**
 * Every "vendor" / "vendors" a person would READ in one file's source, with
 * its offsets (the rewrite and the guard share this one judgement).
 */
export function scanVendorWord(fileName: string, source: string): VendorWordHit[] {
  if (!/vendor/i.test(source)) return [];
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: VendorWordHit[] = [];
  const range = (start: number, end: number, jsx: boolean, prose: boolean, whole: string) => {
    if (!jsx && SELECT_LIST.test(whole) && whole.includes(',')) return; // a select list
    if (!jsx && SUPPLIER_WORD_DATA.some((d) => d.text === whole)) return; // stored data
    const text = source.slice(start, end);
    for (const m of text.matchAll(/vendor(s)?/gi)) {
      if (!isVisible(text, m.index!, m[0].length, jsx, prose)) continue;
      const at = start + m.index!;
      out.push({
        start: at,
        end: at + m[0].length,
        line: sf.getLineAndCharacterOfPosition(at).line + 1,
        word: m[0],
        text: whole.replace(/\s+/g, ' ').trim().slice(0, 140),
      });
    }
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ((ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'console') ||
        (ts.isIdentifier(node.expression) && /^log[A-Z]/.test(node.expression.text)))
    ) {
      return;
    }
    if (ts.isJsxText(node)) {
      range(node.getStart(sf), node.end, true, true, node.text);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      if (p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p))) return;
      if (p && (ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === node) return;
      range(node.getStart(sf) + 1, node.end - 1, false, /\s/.test(node.text.trim()), node.text);
    } else if (ts.isTemplateExpression(node)) {
      const joined = node.head.text + node.templateSpans.map((x) => `\u0000${x.literal.text}`).join('');
      const prose = /\s/.test(joined.trim());
      for (const part of [node.head, ...node.templateSpans.map((x) => x.literal)]) {
        range(part.getStart(sf) + 1, part.end - (ts.isTemplateTail(part) ? 1 : 2), false, prose, joined);
      }
      for (const x of node.templateSpans) visit(x.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** "vendor" → "supplier", keeping the case and the plural. */
export function supplierFor(word: string): string {
  const plural = word.length === 7;
  const base = plural ? word.slice(0, 6) : word;
  const out = base === 'VENDOR' ? 'SUPPLIER' : /^V/.test(base) ? 'Supplier' : 'supplier';
  return plural ? out + (word.endsWith('S') ? 'S' : 's') : out;
}
