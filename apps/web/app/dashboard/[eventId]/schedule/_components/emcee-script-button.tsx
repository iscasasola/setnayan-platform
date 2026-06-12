'use client';

import { useState, useTransition } from 'react';
import { ScrollText, Copy, Check, Download, X } from 'lucide-react';
import { generateEmceeScript } from '../actions';

/**
 * EmceeScriptButton — one-tap "Generate emcee script" affordance for the
 * schedule page. Calls the server action (which runs the pure buildEmceeScript
 * compiler over the saved blocks + guest list), then shows the result in a
 * modal with copy-to-clipboard + download-as-.txt. Read-only — it compiles the
 * existing program, never mutates it.
 */

type Props = {
  eventId: string;
  /** Used for the download filename. */
  coupleName?: string | null;
};

export function EmceeScriptButton({ eventId, coupleName }: Props) {
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate(withPrivate: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const text = await generateEmceeScript(eventId, withPrivate);
        setScript(text);
        setOpen(true);
      } catch {
        setError('Could not generate the script. Please try again.');
        setOpen(true);
      }
    });
  }

  async function copy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the textarea is selectable as a fallback.
    }
  }

  function download() {
    if (!script) return;
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (coupleName ?? 'wedding')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    a.href = url;
    a.download = `emcee-script-${slug || 'wedding'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => generate(includePrivate)}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 disabled:opacity-60"
      >
        <ScrollText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {pending ? 'Generating…' : 'Generate emcee script'}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Emcee script"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl bg-paper shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-ink">
                <ScrollText aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
                Emcee / host script
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </header>

            <div className="flex-1 overflow-auto px-4 py-3">
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : (
                <textarea
                  readOnly
                  value={script ?? ''}
                  rows={18}
                  className="w-full resize-none rounded-lg border border-ink/10 bg-white p-3 font-mono text-xs leading-relaxed text-ink"
                />
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-xs text-ink/65">
                <input
                  type="checkbox"
                  checked={includePrivate}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIncludePrivate(next);
                    generate(next);
                  }}
                  className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                />
                Include private blocks
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copy}
                  disabled={!script}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 disabled:opacity-50"
                >
                  {copied ? (
                    <Check aria-hidden className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
                  ) : (
                    <Copy aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={download}
                  disabled={!script}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-700 disabled:opacity-50"
                >
                  <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Download
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
