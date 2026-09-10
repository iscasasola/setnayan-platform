'use client';

/**
 * ScreenFindingsPanel — WHAT THE SCREEN FOUND, ON THE PHOTO, WHERE THE ADMIN
 * IS ALREADY LOOKING (MB21).
 *
 * 🔑 WHY THIS IS ITS OWN FILE. MB21's entire deliverable is that a
 * questionable photo stops looking identical to a clean one. Everything
 * upstream — the widened rules in `lib/moodboard-gallery-upload.ts`, the third
 * outcome in `lib/moodboard-gallery-screen.server.ts`, the `screen_findings`
 * column — is worth nothing if the finding never reaches a pixel. This repo
 * has paid for that lesson repeatedly, and its own shorthand for it is exact:
 * A LOG LINE NEVER CHANGED A PIXEL.
 *
 * Extracting the panel buys a real render test
 * (`a-finding-reaches-the-admin.test.ts`) against the actual copy, instead of
 * a source grep over `library-editor.tsx`'s 550 lines. That test also pins the
 * MOUNT inside the editor, so deleting `<ScreenFindingsPanel …/>` — or
 * hard-coding `findings={null}` — is red rather than invisible.
 *
 * ⚠ IT RENDERS THE TRANSCRIPT, AND THAT IS THE POINT. "We saw a name" is a
 * shrug; "we saw a name, here is every word we read off the photo" is
 * something a reviewer can rule on in five seconds. The column holding it is
 * revoked from anon and authenticated in the migration that added it — this
 * panel only ever renders inside /admin.
 */

import {
  HIT_SEVERITY,
  type ScreenFindings,
} from '@/lib/moodboard-screen-findings';

export type ScreenFindingsPanelProps = {
  /** Null when the screen was clean, or when the row predates MB21. */
  findings: ScreenFindings | null;
};

const OUTCOME_HEADING: Record<ScreenFindings['outcome'], string> = {
  blocked: 'This photo was refused at upload',
  flagged: 'Needs a human — the screen found something',
  clean: 'The screen found nothing',
};

export function ScreenFindingsPanel({ findings }: ScreenFindingsPanelProps) {
  // 🛑 ABSENCE IS STATED, NEVER DRAWN AS CLEANLINESS. A row uploaded before
  // MB21 has no findings and is not the same thing as a photo we read and
  // cleared — telling an admin "nothing found" about a photo nobody screened
  // is exactly the false-green this session exists to remove.
  if (!findings) {
    return (
      <section
        data-testid="screen-findings"
        data-outcome="none"
        className="rounded-lg border border-ink/15 bg-cream p-3"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Content screen
        </p>
        <p className="mt-1 text-sm text-ink/65">
          No screen findings recorded for this photo.
        </p>
      </section>
    );
  }

  const flagged = findings.outcome === 'flagged';

  return (
    <section
      data-testid="screen-findings"
      data-outcome={findings.outcome}
      className={`rounded-lg border p-3 ${
        flagged
          ? 'border-terracotta/50 bg-terracotta/10'
          : 'border-danger-300 bg-danger-50'
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        Content screen
      </p>
      <p className="mt-1 text-sm font-medium text-ink">
        {OUTCOME_HEADING[findings.outcome]}
      </p>

      <ul className="mt-2 space-y-1">
        {findings.hits.map((hit, i) => (
          <li
            key={`${hit.kind}-${i}`}
            data-hit-kind={hit.kind}
            className="text-sm text-ink/80"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              {HIT_SEVERITY[hit.kind] === 'block' ? 'Blocked' : 'Flagged'}
            </span>{' '}
            <span>We found {hit.label}</span>
            {hit.found ? <span className="text-ink/60">: “{hit.found}”</span> : null}
          </li>
        ))}
      </ul>

      {/* 🔑 A CHECK THAT DID NOT RUN IS NOT A CHECK THAT PASSED — and the admin
          is the person who can compensate for it by looking harder. */}
      {findings.textScreen === 'unavailable' ? (
        <p className="mt-2 text-xs text-ink/65">
          The text read did not run on this photo, so nothing below was checked
          against its wording.
        </p>
      ) : null}

      <details className="mt-2">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Text read off the photo
        </summary>
        <p className="mt-1 whitespace-pre-wrap rounded border border-ink/10 bg-white p-2 text-xs text-ink/80">
          {findings.text || 'No readable text.'}
        </p>
      </details>
    </section>
  );
}
