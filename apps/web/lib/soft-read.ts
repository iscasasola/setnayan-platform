/**
 * soft-read.ts
 *
 * An optional read that is allowed to fail without taking the page down — and
 * is NOT allowed to fail invisibly.
 *
 * ─── WHY THIS IS SHARED AND NOT LOCAL TO A PAGE ─────────────────────────────
 * `count ?? 0` and `.catch(() => [])` appear in hundreds of places. Most are
 * fine: a zero that is a genuine tally, or a surface only staff see. The defect
 * is narrower and specific — **a read that can fail, whose zero is then shown
 * to a person as a fact about them.** "Saved by couples: 0" is not a blank. It
 * is an assertion that nobody saved this supplier's shop, and the supplier has
 * no way to tell it apart from the truth.
 *
 * 🔑 A ZERO ON A PERFORMANCE TILE IS A CLAIM. An error says the system failed;
 * a zero says *you* failed. That is why these return `null` for "unknown"
 * rather than `0`, and why the caller must render the difference.
 *
 * This lives in `lib/` so the same helper can be pointed at other surfaces
 * without being rewritten — the question of how wide the defect really is has
 * been measured on exactly one page so far.
 *
 * ─── TWO HELPERS, BECAUSE THERE ARE TWO FAILURE SHAPES ──────────────────────
 * `softRead`  — for a promise that REJECTS.
 * `softCount` — for a supabase builder, which does NOT reject: it RESOLVES with
 *               `{ count: null, error }`. A `.catch()` on one of those is
 *               decorative; the rejection arm almost never runs, and the
 *               failure arrives through the SUCCESS path as a null that `?? 0`
 *               then turns into a confident zero. This reads `error`.
 */
import { logQueryError } from '@/lib/supabase/error-detect';

/** Which optional reads failed on this render, by label. */
export class SoftReadLog {
  private readonly failed = new Set<string>();

  constructor(private readonly callSitePrefix: string) {}

  mark(label: string): void {
    this.failed.add(label);
  }

  /** Did this specific read fail? */
  broke(label: string): boolean {
    return this.failed.has(label);
  }

  /**
   * Did this read fail, OR anything it depends on?
   *
   * 🪤 THE REASON THIS EXISTS. When `poolBookings` fails it degrades to `[]`,
   * so the reads that take its ids as INPUT then succeed and correctly return
   * nothing. Their own probes are honest and their tiles would be certified
   * honest-empty — while showing zero because of a failure two steps upstream.
   * A failure marker has to travel with the DATA, not sit on the probe.
   */
  brokeWith(label: string, ...dependsOn: string[]): boolean {
    return this.broke(label) || dependsOn.some((d) => this.broke(d));
  }

  get any(): boolean {
    return this.failed.size > 0;
  }

  /** For logging/diagnostics — never for control flow. */
  get labels(): string[] {
    return [...this.failed].sort();
  }

  /** A promise that may reject. Logs, marks, and returns `fallback`. */
  async read<T>(label: string, run: () => PromiseLike<T>, fallback: T): Promise<T> {
    try {
      return await run();
    } catch (err) {
      logQueryError(`${this.callSitePrefix}.${label}`, err, { soft_read: label });
      this.mark(label);
      return fallback;
    }
  }

  /**
   * A supabase `{ count, error }` read. Returns `null` — NOT 0 — when it could
   * not be read, so the caller is forced to decide what to render rather than
   * silently inheriting a zero.
   */
  async count(
    label: string,
    run: () => PromiseLike<{ count: number | null; error: unknown }>,
  ): Promise<number | null> {
    try {
      const { count, error } = await run();
      if (error) {
        logQueryError(`${this.callSitePrefix}.${label}`, error, { soft_read: label });
        this.mark(label);
        return null;
      }
      return count ?? 0;
    } catch (err) {
      logQueryError(`${this.callSitePrefix}.${label}`, err, { soft_read: label });
      this.mark(label);
      return null;
    }
  }

  /** The same, for an RPC that resolves with `{ data, error }`. */
  async rpcNumber(
    label: string,
    run: () => PromiseLike<{ data: unknown; error: unknown }>,
  ): Promise<number | null> {
    try {
      const { data, error } = await run();
      if (error) {
        logQueryError(`${this.callSitePrefix}.${label}`, error, { soft_read: label });
        this.mark(label);
        return null;
      }
      return typeof data === 'number' ? data : null;
    } catch (err) {
      logQueryError(`${this.callSitePrefix}.${label}`, err, { soft_read: label });
      this.mark(label);
      return null;
    }
  }
}
