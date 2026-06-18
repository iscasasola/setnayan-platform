/**
 * Editorial quality scan — three free layers run before the couple
 * sees their draft. The admin resolves any flags in HQ before unlocking.
 *
 * Layer 1 — OpenAI Moderation API (free, no usage cap):
 *   Catches vulgarity, hate speech, harassment, sexual content, violence.
 *   Red flags. Couple cannot see the editorial until all red flags are cleared.
 *
 * Layer 2 — LanguageTool public API (free, 20 req/min):
 *   Catches grammar errors and misspellings. Yellow flags. Advisory.
 *
 * Layer 3 — suggestions: admin writes their own fix. No LLM call here;
 *   the flagging itself gives the admin enough context to rewrite.
 *   LLM suggestions can be wired in later with one addition to resolveFlags().
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type FlagSeverity = 'red' | 'yellow';
export type FlagType = 'vulgar' | 'grammar';
export type FlagStatus = 'pending' | 'accepted' | 'edited' | 'dismissed';

export interface ScanFlag {
  id: string;
  field: string;
  label: string;
  original: string;
  type: FlagType;
  severity: FlagSeverity;
  note?: string;
  status: FlagStatus;
  admin_edit?: string;
  resolved_by?: string;
  resolved_at?: string;
}

// ── Field extraction ──────────────────────────────────────────────────────────

interface TextField {
  field: string;
  label: string;
  text: string;
}

function extractFields(node: unknown, path = '', acc: TextField[] = []): TextField[] {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    node.forEach((item, i) => extractFields(item, `${path}[${i}]`, acc));
    return acc;
  }

  const obj = node as Record<string, unknown>;
  const nameHint = (obj.name || obj.label || obj.moment_name || obj.author || '') as string;

  for (const [key, val] of Object.entries(obj)) {
    const childPath = path ? `${path}.${key}` : key;

    if (typeof val === 'string' && val.trim().length > 15) {
      // Skip URLs and very short tokens
      if (/^https?:\/\//.test(val.trim())) continue;
      const label = nameHint
        ? `${nameHint} — ${key}`
        : childPath.replace(/_/g, ' ').replace(/\[\d+\]/g, '');
      acc.push({ field: childPath, label, text: val.trim() });
    } else if (val && typeof val === 'object') {
      extractFields(val, childPath, acc);
    }
  }
  return acc;
}

// ── Layer 1: OpenAI Moderation (free) ────────────────────────────────────────

interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
}

async function runModeration(texts: string[]): Promise<ModerationResult[]> {
  if (!texts.length || !process.env.OPENAI_API_KEY) return texts.map(() => ({ flagged: false, categories: {} }));

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: texts }),
    });
    if (!res.ok) return texts.map(() => ({ flagged: false, categories: {} }));
    const data = await res.json() as { results: ModerationResult[] };
    return data.results;
  } catch {
    return texts.map(() => ({ flagged: false, categories: {} }));
  }
}

// ── Layer 2: LanguageTool grammar (free) ─────────────────────────────────────

interface LTMatch {
  message: string;
  rule: { issueType: string; id: string };
  replacements: Array<{ value: string }>;
}

async function runGrammar(text: string): Promise<LTMatch[]> {
  try {
    const body = new URLSearchParams({ text, language: 'en-PH' });
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return [];
    const data = await res.json() as { matches: LTMatch[] };
    return data.matches.filter(
      m => m.rule.issueType === 'grammar' || m.rule.issueType === 'misspelling',
    );
  } catch {
    return [];
  }
}

// ── Main scan ─────────────────────────────────────────────────────────────────

export async function scanEditorial(editorialId: string): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from('event_editorial')
    .update({ scan_status: 'scanning' })
    .eq('editorial_id', editorialId);

  try {
    const { data: editorial } = await admin
      .from('event_editorial')
      .select('draft_json')
      .eq('editorial_id', editorialId)
      .maybeSingle();

    if (!editorial?.draft_json) {
      await admin.from('event_editorial').update({
        scan_status: 'skipped',
        scan_completed_at: new Date().toISOString(),
        unlocked_for_couple_at: new Date().toISOString(),
      }).eq('editorial_id', editorialId);
      return;
    }

    const fields = extractFields(editorial.draft_json);
    const texts = fields.map(f => f.text);

    // Layer 1 — moderation (single batched request)
    const modResults = await runModeration(texts);

    // Layer 2 — grammar (per field, with 120ms gap to respect free rate limit)
    const grammarResults: LTMatch[][] = [];
    for (const field of fields) {
      await new Promise(r => setTimeout(r, 120));
      grammarResults.push(await runGrammar(field.text));
    }

    const flags: ScanFlag[] = [];

    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const mod = modResults[i];
      const grammar = grammarResults[i] ?? [];

      if (mod?.flagged) {
        const triggeredCategories = Object.entries(mod.categories ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ');
        flags.push({
          id: crypto.randomUUID(),
          field: f.field,
          label: f.label,
          original: f.text,
          type: 'vulgar',
          severity: 'red',
          note: triggeredCategories || undefined,
          status: 'pending',
        });
      }

      if (grammar.length > 0) {
        const firstSuggestion = grammar[0]?.replacements[0]?.value;
        flags.push({
          id: crypto.randomUUID(),
          field: f.field,
          label: f.label,
          original: f.text,
          type: 'grammar',
          severity: 'yellow',
          note: `${grammar.length} issue${grammar.length > 1 ? 's' : ''}: ${grammar.map(m => m.message).slice(0, 2).join('; ')}${grammar.length > 2 ? '…' : ''}${firstSuggestion ? ` · Suggestion: "${firstSuggestion}"` : ''}`,
          status: 'pending',
        });
      }
    }

    const hasRed = flags.some(f => f.severity === 'red');
    const scanStatus: string = flags.length === 0 ? 'clean' : 'flagged';
    const now = new Date().toISOString();

    await admin.from('event_editorial').update({
      scan_status: scanStatus,
      scan_flags: flags,
      scan_completed_at: now,
      // Auto-unlock only when fully clean
      unlocked_for_couple_at: !hasRed && flags.length === 0 ? now : null,
    }).eq('editorial_id', editorialId);

  } catch {
    // Scan failure must never block the couple — skip and unlock
    await admin.from('event_editorial').update({
      scan_status: 'skipped',
      scan_completed_at: new Date().toISOString(),
      unlocked_for_couple_at: new Date().toISOString(),
    }).eq('editorial_id', editorialId);
  }
}
