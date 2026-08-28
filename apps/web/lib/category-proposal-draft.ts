/**
 * category-proposal-draft.ts — A TRADE WE DO NOT HAVE, ARRIVING READY TO PRESS
 * (C4, 2026-08-28). PURE: no network, no database, no `server-only`.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 * A supplier tells us what they do and it lands in `taxonomy_category_requests`
 * — the intake, the admin queue and all four outcomes have shipped since
 * 20260811000000. Nothing in that path helps DECIDE: the request arrives as a
 * bare label and the one control that mints a permanent public category asks
 * for a tile blind, out of 75. This module writes the DRAFT of that decision.
 *
 * ── ⛔ IT MINTS NOTHING, AND IT HAS NO PATH TO THE MINT ──────────────────────
 * Nothing here inserts into `canonical_service_schemas` or
 * `canonical_service_taxonomy`, and nothing here calls `promoteCategoryRequest`.
 * A person opens /admin/taxonomy and presses. The three measured reasons are in
 * § 4 of WHATS_NEXT_The_Category_Suggester_2026-08-28.md: removing a leaf later
 * STRANDS the shops that listed under it; the mint's duplicate check is a SLUG
 * match, so a machine would happily create "Sorbetes Cart" beside the existing
 * "Ice Cream Cart"; and the owner's standing rule is that the assistant may
 * prepare and may hold back but may never be the thing that lets a publish
 * through. `category-proposal-mints-nothing.test.ts` asserts all of that against
 * the source rather than trusting this paragraph.
 *
 * ── TWO ARMS, AND THE CHEAP ONE IS THE VALUABLE ONE ─────────────────────────
 *   1. LEXICAL — the shipped ranker (`lib/taxonomy-search-rank.ts`, four tiers,
 *      already carrying C2's reviewed aliases) is run against the words the
 *      supplier typed. If a live trade comes back, the draft says so and names
 *      it: verdict `existing`, `drafted_by: 'lexical'`, ₱0, no model, no key
 *      needed. § 4 of the plan calls this "the highest-value half" for a
 *      reason — most "new" categories are an existing trade under another name.
 *   2. THE MODEL — reached ONLY when arm 1 comes back empty, which by then
 *      genuinely means we have no word for this. It writes a proposal: a clean
 *      name, the branch, and the near-matches it rejected WITH a reason each.
 *
 * ⛔ THIS FILE DOES NOT MATCH ANYTHING ITSELF. `rankTaxonomyOptions` already
 * exists, is pure and is tested — it was written because the single word
 * "photobooth" used to return zero results. A second matcher here would be the
 * two-hand-typed-things failure this repo keeps paying for. Same for the key
 * the mint will produce: `slugifyKey` in `lib/leaf-attribute-schema.ts` is the
 * documented mirror of the Studio's own `slugify(label, '_')`, so the "this
 * becomes …" line a reviewer reads is computed by the same rule that will
 * actually run.
 *
 * ── 🔒 WHAT THE MODEL IS NEVER TRUSTED WITH ─────────────────────────────────
 * Every key and every id it returns is checked against the live tree BEFORE the
 * draft exists — never shown first and validated later. A tile id we do not
 * have becomes NULL ("we could not place this" is an honest draft). A
 * near-match naming a trade we do not have is DROPPED. A `closest_existing`
 * that does not resolve kills the whole `existing` verdict rather than
 * demoting it. And the LABEL of every near-match is read from OUR list, never
 * from the reply, so the model cannot rename a real trade in a reviewer's eyes.
 */
import { rankTaxonomyOptions } from '@/lib/taxonomy-search-rank';
import { slugifyKey } from '@/lib/leaf-attribute-schema';

/** The model asked when the live list has nothing. Cheap and constrained. */
export const DRAFT_MODEL = 'claude-haiku-4-5';

/** Recorded on a draft the shipped ranker answered with no model call. */
export const DRAFTED_BY_LEXICAL = 'lexical';

/** How many rejected near-matches a draft may carry. Three is a reviewer's
 *  attention span; more of them is the wall this feature exists to avoid. */
export const MAX_NEAR_MATCHES = 3;

/** One live trade, as both arms need it. */
export type LiveTrade = {
  /** The `canonical_service` key — what a promote/map would store. */
  key: string;
  /** The trade's own name, e.g. "Sorbetes Cart". */
  label: string;
  /** The tier-2 tile it sits under, e.g. `food_cart`. */
  tileId: string;
  /** That tile's name, e.g. "Food Cart" — shown so two similar trades differ. */
  branch: string;
  /** Reviewed aliases (C2). Search text only; already merge-forwarded. */
  aliases?: readonly string[];
};

/** One live tier-2 tile the mint could place a new trade under. */
export type LiveTile = {
  id: string;
  label: string;
  /** Its tier-1 folder's name, e.g. "Booths, carts & bars". */
  folder: string;
};

/** A near-match the draft considered and rejected, with the reason. */
export type NearMatch = {
  canonicalService: string;
  /** Read from OUR trade list, never from the model's reply. */
  label: string;
  whyNot: string;
};

/** The drafted proposal, exactly as one `taxonomy_category_request_drafts` row. */
export type CategoryProposalDraft = {
  suggestedLabel: string;
  suggestedTileId: string | null;
  tileReason: string | null;
  verdict: 'new' | 'existing';
  closestExisting: string | null;
  nearMatches: NearMatch[];
  draftedBy: string;
};

const LABEL_MIN = 2;
const LABEL_MAX = 80;
const REASON_MAX = 400;
const WHY_NOT_MAX = 200;

function clamp(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * The key `promoteCategoryRequest` WILL mint for a given label — computed by
 * the shared `slugifyKey`, which is the documented mirror of the Studio's own
 * `slugify(label, '_')`. Shown to the reviewer so "Add it" is not a surprise.
 */
export function mintKeyFor(label: string): string {
  return slugifyKey(label);
}

/**
 * ARM 1 — does the live list already answer this, for free?
 *
 * Runs the SHIPPED ranker over the trades with their reviewed aliases attached,
 * exactly as the card maker's own search does. A hit means we probably have
 * this trade already and the reviewer should Map rather than Promote.
 *
 * Returns `null` when nothing matched — the only condition under which the
 * model is ever asked anything.
 */
export function lexicalDraft(
  typedLabel: string,
  trades: readonly LiveTrade[],
): CategoryProposalDraft | null {
  const hits = rankTaxonomyOptions(trades, typedLabel, MAX_NEAR_MATCHES);
  if (hits.length === 0) return null;
  const top = hits[0];
  if (!top) return null;
  return {
    suggestedLabel: top.label.slice(0, LABEL_MAX),
    suggestedTileId: null,
    tileReason: null,
    verdict: 'existing',
    closestExisting: top.key,
    nearMatches: hits.map((h) => ({
      canonicalService: h.key,
      label: h.label,
      whyNot: `Matches the words they typed, under ${h.branch}.`,
    })),
    draftedBy: DRAFTED_BY_LEXICAL,
  };
}

/**
 * The trade list as the model sees it — grouped by branch, because category
 * prediction is conventionally hierarchical (§ R of the plan) and because the
 * model has to pick a TILE, not only a trade. Nothing but public taxonomy
 * labels goes into this string: no shop, no couple, no money, no event.
 */
export function buildTradeMenu(tiles: readonly LiveTile[], trades: readonly LiveTrade[]): string {
  const byTile = new Map<string, string[]>();
  for (const t of trades) {
    const list = byTile.get(t.tileId) ?? [];
    list.push(t.key);
    byTile.set(t.tileId, list);
  }
  const lines: string[] = [];
  for (const tile of tiles) {
    const keys = byTile.get(tile.id) ?? [];
    lines.push(`- tile_id: ${tile.id} — "${tile.folder} › ${tile.label}"`);
    lines.push(`  trades: ${keys.length ? keys.join(', ') : '(none yet)'}`);
  }
  return lines.join('\n');
}

/** The system prompt. It says what the model may write, and what it may not do. */
export const DRAFT_SYSTEM_PROMPT =
  'You draft a proposal for a new supplier trade in a Philippine events ' +
  'marketplace. You never create anything: a person reads your draft and ' +
  'presses the button. Be conservative — if the trade already exists in the ' +
  'list under another name, say so instead of proposing a new one. ' +
  'Answer with one JSON object and no other text.';

/** The user prompt: their words, our tree, and the exact shape of the reply. */
export function buildDraftPrompt(
  typedLabel: string,
  note: string | null,
  menu: string,
): string {
  return [
    'Our existing branches and the trades already under them:',
    menu,
    '',
    `A supplier typed this as the service we are missing: "${typedLabel}"`,
    note ? `In their own words: "${note}"` : 'They wrote no description.',
    '',
    'Reply with exactly this JSON and nothing else:',
    '{',
    '  "verdict": "new" | "existing",',
    '  "name": "a clean 2-4 word trade name in Title Case",',
    '  "tile_id": "one tile_id from the list, or null if none fit",',
    '  "tile_reason": "one short sentence saying why that branch",',
    '  "closest_existing": "a trade key from the list, only when verdict is existing, else null",',
    '  "near_matches": [',
    '    { "canonical_service": "a trade key from the list", "why_not": "one short sentence" }',
    '  ]',
    '}',
    '',
    `Give at most ${MAX_NEAR_MATCHES} near_matches — the closest things we ` +
      'already have and why each one is NOT the same trade. Use only keys and ' +
      'tile_ids that appear above; anything invented is discarded.',
  ].join('\n');
}

/**
 * ARM 2 — turn a model reply into a draft, or into nothing.
 *
 * 🔒 VALIDATE, THEN SHOW — never the other way round. A model will happily
 * return a plausible key that does not exist (trap 3 in § 6 of the plan), and
 * this queue sits beside a control that creates a permanent public category.
 */
export function parseDraftReply(
  raw: string,
  tiles: readonly LiveTile[],
  trades: readonly LiveTrade[],
  model: string = DRAFT_MODEL,
): CategoryProposalDraft | null {
  const json = extractJsonObject(raw);
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const body = parsed as Record<string, unknown>;

  // The name is the one field with no fallback: without it there is no draft.
  const name = clamp(body.name, LABEL_MAX);
  if (!name || name.length < LABEL_MIN) return null;

  const verdictRaw = typeof body.verdict === 'string' ? body.verdict.trim().toLowerCase() : '';
  if (verdictRaw !== 'new' && verdictRaw !== 'existing') return null;

  const tradeByKey = new Map(trades.map((t) => [t.key, t]));
  const tileIds = new Set(tiles.map((t) => t.id));

  // An invented tile becomes "we could not place this" rather than killing the
  // draft — the column is nullable and NULL is an honest answer a reviewer can
  // act on. An invented tile SHOWN would not be.
  const tileRaw = typeof body.tile_id === 'string' ? body.tile_id.trim() : '';
  const suggestedTileId = tileIds.has(tileRaw) ? tileRaw : null;
  const tileReason = suggestedTileId ? clamp(body.tile_reason, REASON_MAX) : null;

  // `existing` is a claim about a specific trade. If that trade does not
  // resolve, the claim is unusable — refuse the whole draft rather than
  // silently downgrading it to `new`, which would present a machine's failed
  // lookup as a considered opinion that we have nothing like this.
  let closestExisting: string | null = null;
  if (verdictRaw === 'existing') {
    const claimed = typeof body.closest_existing === 'string' ? body.closest_existing.trim() : '';
    if (!tradeByKey.has(claimed)) return null;
    closestExisting = claimed;
  }

  const nearMatches: NearMatch[] = [];
  const seen = new Set<string>();
  const rawMatches = Array.isArray(body.near_matches) ? body.near_matches : [];
  for (const entry of rawMatches) {
    if (nearMatches.length >= MAX_NEAR_MATCHES) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const key = typeof row.canonical_service === 'string' ? row.canonical_service.trim() : '';
    const trade = tradeByKey.get(key);
    if (!trade || seen.has(key)) continue;
    const whyNot = clamp(row.why_not, WHY_NOT_MAX);
    if (!whyNot) continue;
    seen.add(key);
    // The LABEL is ours, not the reply's — a model must not be able to rename
    // a real trade in the eyes of the person about to compare it.
    nearMatches.push({ canonicalService: key, label: trade.label, whyNot });
  }

  return {
    suggestedLabel: name,
    suggestedTileId,
    tileReason,
    verdict: verdictRaw,
    closestExisting,
    nearMatches,
    draftedBy: model.slice(0, 60),
  };
}

/**
 * The first balanced `{…}` in a reply. Models wrap JSON in prose or a fenced
 * block often enough that demanding a bare object would throw away good
 * answers; a brace scan is the smallest thing that reads both.
 */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}
