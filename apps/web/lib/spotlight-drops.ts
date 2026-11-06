/**
 * spotlight-drops.ts — 🚪 A MISSING DOORWAY TAKES ITS PAGE WITH IT (owner "yes to all" 2026-10-22, prototype
 * `journey_fixes_later_2026-10-22.html` § Simple-event stall, Option A).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * A Simple event hides the Guests and Suppliers tabs. The journey's stops 5–9 are those tabs and the pages behind
 * them. The engine's rule for a missing element was "wait, and skip ahead only to a later step that IS on screen" —
 * but every later step was on a hidden page, so after the grace the dim lifted and the tour sat silent: it never
 * reached "You're set", `completeTour` never wrote, and it came back, silent again, on every visit.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * The steps between two doorways (`go` steps) are one page. When this page is on screen — some step of it, not a
 * doorway, is drawn — every step of it from here on that is NOT drawn is missing for real, not still on its way:
 *   · a missing step is dropped;
 *   · a missing DOORWAY is dropped with its page (every step after it up to the next doorway) — and since nobody
 *     walked anywhere, the scan carries on along this page to the doorway after it;
 *   · a doorway that IS drawn ends the scan: what lies behind it is another page, judged when it is reached.
 * "Step N of M" is then counted from what is left (`spotlightCount`), and an empty remainder goes to the finale.
 *
 * 🔑 WHY "THIS PAGE IS ON SCREEN" IS REQUIRED. The journey starts on the launcher, walks into the event-type picker
 * and lands on Home only after the host has made the event — minutes later, on a page that holds NONE of the next
 * steps. Without the evidence condition every Home, Guests and Suppliers step would be dropped while the host is
 * still filling in the picker. With it, a page that is merely elsewhere drops nothing: the tour waits, as before.
 *
 * Pure: the engine hands in what is drawn and applies its own grace before it drops anything.
 */
type Step = { readonly go?: boolean };

/**
 * The groups of steps to drop, from the current step `i`, given what is already `dropped` and whether step `j`'s
 * element is drawn (`present`). Each group's FIRST index is the missing step; the rest (for a doorway) its page.
 */
export function missingGroups(
  steps: ReadonlyArray<Step>,
  i: number,
  dropped: ReadonlySet<number>,
  present: (j: number) => boolean,
): number[][] {
  const kept = (j: number) => !dropped.has(j);
  const n = steps.length;
  if (i < 0 || i >= n) return [];

  // This page starts after the last doorway that was kept before the current step.
  let start = 0;
  for (let j = i - 1; j >= 0; j--) {
    if (kept(j) && steps[j]!.go) {
      start = j + 1;
      break;
    }
  }
  // …and runs to the first doorway that is drawn (the way off it), or to the end.
  let end = n - 1;
  for (let j = i; j < n; j++) {
    if (kept(j) && steps[j]!.go && present(j)) {
      end = j;
      break;
    }
  }
  // Evidence: a non-doorway step of this page is drawn — the page is on screen, not on its way.
  let here = false;
  for (let j = start; j <= end; j++) {
    if (kept(j) && !steps[j]!.go && present(j)) {
      here = true;
      break;
    }
  }
  if (!here) return [];

  const groups: number[][] = [];
  for (let j = i; j <= end; ) {
    if (!kept(j) || present(j)) {
      j++;
      continue;
    }
    if (!steps[j]!.go) {
      groups.push([j]);
      j++;
      continue;
    }
    // A missing doorway: it and its page — every kept step after it up to the next kept doorway.
    const group = [j];
    let k = j + 1;
    while (k < n && !(kept(k) && steps[k]!.go)) {
      if (kept(k)) group.push(k);
      k++;
    }
    groups.push(group);
    // The page behind a missing doorway never came, so the scan stays on this page: the next doorway is judged
    // here too (`end` is already the first DRAWN doorway, so it lies beyond every missing one).
    j = k;
  }
  return groups;
}

/** "Step N of M", counted from what is left: welcome steps and dropped steps are not steps. */
export function spotlightCount(
  steps: ReadonlyArray<{ readonly welcome?: boolean }>,
  i: number,
  dropped: ReadonlySet<number>,
): { n: number; of: number } {
  let n = 0;
  let of = 0;
  steps.forEach((s, j) => {
    if (s.welcome || dropped.has(j)) return;
    of++;
    if (j <= i) n++;
  });
  return { n, of };
}

/** The next step still to walk after `i`, or null when none is left (the finale). */
export function nextKept(steps: ReadonlyArray<unknown>, i: number, dropped: ReadonlySet<number>): number | null {
  for (let j = i + 1; j < steps.length; j++) if (!dropped.has(j)) return j;
  return null;
}
