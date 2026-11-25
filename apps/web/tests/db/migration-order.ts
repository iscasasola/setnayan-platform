/**
 * THE MIGRATION ORDERING ENGINE — the ONE place that decides the order the
 * migrations in `supabase/migrations` are applied to a database built from them.
 *
 * Moved here, unchanged, from `replay-migrations.ts` (2026-11-25) so that a
 * database that is NOT PGlite can be driven by the same rule without loading
 * PGlite: the release rehearsal (tests/rehearsal/apply-migrations.mts), the
 * demo-shop database (scripts/demo-shop/replay-into-postgres.ts) and the
 * final-check staging branch (scripts/staging/apply-migrations.ts) apply real
 * Postgres through this engine, and every `*.db.test.ts` replay goes through it
 * too. `replay-migrations.ts` re-exports everything here, so its importers did
 * not move.
 *
 * ⛔ NO I/O AND NO DATABASE DRIVER IN THIS FILE. A caller hands the engine an
 * `ApplyPort`; the engine decides only WHICH file to attempt next. Adding a
 * second ordering anywhere else is the defect this file exists to prevent.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** apps/web/tests/db → repo root is four levels up. */
export const MIGRATIONS_DIR = path.resolve(HERE, '../../../../supabase/migrations');

/**
 * THE OWNER PRECONDITION. Production's owner had signed in once before the
 * migrations that provision him ran; `OWNER_FILE` RAISEs when he is absent. A
 * database built from the migrations therefore carries a stand-in owner row
 * (this fixed id, his email) in `auth.users` before the first file, and
 * re-inserts it just before `OWNER_FILE` so the real `on_auth_user_created`
 * trigger provisions his profile row, exactly as in production.
 */
export const OWNER_UUID = '11111111-1111-4111-8111-111111111111';
export const OWNER_EMAIL = 'iscasasolaii@gmail.com';
export const OWNER_FILE = '20260705000000_provision_owner_vendor_and_remove_prefilled.sql';

export const ALLOWED_SKIP: ReadonlyMap<string, string> = new Map([
  [
    '20270405784887_seed_founder_vendor_demo_stats.sql',
    'demo-stats seed keyed to a prod-only founder vendor UUID (aborts by design when absent)',
  ],
  [
    '20270110320023_invitation_widgets_our_love_story.sql',
    'back-numbered file: re-adds a widget_type CHECK narrower than rows later-numbered (earlier-applied) migrations already inserted',
  ],
  [
    '20270712300100_subdomain_sku_event_and_vendor.sql',
    'catalog seed whose offering_type predates the final CHECK on vendor_billing_catalog (ordering artifact; resolves via retry on most runs)',
  ],
  [
    '20270723385655_keep_full_res_archive_sku.sql',
    'catalog seed whose billing_period predates the final CHECK on platform_retail_catalog_v2 (ordering artifact; resolves via retry on most runs)',
  ],
]);

/**
 * ⚠ THE FILES THAT STILL CANNOT APPLY AT THEIR OWN POSITION — measured
 * 2026-08-31, down from seven. Both are the 2026-05-30 amendment pair, both
 * need `vendor_billing_catalog`, and both now land immediately after the file
 * that creates it instead of after the whole corpus.
 *
 * Pinned by `replay-order-is-honest.db.test.ts` (the replay must land exactly
 * these, exactly here) and printed by `scripts/staging/apply-migrations.ts
 * --dry-run` as the order a real branch should expect. One list, two readers.
 *
 * ⛔ DO NOT ADD A ROW HERE TO GO GREEN. A new entry means a new back-numbered
 * migration, and the question to answer is what it WRITES and what it jumped
 * over — not how to make this line pass.
 */
export const EXPECTED_OUT_OF_ORDER: Readonly<Record<string, string>> = {
  '20260530010000_iteration_0006_v2_1_amendment_2.sql':
    '20260631000000_v2_pricing_table_alignment.sql',
  '20260530030000_iteration_0006_v2_1_amendment_2_titles.sql':
    '20260631000000_v2_pricing_table_alignment.sql',
};

/**
 * A migration that could NOT apply at its own position in filename order, and
 * the point at which it finally did. `landedAfterIndex` is the EARLIEST index
 * at which the file succeeded, so every migration numbered above
 * `landedAfter` still runs AFTER it — which is the whole property that keeps
 * an old seed from overwriting a newer reprice. See `replayInFilenameOrder`.
 */
export type OutOfOrderApplication = {
  /** The back-numbered migration. */
  file: string;
  /** Its own index in filename order (0-based). */
  index: number;
  /** The file after whose successful apply it finally went in. */
  landedAfter: string;
  /** That file's index. */
  landedAfterIndex: number;
  /** First line of the error it raised at its own position. */
  reason: string;
  /**
   * 🚨 TRUE means it landed after the WHOLE corpus, not at the earliest index
   * that works — the 2026-08-31 defect. Reachable only for a file whose
   * failure named no object the drain could probe. `createReplayedDb` does not
   * return such a database: it rebuilds from scratch with that file forced
   * eager. A `true` here in a returned `ReplayResult` would be a bug.
   */
  viaFinalPass: boolean;
};

/**
 * The seam the ordering engine writes through. Split out from PGlite so the
 * ordering rule can be tested with a fake corpus in milliseconds — the real
 * corpus takes ~8 s and cannot express "an old file that overwrites a new one"
 * as a controlled experiment.
 */
export type ApplyPort = {
  apply(file: string): Promise<void>;
  /** Discard the transaction an aborted apply left open. */
  rollback(): Promise<void>;
  /**
   * Is `obj` STILL absent from the database?
   *
   * OPTIONAL, and its absence is the safe default: a port that cannot answer
   * gets the unconditional drain — every deferred file retried after every
   * successful apply. Supplying it only ever lets the drain SKIP a retry it
   * can prove is pointless.
   */
  isStillMissing?(obj: MissingObject): Promise<boolean>;
};

/** A database object a failed migration named as missing. */
export type MissingObject =
  | { kind: 'relation'; name: string }
  | { kind: 'column'; relation: string; name: string };

/**
 * The object a Postgres error names as missing, or `null` when it names none.
 *
 * ⛔ ONLY THE TWO SHAPES THIS CORPUS ACTUALLY PRODUCES are parsed, and that is
 * deliberate. A shape this cannot read returns `null`, which costs speed and
 * never costs ordering (see `replayInFilenameOrder`). Widening it to guess at
 * a shape would trade the other way.
 *
 * ⚠ `check constraint "…" of relation "invitation_widgets" is violated by some
 * row` also contains `of relation "…"`, and must NOT parse — the relation is
 * present, the ROWS are the problem. Both patterns are therefore anchored to
 * the whole line, not searched inside it.
 */
export function parseMissingObject(errorFirstLine: string): MissingObject | null {
  const line = errorFirstLine.trim();
  const rel = /^relation "([^"]+)" does not exist$/.exec(line);
  if (rel) return { kind: 'relation', name: rel[1]! };
  const col = /^column "([^"]+)" of relation "([^"]+)" does not exist$/.exec(line);
  if (col) return { kind: 'column', relation: col[2]!, name: col[1]! };
  return null;
}

export type ReplayOrder = {
  applied: number;
  /** Files that never applied at all, → the last error each raised. */
  deferred: Map<string, string>;
  outOfOrder: OutOfOrderApplication[];
  /**
   * Retries the drain skipped because it PROVED the named object was still
   * absent. Zero means the probe gate did nothing — which is a silent
   * regression to the slow path, so a test pins it above zero.
   */
  probeSkips: number;
  /** Retries skipped because the failure named nothing probeable. */
  blindSkips: number;
  /** Skips that `auditSkips` re-attempted and confirmed would have failed. */
  auditedSkips: number;
};

export type ReplayOrderOptions = {
  /**
   * Files to retry eagerly whatever their error shape. `createReplayedDb`
   * fills this in on a rebuild, after a file surprised it by applying in the
   * final pass.
   */
  forceEager?: ReadonlySet<string>;
  /**
   * Re-attempt every skipped retry and PROVE it fails. Restores the full cost
   * of the unconditional drain, so it is for the guard that checks the gate is
   * sound, not for ordinary runs.
   */
  auditSkips?: boolean;
};

/**
 * ⚠ THE ORDERING RULE, AND THE DEFECT IT REPLACED — measured 2026-08-31.
 *
 * This corpus is not strictly linear: a handful of files are back-numbered
 * relative to objects they touch (prod converged via repeated `db push` over
 * time, applying each file ONCE when it was authored). A replay from an empty
 * database therefore has to do something when a file fails on its own turn.
 *
 * 🚨 WHAT IT USED TO DO: collect every failure, then retry the collection to a
 * fixpoint AFTER the whole corpus had run. That put the back-numbered files
 * LAST — so the OLDEST file won. Seven files took that path on a normal run,
 * all cascading from ONE root: `20260530010000` (index 116) needs
 * `vendor_billing_catalog`, which `20260631000000` (index 187) creates. It was
 * therefore replayed after index 1269 — and it carries
 *
 *     UPDATE vendor_billing_catalog SET price_php = 2499 WHERE sku_code = 'pro_vendor_monthly';
 *     UPDATE vendor_billing_catalog SET price_php = 24999 WHERE sku_code = 'pro_vendor_annual';
 *
 * which overwrote the 2026-08-27 owner price sheet (`20271171000513`, index
 * 1212) in EVERY database built from migrations. Both of the rows that file
 * writes, and only those two, disagreed with the price sheet's own
 * postcondition — re-running the price sheet against the finished replay
 * raised its own guard, `a rung the owner left alone has moved`. Production
 * never had this: it applied each migration once, in authored order, and never
 * re-ran a 2026-05-30 seed after a 2026-08-27 reprice.
 *
 * ✅ WHAT IT DOES NOW: drain the deferred set EAGERLY — after every successful
 * apply, retry the deferred files to a local fixpoint before advancing. A
 * back-numbered file therefore lands at the earliest index at which it can
 * succeed (`20260530010000` now goes in right after `20260631000000`), so
 * every higher-numbered migration still runs after it and the LAST writer to a
 * row is the highest-numbered one — the same last-writer-wins prod has.
 *
 * 🔑 WHY NOT THE OTHER TWO OPTIONS.
 *   · "After the fixpoint, re-apply the later files a deferred file could have
 *     clobbered" — migrations are not idempotent. Re-running `20271171000513`
 *     against the finished replay does not repair it, it RAISES; and "could
 *     have clobbered" is not knowable without executing the file.
 *   · "Fail loudly instead of reordering at all" — that reds 1,924 db tests on
 *     arrival for a corpus that genuinely is back-numbered, and a guard that
 *     is red on arrival gets deleted. Loudness is kept where it is affordable:
 *     every out-of-order landing is REPORTED in `ReplayResult.outOfOrder` and
 *     pinned by a test, so the next one is seen instead of absorbed.
 *
 * ⛔ A FAILED APPLY ROLLS BACK AND CHANGES NOTHING, so the drain only runs
 * after a SUCCESS, and there is no final fixpoint pass — a file that fails on
 * the last index cannot succeed on a re-attempt against an unchanged database.
 */
export async function replayInFilenameOrder(
  files: readonly string[],
  port: ApplyPort,
  opts: ReplayOrderOptions = {},
): Promise<ReplayOrder> {
  const ordered = [...files].sort();
  const indexOf = new Map(ordered.map((f, i) => [f, i] as const));
  const deferred = new Map<string, string>();
  const firstFailure = new Map<string, string>();
  const outOfOrder: OutOfOrderApplication[] = [];
  const forceEager = opts.forceEager ?? new Set<string>();
  let applied = 0;
  let probeSkips = 0;
  let blindSkips = 0;
  let auditedSkips = 0;

  async function attempt(f: string): Promise<boolean> {
    try {
      await port.apply(f);
      applied++;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!firstFailure.has(f)) firstFailure.set(f, msg.split('\n')[0] ?? msg);
      deferred.set(f, msg);
      await port.rollback();
      return false;
    }
  }

  function land(f: string, after: string, afterIndex: number, viaFinalPass: boolean): void {
    deferred.delete(f);
    outOfOrder.push({
      file: f,
      index: indexOf.get(f) ?? -1,
      landedAfter: after,
      landedAfterIndex: afterIndex,
      reason: firstFailure.get(f) ?? '',
      viaFinalPass,
    });
  }

  /**
   * May this retry be skipped, and on what grounds?
   *
   * `'probe'` — the file's LAST error named an object that is still absent, so
   * the attempt would fail at the same statement. Not a guess: the statements
   * before it already succeeded, and the one that failed still has nothing to
   * bind to. `auditSkips` re-attempts every one of these and proves it.
   * `'blind'` — the failure named nothing probeable; deferred to the final
   * pass, which is the ONLY place ordering is traded, and the trade is undone
   * by the rebuild in `createReplayedDb`.
   * `null` — attempt it.
   *
   * ⛔ A PROBE THAT THROWS RETURNS false, i.e. "attempt it". Every uncertainty
   * resolves toward doing the work, never toward skipping it.
   */
  async function skipGrounds(f: string): Promise<'probe' | 'blind' | null> {
    if (!port.isStillMissing || forceEager.has(f)) return null;
    const obj = parseMissingObject((deferred.get(f) ?? '').split('\n')[0] ?? '');
    if (!obj) return 'blind';
    const missing = await port.isStillMissing(obj).catch(() => false);
    return missing ? 'probe' : null;
  }

  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i]!;
    const ok = await attempt(f);
    if (!ok || deferred.size === 0) continue;
    // Drain to a LOCAL fixpoint before advancing to i + 1.
    for (;;) {
      let progressed = false;
      for (const d of [...deferred.keys()].sort()) {
        const grounds = await skipGrounds(d);
        if (grounds) {
          if (grounds === 'probe') probeSkips++;
          else blindSkips++;
          if (!opts.auditSkips) continue;
          auditedSkips++;
          if (await attempt(d)) {
            throw new Error(
              `replay skip-gate is UNSOUND: ${d} was skipped as still-blocked and then APPLIED ` +
                `on the very next attempt (grounds: ${grounds}). Its last error was ` +
                `${JSON.stringify(firstFailure.get(d) ?? '')}. A skip must never hide a file ` +
                `that could have gone in here — that is the reordering this harness exists to stop.`,
            );
          }
          continue;
        }
        if (!(await attempt(d))) continue;
        land(d, f, i, false);
        progressed = true;
      }
      if (!progressed) break;
    }
  }

  // ── THE FINAL PASS — the one place ordering is traded, and it is undone ──
  // Only files whose failure named nothing probeable reach here unattempted.
  // If one APPLIES, it landed after the whole corpus: the 2026-08-31 defect.
  // It is recorded with viaFinalPass so createReplayedDb rebuilds with that
  // file forced eager rather than returning a database it silently reordered.
  if (deferred.size > 0) {
    const lastIndex = ordered.length - 1;
    const lastFile = ordered[lastIndex] ?? '';
    for (;;) {
      let progressed = false;
      for (const d of [...deferred.keys()].sort()) {
        if (!(await attempt(d))) continue;
        land(d, lastFile, lastIndex, true);
        progressed = true;
      }
      if (!progressed) break;
    }
  }

  return { applied, deferred, outOfOrder, probeSkips, blindSkips, auditedSkips };
}

/**
 * Build, and REBUILD until nothing landed after the whole corpus.
 *
 * Split out from `createReplayedDb` for one reason: it is the undo for the only
 * concession the fast path makes, and an undo nobody can exercise is an undo
 * nobody can trust. On the real corpus it never fires — both files that could
 * trigger it never apply at all — so without this seam its only test would be
 * "it did not happen", which is what an unreachable branch looks like too.
 *
 * `discard` throws away a database built in the wrong order; nothing that
 * reordered is ever returned.
 */
export type SettleBuild<T> = {
  build(forceEager: ReadonlySet<string>): Promise<{ order: ReplayOrder; handle: T }>;
  discard(handle: T): Promise<void>;
};

export async function settleOrder<T>(
  b: SettleBuild<T>,
  maxRebuilds = 3,
): Promise<{ order: ReplayOrder; handle: T; rebuilds: number }> {
  let forceEager = new Set<string>();
  let built = await b.build(forceEager);
  for (let rebuilds = 0; ; rebuilds++) {
    // ⛔ EVERY late landing counts, INCLUDING one already forced eager. Filtering
    // those out first would have made "we forced it and it landed late anyway"
    // look like "nothing landed late" — returning the reordered database this
    // function exists to prevent.
    const late = built.order.outOfOrder.filter((o) => o.viaFinalPass);
    if (late.length === 0) return { ...built, rebuilds };

    const fixable = late.filter((o) => !forceEager.has(o.file));
    await b.discard(built.handle);
    if (fixable.length === 0 || rebuilds >= maxRebuilds) {
      throw new Error(
        `migration replay could not settle an order: ${late
          .map((o) => o.file)
          .join(', ')} still land after the whole corpus after ${rebuilds + 1} ` +
          `build(s)${fixable.length === 0 ? ', already forced eager' : ''}`,
      );
    }
    forceEager = new Set([...forceEager, ...fixable.map((o) => o.file)]);
    built = await b.build(forceEager);
  }
}

/** The leading numeric field of a migration filename, e.g. `20271011120000`. */
export function versionOf(filename: string): string {
  return filename.split('_')[0] ?? '';
}
