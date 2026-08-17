import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  /** "Couldn't refresh requests" */
  title: string;
  /** Beat 1 — what broke: "The live connection dropped at 7:41 PM." */
  broke: string;
  /**
   * Beat 2 — what SURVIVED: "Your 3 loaded requests are below and safe to
   * work." Leading with what survived preserves trust; an error that only
   * says what broke reads as data loss.
   */
  survived: string;
  /** Beat 3 — what to DO: "Retry, or keep accepting — actions queue and sync." */
  todo: string;
  /** Retry / work-offline controls, rendered by the caller. */
  actions?: ReactNode;
  /** The surviving content itself, rendered under the report. */
  children?: ReactNode;
};

// State 06 · ERROR — reports in three fixed beats: broke → survived → do.
// Never a full-viewport takeover: the surviving rows stay on screen and
// workable underneath the report.
//
// The three beat labels are ink/70, NOT ink/45: measured on this component's
// own bg-mulberry/5 panel, ink/45 is 2.44:1 in the light theme — a hard AA fail
// for 10px text — while ink/70 is 4.94:1 light / 8.40:1 dark. Corrected
// 2026-08-17 when the admin console table became the first consumer of these
// primitives; they had shipped unmounted, so nothing was live. Both themes
// checked: the light-only check is what waves this through.
export function ErrorState({ title, broke, survived, todo, actions, children }: Props) {
  return (
    <div className="flex flex-col px-4 py-6">
      <div className="flex gap-3 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4">
        <AlertTriangle aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-mulberry" strokeWidth={1.75} />
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-ink">{title}</h3>
          <dl className="mt-2 space-y-1.5 text-sm text-ink/70">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/70 leading-5">
                Broke
              </dt>
              <dd>{broke}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/70 leading-5">
                Survived
              </dt>
              <dd>{survived}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/70 leading-5">
                Do
              </dt>
              <dd>{todo}</dd>
            </div>
          </dl>
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
