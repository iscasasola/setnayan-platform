/**
 * service-card-checks.server.ts — the reads behind the checks before Create (see `service-card-checks.ts`).
 *
 * Read ONCE by the page that renders the maker (passed down as a prop) and again by the save (the fence). Every
 * part is its data or `null`; a `null` part makes the evaluator report "we couldn't finish the check" and the card
 * cannot be created — fail-CLOSED, unlike the maker's own taxonomy reads, which fail soft on purpose.
 *
 * 🔒 SERVICE ROLE, DELIBERATELY: `card_claim_words` is admin-only under RLS (a supplier must not read or edit the
 * list), and `canonical_service_aliases` answers an ordinary session only its reviewed rows anyway. The caller has
 * proven the shop from the session already.
 *
 * 🔑 NO HARD-CODED TAXONOMY. The service words, labels and families come from Admin › Categories' own tables:
 * `canonical_service_taxonomy` (leaf → tier-1 folder, `merged_into`), `canonical_service_schemas` (display names),
 * `canonical_service_aliases` (reviewed search words) and `service_categories` (a non-leaf key's place in the tree).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CardCheckContext, ServiceWords } from '@/lib/service-card-checks';

type Admin = ReturnType<typeof createAdminClient>;

async function readClaimWords(admin: Admin): Promise<string[] | null> {
  const { data, error } = await admin.from('card_claim_words').select('phrase');
  if (error || !data) {
    console.error('[supabase-error] lib/service-card-checks.server.ts · from:card_claim_words.select', error);
    return null;
  }
  return (data as { phrase: string }[]).map((r) => r.phrase);
}

async function readServiceWords(admin: Admin): Promise<ServiceWords | null> {
  const [taxonomy, schemas, aliases, cats] = await Promise.all([
    admin.from('canonical_service_taxonomy').select('canonical_service, folder_id, merged_into'),
    admin.from('canonical_service_schemas').select('canonical_service, display_name_en, display_name_tl, display_name_ceb'),
    admin.from('canonical_service_aliases').select('phrase, canonical_service').not('reviewed_at', 'is', null),
    admin.from('service_categories').select('id, parent_id, tier, label_en'),
  ]);
  const err = taxonomy.error ?? schemas.error ?? aliases.error ?? cats.error;
  if (err || !taxonomy.data || !schemas.data || !aliases.data || !cats.data) {
    console.error('[supabase-error] lib/service-card-checks.server.ts · taxonomy reads', err);
    return null;
  }

  const mergedInto = new Map<string, string>();
  const family: Record<string, string> = {};
  for (const t of taxonomy.data as { canonical_service: string; folder_id: string | null; merged_into: string | null }[]) {
    if (t.merged_into) mergedInto.set(t.canonical_service, t.merged_into);
    if (t.folder_id) family[t.canonical_service] = t.folder_id;
  }
  // A key that is not a leaf (a legacy or tile key) takes the tier-1 folder above it in service_categories.
  const catRows = cats.data as { id: string; parent_id: string | null; tier: number | null; label_en: string | null }[];
  const byId = new Map(catRows.map((c) => [c.id, c]));
  const label: Record<string, string> = {};
  for (const c of catRows) {
    if (c.label_en?.trim()) label[c.id] = c.label_en.trim();
    if (family[c.id]) continue;
    let cur: typeof c | undefined = c;
    let guard = 0;
    while (cur && cur.tier !== 1 && cur.parent_id && guard++ < 6) cur = byId.get(cur.parent_id);
    if (cur && cur.tier === 1 && c.tier !== 1) family[c.id] = cur.id;
  }

  const forward = (k: string) => mergedInto.get(k) ?? k;
  const words: Record<string, string[]> = {};
  const add = (k: string, w: string | null | undefined) => {
    const t = (w ?? '').trim().toLowerCase();
    if (!t) return;
    const key = forward(k);
    const list = (words[key] ??= []);
    if (!list.includes(t)) list.push(t);
  };
  for (const s of schemas.data as {
    canonical_service: string;
    display_name_en: string | null;
    display_name_tl: string | null;
    display_name_ceb: string | null;
  }[]) {
    add(s.canonical_service, s.display_name_en);
    add(s.canonical_service, s.display_name_tl);
    add(s.canonical_service, s.display_name_ceb);
    if (s.display_name_en?.trim()) label[forward(s.canonical_service)] = s.display_name_en.trim();
  }
  for (const a of aliases.data as { phrase: string; canonical_service: string }[]) add(a.canonical_service, a.phrase);

  return { words, label, family };
}

/** Everything the checks read. Never throws: a part that fails is `null` (and blocks). */
export async function loadCardCheckContext(): Promise<CardCheckContext> {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error('[service-card-checks] no admin client', e);
    return { claimWords: null, services: null };
  }
  const safe = async <T>(p: () => Promise<T | null>): Promise<T | null> => {
    try {
      return await p();
    } catch (e) {
      console.error('[service-card-checks] read threw', e);
      return null;
    }
  };
  const [claimWords, services] = await Promise.all([safe(() => readClaimWords(admin)), safe(() => readServiceWords(admin))]);
  return { claimWords, services };
}
