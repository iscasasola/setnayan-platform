'use client';

import { useState, useTransition } from 'react';
import {
  getDeepSearchChatPromptAction,
  getVendorStudyPromptAction,
  saveManualDossierAction,
} from '../actions';

/**
 * Free "run it in your own AI chat" deep-search tier. The admin copies a ready
 * research prompt (vendor facts + ad links + JSON schema baked in), pastes it
 * into Gemini / ChatGPT / Copilot — which does the web research for free — then
 * pastes the JSON answer back here to store it as a dossier. No API cost.
 */
export function DeepSearchChat({
  vendorProfileId,
  applicationId,
}: {
  vendorProfileId: string;
  applicationId: string;
}) {
  const [copied, setCopied] = useState<'dossier' | 'study' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pending, startTransition] = useTransition();

  function copyPrompt(kind: 'dossier' | 'study') {
    setCopyError(null);
    startTransition(async () => {
      const res =
        kind === 'study'
          ? await getVendorStudyPromptAction(vendorProfileId, applicationId)
          : await getDeepSearchChatPromptAction(vendorProfileId, applicationId);
      if (!res.ok) {
        setCopyError(res.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.prompt);
        setCopied(kind);
        setTimeout(() => setCopied(null), 2500);
      } catch {
        setCopyError('Could not reach the clipboard — copy is blocked in this browser.');
      }
    });
  }

  return (
    <div className="space-y-2 border-t border-ink/10 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => copyPrompt('dossier')}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5 disabled:opacity-60"
        >
          {copied === 'dossier' ? 'Copied ✓' : 'Copy verification prompt'}
        </button>
        <button
          type="button"
          onClick={() => copyPrompt('study')}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5 disabled:opacity-60"
        >
          {copied === 'study' ? 'Copied ✓' : 'Copy study prompt (for interview)'}
        </button>
        <button
          type="button"
          onClick={() => setShowPaste((v) => !v)}
          className="text-xs text-ink/55 underline underline-offset-2 hover:text-ink/80"
        >
          {showPaste ? 'Hide paste box' : 'Paste a result back →'}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">
          Free · Gemini / ChatGPT / any AI chat
        </span>
      </div>

      <p className="text-[11px] leading-snug text-ink/50">
        <b>Verification prompt</b> → paste into a web-browsing AI chat, then paste
        its reply back here to save a dossier. <b>Study prompt</b> → a fit brief +
        interview questions for the team to read before meeting the vendor. Both
        free — no API key, no cost.
      </p>

      {copyError ? (
        <p className="rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-2 text-xs text-terracotta-700">
          {copyError}
        </p>
      ) : null}

      {showPaste ? (
        <form action={saveManualDossierAction} className="space-y-2">
          <input type="hidden" name="application_id" value={applicationId} />
          <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
          <textarea
            name="pasted_result"
            required
            rows={5}
            placeholder="Paste the AI chat's full reply here — including the ```json { … } ``` block at the end."
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs text-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink/40"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-ink/20 bg-ink/5 px-3 text-xs text-ink/80 hover:bg-ink/10"
          >
            Save pasted result
          </button>
        </form>
      ) : null}
    </div>
  );
}
