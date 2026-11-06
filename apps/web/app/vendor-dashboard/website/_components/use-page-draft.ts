'use client';

import { useCallback, useEffect, useState } from 'react';
import { draftStorageKey, parseStoredDraft, pruneDraft, type PageDraft, type PageSaved } from '@/lib/supplier-page-draft';

/**
 * The page draft, kept in THIS browser under one key per shop (`lib/supplier-page-draft.ts`).
 *
 * Browser storage is the per-viewer "unsent draft" kind: every read and write is wrapped, and the page renders
 * correctly without it (a private window simply starts with no draft). It is read AFTER the first paint, so the
 * server's HTML and the first client render agree; `ready` says when it has been read. Whatever is stored is pruned
 * against the page as published — after an Apply, or a change made somewhere else, a stale part drops out by itself.
 *
 * Your page AND Your collections use it, so a collection switched on from Collections is waiting in the same draft
 * when the supplier comes to Apply.
 */
export function usePageDraft(vendorProfileId: string, saved: PageSaved) {
  const key = draftStorageKey(vendorProfileId);
  const [draft, setDraftState] = useState<PageDraft>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: PageDraft = {};
    try {
      stored = parseStoredDraft(window.localStorage.getItem(key));
    } catch {
      stored = {};
    }
    setDraftState(pruneDraft(stored, saved));
    setReady(true);
  }, [key, saved]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (Object.keys(draft).length > 0) window.localStorage.setItem(key, JSON.stringify(draft));
      else window.localStorage.removeItem(key);
    } catch {
      /* storage refused (private window, blocked site data) — the draft still lives on this screen */
    }
  }, [draft, key, ready]);

  const setDraft = useCallback((fn: (cur: PageDraft) => PageDraft) => setDraftState(fn), []);
  const clear = useCallback(() => setDraftState({}), []);

  return { draft, setDraft, clear, ready };
}
