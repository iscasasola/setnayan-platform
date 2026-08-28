/**
 * category-proposal-draft-server.ts — the one place the C4 draft is written.
 *
 * Split from the pure `category-proposal-draft.ts` for the same reason
 * `service-merge-forward-db.ts` is split from `service-merge-forward.ts`: the
 * rules must be unit-testable without pulling in `next/headers`, an Anthropic
 * client or a database.
 *
 * ── 🔒 IT CANNOT COST THE SUPPLIER THEIR REQUEST ────────────────────────────
 * `maybeDraftCategoryProposal` NEVER THROWS and never returns anything the
 * caller has to handle. No key, no network, a refusal, a bad shape, a missing
 * migration, a slow model — every one of them is the same outcome: no draft
 * row, and a request that has already been inserted and is already on its way
 * to the queue. A supplier must never meet an error about an assistant they did
 * not ask for, and must never lose a submission to one.
 *
 * ── ⛔ THE WRITE IS SCOPED BY AN ID WE MINTED, NOT ONE WE WERE HANDED ────────
 * The draft row is written with the SERVICE ROLE, because the drafts table has
 * no policy admitting a supplier — deliberately, so a signed-in stranger cannot
 * POST a forged "the assistant proposed this, under this branch" row through
 * PostgREST and have the admin queue present their guess as ours. The service
 * role sits outside RLS entirely, so the only thing keeping that honest is the
 * CALL SITE: `request_id` comes from `proposeCategory`'s own INSERT … RETURNING,
 * never from a form field. Do not add a parameter that lets a caller name the
 * request. (The rule is the call site, not the function — the same lesson the
 * Papic camera-minting seam paid for.)
 *
 * ── ⛔ AND IT MINTS NOTHING ─────────────────────────────────────────────────
 * The only table this module writes is `taxonomy_category_request_drafts`.
 * There is no path from here to `canonical_service_schemas`,
 * `canonical_service_taxonomy` or `promoteCategoryRequest`; a person presses.
 * `category-proposal-mints-nothing.test.ts` asserts that against the source.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

import { aiConfigured } from '@/lib/admin-map/ask-the-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { getReviewedTradeAliasRows } from '@/lib/service-trade-aliases-db';
import { reviewedAliasesByLiveTrade } from '@/lib/service-trade-aliases';
import { getServiceMergeForwards } from '@/lib/service-merge-forward-db';
import { isCategoryProposalDraftEnabled } from '@/lib/category-proposal-flag';
import {
  buildDraftPrompt,
  buildTradeMenu,
  lexicalDraft,
  parseDraftReply,
  DRAFT_MODEL,
  DRAFT_SYSTEM_PROMPT,
  type CategoryProposalDraft,
  type LiveTile,
  type LiveTrade,
} from '@/lib/category-proposal-draft';

/** A slow model must not hold a supplier's submit open. */
const MODEL_TIMEOUT_MS = 12_000;

/**
 * Draft a proposal for one just-filed category request, if the flag is on.
 *
 * Returns nothing. The caller carries on regardless — that is the contract.
 */
export async function maybeDraftCategoryProposal(
  requestId: string,
  typedLabel: string,
  note: string | null,
): Promise<void> {
  try {
    if (!isCategoryProposalDraftEnabled()) return;
    if (!requestId) return;

    const { tiles, trades } = await loadLiveTree();
    if (trades.length === 0 || tiles.length === 0) return;

    // ARM 1 — the shipped ranker, ₱0, no key required. Reached first because
    // most "new" categories are an existing trade under another name.
    let draft: CategoryProposalDraft | null = lexicalDraft(typedLabel, trades);

    // ARM 2 — only when the live list genuinely had nothing.
    if (!draft) draft = await askTheModelForADraft(typedLabel, note, tiles, trades);
    if (!draft) return;

    await writeDraft(requestId, draft);
  } catch {
    // Every failure is a normal miss: the request is already filed.
  }
}

/** Every visible trade + tile, with C2's reviewed aliases attached. */
async function loadLiveTree(): Promise<{ tiles: LiveTile[]; trades: LiveTrade[] }> {
  const tree = await getCoverageTaxonomy();
  const liveKeys = new Set<string>(
    tree.flatMap((p) => p.branches.flatMap((b) => b.leaves.map((l) => l.canonicalService))),
  );
  // Both reads fail silent to "no aliases" — the ranker then behaves exactly
  // as it did before C2 existed.
  const [aliasRows, mergeForwards] = await Promise.all([
    getReviewedTradeAliasRows().catch(() => []),
    getServiceMergeForwards().catch(() => ({})),
  ]);
  const aliasesByLiveKey = reviewedAliasesByLiveTrade(aliasRows, mergeForwards, liveKeys);

  const tiles: LiveTile[] = [];
  const trades: LiveTrade[] = [];
  for (const parent of tree) {
    for (const branch of parent.branches) {
      tiles.push({ id: branch.tileId, label: branch.label, folder: parent.label });
      for (const leaf of branch.leaves) {
        trades.push({
          key: leaf.canonicalService,
          label: leaf.label,
          tileId: branch.tileId,
          branch: branch.label,
          aliases: aliasesByLiveKey.get(leaf.canonicalService),
        });
      }
    }
  }
  return { tiles, trades };
}

/**
 * The model call. Carries the supplier's own words — which they typed for
 * exactly this purpose — and the public taxonomy. Nothing else: no other
 * shop, no couple, no event, no money.
 */
async function askTheModelForADraft(
  typedLabel: string,
  note: string | null,
  tiles: readonly LiveTile[],
  trades: readonly LiveTrade[],
): Promise<CategoryProposalDraft | null> {
  if (!aiConfigured()) return null;

  let message;
  try {
    const client = new Anthropic();
    message = await client.messages.create(
      {
        model: DRAFT_MODEL,
        max_tokens: 700,
        system: DRAFT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildDraftPrompt(typedLabel, note, buildTradeMenu(tiles, trades)),
          },
        ],
      },
      { timeout: MODEL_TIMEOUT_MS, maxRetries: 1 },
    );
  } catch {
    return null;
  }

  const text = message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n')
    .trim();
  // Validated against the live tree inside `parseDraftReply` — never shown
  // first and checked afterwards.
  return parseDraftReply(text, tiles, trades, DRAFT_MODEL);
}

/** One upsert, so a re-filed request cannot collide with its own older draft. */
async function writeDraft(requestId: string, draft: CategoryProposalDraft): Promise<void> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }
  const { error } = await admin.from('taxonomy_category_request_drafts').upsert(
    {
      request_id: requestId,
      suggested_label: draft.suggestedLabel,
      suggested_tile_id: draft.suggestedTileId,
      tile_reason: draft.tileReason,
      verdict: draft.verdict,
      closest_existing: draft.closestExisting,
      near_matches: draft.nearMatches.map((m) => ({
        canonical_service: m.canonicalService,
        label: m.label,
        why_not: m.whyNot,
      })),
      drafted_by: draft.draftedBy,
      drafted_at: new Date().toISOString(),
    },
    { onConflict: 'request_id' },
  );
  if (error) logQueryError('writeDraft (taxonomy_category_request_drafts)', error);
}
