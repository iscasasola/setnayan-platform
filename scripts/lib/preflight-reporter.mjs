/**
 * A node:test reporter that writes one JSON line per finished test.
 *
 * preflight runs hundreds of test files in one `tsx --test` call and has to
 * answer two questions TAP cannot: WHICH FILE did each failure come from, and
 * DID EVERY FILE IT ASKED FOR ACTUALLY RUN. The second is the one that matters:
 * a test argument is a glob, and a glob that matches nothing has, on older
 * node versions, printed `pass 0` and exited green.
 */
export default async function* preflightReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data ?? {};
    const rec = { t: event.type === 'test:pass' ? 'pass' : 'fail', file: d.file ?? null, name: d.name ?? '', nesting: d.nesting ?? 0 };
    if (typeof d.details?.duration_ms === 'number') rec.ms = Math.round(d.details.duration_ms);
    if (d.skip !== undefined) rec.skip = true;
    if (d.todo !== undefined) rec.todo = true;
    if (event.type === 'test:fail') {
      const err = d.details?.error;
      // a parent that failed only because a child did adds nothing
      if (err?.failureType === 'subtestsFailed') continue;
      const cause = err?.cause;
      const msg = String((cause && typeof cause === 'object' ? cause.message : cause) ?? err?.message ?? '');
      rec.msg = msg.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4).join(' ⏎ ').slice(0, 600);
      rec.line = d.line ?? null;
    }
    yield JSON.stringify(rec) + '\n';
  }
}
