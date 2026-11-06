/**
 * EVERY READER OF PAPIC MEDIA FOR SOMEBODY ELSE SHOWS ONLY WHAT THE SCREEN PASSED —
 * the reader list is DERIVED from the source tree, never hand-typed.
 *
 * Review 2026-10-23 (minor 10): the first screening guard named five files. A
 * sixth reader — "Release to Drive" (lib/photo-delivery-release.ts) — handed
 * unscreened originals to the couple's Drive, and the guard could not see it
 * because nobody had typed its name. So this walks every non-test file under
 * `app/` and `lib/`, strips comments, and finds every query on a Papic capture
 * table whose `.select(...)` names a MEDIA KEY column (or is not a literal, so
 * cannot be proven either way). Each must be SCREENED:
 *
 *   papic_guest_captures / papic_photos → `.eq('moderation_state', 'clean')`
 *     (or the shared PUBLIC_SAFE_MODERATION_STATE), or select moderation_state
 *     and compare `=== 'clean'` / isPublicSafeModerationState( in that file.
 *     `!== 'nsfw_blocked'` is NOT screening — 'unscreened' is unseen, not safe.
 *   vendor_papic_captures → `.eq('nsfw_checked', true)`, or select nsfw_checked
 *     and compare it in that file.
 *
 * The set of unscreened readers must EQUAL the exemption bill below, both ways:
 *   • a NEW unscreened reader → red, until it filters or earns a reasoned line;
 *   • a line whose file no longer has an unscreened read → red, until deleted.
 *
 * ⚠ What it cannot see, said plainly: a table name held in a variable
 * (`.from(table)`). Those files pass a table string literal elsewhere in the
 * same function in every case measured 2026-10-23; a new one is a reason to
 * extend this, not to trust it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd().endsWith('/apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

const MEDIA =
  /\b(r2_object_key|display_r2_key|thumb_r2_key|tile_r2_key|poster_r2_key|clip_web_r2_key|wall_safe_r2_key|safe_display_r2_key|safe_thumb_r2_key|safe_tile_r2_key)\b/;

type Gate = 'clean' | 'nsfw_checked';
const TABLES: Record<string, Gate> = {
  papic_guest_captures: 'clean',
  papic_photos: 'clean',
  vendor_papic_captures: 'nsfw_checked',
};

/**
 * Files allowed an unscreened media read, each with its reason. Exact: every
 * line must still be needed.
 */
const EXEMPT: Record<string, string> = {
  'app/admin/user-reports/page.tsx': 'admin console — a report is reviewed BECAUSE it may be unsafe',
  'app/dashboard/[eventId]/studio/papic/moderation/page.tsx':
    'the couple’s moderation queue — it exists to look at what the screen held back',
  'app/dashboard/[eventId]/studio/papic/moderation/_components/kwento-queue.tsx':
    'the couple’s moderation queue (Kwento leg) — same reason',
  'app/papic/actions.ts': 'the shooter’s OWN seat photo (claimer_user_id = user), to attach its web copy',
  'app/api/papic/guest-capture/route.ts': 'the shooter’s OWN capture row (guest_id = session) — the record/attach route itself',
  'app/api/vendor/papic-capture/route.ts': 'the shooter’s OWN capture row (vendor_profile_id = own profile) — the record/attach route itself',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/own-captures-strip.tsx': 'the supplier’s OWN strip',
  'lib/papic-fullres-drop.ts': 'storage sweep — reads keys to drop originals, shows nothing to anyone',
  'lib/event-media-sweep.ts': 'storage sweep — reads keys to delete an erased event’s media',
};

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

interface Read {
  table: string;
  at: number;
  screened: boolean;
}

/** Every media read on a Papic capture table in one comment-stripped source. */
export function mediaReads(src: string): Read[] {
  const reads: Read[] = [];
  const re = /\.from\(\s*['"](papic_guest_captures|papic_photos|vendor_papic_captures)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const table = m[1]!;
    const end = src.indexOf(';', m.index);
    const chain = src.slice(m.index, end > -1 ? Math.min(end, m.index + 4000) : m.index + 4000);
    const head = chain.slice(0, chain.search(/\.select\(|$/));
    if (/\.(update|insert|upsert|delete)\(/.test(head)) continue; // a write's returning clause
    const sel = /\.select\(\s*(['"`])([\s\S]*?)\1/.exec(chain);
    const opaque = /\.select\(/.test(chain) && !sel;
    if (!opaque && (!sel || !MEDIA.test(sel[2]!))) continue;
    const cols = sel?.[2] ?? '';
    const gate = TABLES[table]!;
    let screened: boolean;
    if (gate === 'clean') {
      screened =
        /\.eq\(\s*['"]moderation_state['"]\s*,\s*(['"]clean['"]|PUBLIC_SAFE_MODERATION_STATE)\s*\)/.test(chain) ||
        (/\bmoderation_state\b/.test(cols) &&
          (/moderation_state\s*===\s*['"]clean['"]/.test(src) || /isPublicSafeModerationState\(/.test(src)));
    } else {
      screened =
        /\.eq\(\s*['"]nsfw_checked['"]\s*,\s*true\s*\)/.test(chain) ||
        (/\bnsfw_checked\b/.test(cols) && /nsfw_checked\s*[!=]==\s*true/.test(src));
    }
    reads.push({ table, at: m.index, screened });
  }
  return reads;
}

test('every Papic media read for someone else is screened — or carries a reasoned exemption', () => {
  const offenders = new Map<string, string[]>();
  for (const file of [...walk(join(WEB, 'app'), []), ...walk(join(WEB, 'lib'), [])]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const bad = mediaReads(src).filter((r) => !r.screened);
    if (bad.length) offenders.set(relative(WEB, file), bad.map((r) => r.table));
  }
  const unexpected = [...offenders.keys()].filter((f) => !(f in EXEMPT));
  assert.deepEqual(
    unexpected,
    [],
    `unscreened Papic media readers (filter moderation_state='clean' / nsfw_checked, or add a reasoned EXEMPT line):\n${unexpected
      .map((f) => `  ${f} — ${offenders.get(f)!.join(', ')}`)
      .join('\n')}`,
  );
  const stale = Object.keys(EXEMPT).filter((f) => !offenders.has(f));
  assert.deepEqual(stale, [], `EXEMPT lines whose file no longer reads unscreened media — delete them:\n  ${stale.join('\n  ')}`);
});

test('the detector itself: it convicts the shapes it exists for and clears the screened ones', () => {
  const read = (body: string) => mediaReads(body)[0];
  assert.equal(read(`admin.from('papic_guest_captures').select('r2_object_key').eq('event_id', e);`)?.screened, false);
  assert.equal(
    read(`admin.from('papic_guest_captures').select('r2_object_key').neq('moderation_state', 'nsfw_blocked');`)?.screened,
    false,
    '`!= nsfw_blocked` lets unscreened through',
  );
  assert.equal(read(`a.from('papic_photos').select('thumb_r2_key').eq('moderation_state', 'clean');`)?.screened, true);
  assert.equal(read(`a.from('papic_photos').select(cols).eq('event_id', e);`)?.screened, false, 'an opaque select must be proven');
  assert.equal(read(`a.from('vendor_papic_captures').select('display_r2_key').eq('nsfw_checked', true);`)?.screened, true);
  assert.equal(read(`a.from('vendor_papic_captures').select('display_r2_key');`)?.screened, false);
  assert.equal(mediaReads(`a.from('papic_photos').select('photo_id').eq('event_id', e);`).length, 0, 'no media column → not a media read');
  assert.equal(mediaReads(`a.from('papic_photos').update({ x: 1 }).select('r2_object_key');`).length, 0, 'a write is not a read');
});
