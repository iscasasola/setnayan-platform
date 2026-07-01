/**
 * Lightweight server-render timing for hot pages (2026-07-01).
 *
 * WHY NOT A `Server-Timing` HEADER? Next.js App Router streams the RSC/HTML
 * response, so a Server Component can't set response headers after render starts.
 * Instead we emit ONE structured stdout line per instrumented render:
 *
 *   [server-timing] {"route":"vendor-dashboard/layout","total_ms":142,
 *                    "phases":[{"label":"chrome","ms":118},{"label":"wallet","ms":22}]}
 *
 * On Vercel that stdout flows through the Log Drain → Better Stack (iteration
 * 0035), where you can chart total_ms + per-phase ms by route over time — the
 * server-side complement to the PostHog Web-Vitals RUM (which sees client TTFB
 * but not WHICH loader was slow).
 *
 * Contract: instrumentation must NEVER change behavior. `track()` measures in a
 * `finally` and re-throws untouched; `flush()` swallows its own errors.
 */
type Phase = { label: string; ms: number };

export class ServerTimer {
  private readonly phases: Phase[] = [];
  private readonly start = performance.now();

  constructor(private readonly route: string) {}

  /**
   * Measure an async phase. Returns the wrapped promise's value unchanged and
   * propagates its rejection unchanged — the timing is recorded either way.
   */
  async track<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      this.phases.push({ label, ms: Math.round(performance.now() - t0) });
    }
  }

  /** Record a phase whose duration you measured yourself (already-awaited work). */
  add(label: string, ms: number): void {
    this.phases.push({ label, ms: Math.round(ms) });
  }

  /**
   * Emit the structured line. Call once, at the end of the render. Never throws
   * — a logging failure must not break a page.
   */
  flush(): void {
    try {
      const total = Math.round(performance.now() - this.start);
      // eslint-disable-next-line no-console
      console.info(
        `[server-timing] ${JSON.stringify({
          route: this.route,
          total_ms: total,
          phases: this.phases,
        })}`,
      );
    } catch {
      /* timing must never break a render */
    }
  }
}
