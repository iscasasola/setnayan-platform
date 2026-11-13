/**
 * 🔔 ONE MEMORY FOR "Got it" / "Not now" / "Hide" (owner approved 14 Nov 2026, see `lib/notices.ts`).
 *
 * A signed-in person's closes live in `public.notice_closes` (own rows only, RLS), so a close follows them to a new
 * phone. A guest with no account keeps using this browser. Every close is ALSO written to this browser, so a refused
 * or dropped write still hides the notice here — and a read that fails falls back to the browser, never to "never
 * closed" for something this browser saw closed.
 *
 * ⚡ The browser client (~43KB gzipped) is import()ed on first use, never statically: the notice parts are in the first
 * load of signed-in pages (`scripts/check-maker-js-budget.mjs`).
 *
 * BROWSER ONLY — every function is called from an effect or a click.
 */
import { safeKey, type CloseRecord } from './notices';

const LOCAL = (key: string) => `setnayan.notice.${key}`;

function readLocal(key: string): CloseRecord | null {
  try {
    const raw = window.localStorage.getItem(LOCAL(key));
    if (!raw) return null;
    const v = JSON.parse(raw) as { at?: unknown; n?: unknown };
    const at = typeof v.at === 'number' ? v.at : NaN;
    const n = typeof v.n === 'number' ? v.n : 1;
    return Number.isFinite(at) ? { closedAt: at, count: Math.max(1, n) } : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, rec: CloseRecord) {
  try {
    window.localStorage.setItem(LOCAL(key), JSON.stringify({ at: rec.closedAt, n: rec.count }));
  } catch {
    /* private window — the notice still goes for this visit */
  }
}

function later(a: CloseRecord | null | undefined, b: CloseRecord | null | undefined): CloseRecord | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return { closedAt: Math.max(a.closedAt, b.closedAt), count: Math.max(a.count, b.count) };
}

async function signedIn() {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  return { supabase, userId };
}

/** The memory of each key; a key never closed is absent. */
export async function loadCloses(keys: readonly string[]): Promise<Map<string, CloseRecord>> {
  const out = new Map<string, CloseRecord>();
  for (const k of keys) {
    const local = readLocal(safeKey(k));
    if (local) out.set(k, local);
  }
  if (keys.length === 0) return out;
  try {
    const { supabase, userId } = await signedIn();
    if (!userId) return out;
    const { data, error } = await supabase
      .from('notice_closes')
      .select('notice_key, closed_at, close_count')
      .eq('user_id', userId)
      .in('notice_key', keys.map(safeKey));
    if (error || !data) return out;
    const byKey = new Map<string, CloseRecord>();
    for (const r of data as { notice_key: string; closed_at: string; close_count: number }[]) {
      const at = Date.parse(r.closed_at);
      if (Number.isFinite(at)) byKey.set(r.notice_key, { closedAt: at, count: r.close_count });
    }
    for (const k of keys) {
      const merged = later(out.get(k), byKey.get(safeKey(k)));
      if (merged) out.set(k, merged);
    }
  } catch {
    /* the browser's memory stands */
  }
  return out;
}

/** Record one close; answers the new memory. */
export async function saveClose(key: string, prev: CloseRecord | null): Promise<CloseRecord> {
  const k = safeKey(key);
  const rec: CloseRecord = { closedAt: Date.now(), count: (prev?.count ?? 0) + 1 };
  writeLocal(k, rec);
  try {
    const { supabase, userId } = await signedIn();
    if (userId) {
      await supabase.from('notice_closes').upsert(
        { user_id: userId, notice_key: k, closed_at: new Date(rec.closedAt).toISOString(), close_count: rec.count },
        { onConflict: 'user_id,notice_key' },
      );
    }
  } catch {
    /* kept in this browser */
  }
  return rec;
}
