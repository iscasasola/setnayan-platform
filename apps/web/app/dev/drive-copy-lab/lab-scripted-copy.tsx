'use client';

/**
 * /dev/drive-copy-lab — a LAB-ONLY stand-in for `POST /api/vendor/drive-copy` (no database, no Google): each lab row's
 * event id picks a scripted answer, so the press-only states (copying with its track, done, some failed, the files
 * unread, the copy stopped, nothing to copy) can be pressed and seen. Never imported outside app/dev.
 */
import { useEffect } from 'react';
import type { CopyRunResult } from '@/lib/supplier-drive-copy';

export const LAB_SCENARIOS = {
  '00000000-0000-4000-8000-0000000000d1': 'done',
  '00000000-0000-4000-8000-0000000000d2': 'some_failed',
  '00000000-0000-4000-8000-0000000000d3': 'unread',
  '00000000-0000-4000-8000-0000000000d4': 'error',
  '00000000-0000-4000-8000-0000000000d5': 'nothing',
  '00000000-0000-4000-8000-0000000000d6': 'slow',
} as const;

export function LabScriptedCopy() {
  useEffect(() => {
    const real = window.fetch;
    const presses = new Map<string, number>();
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.endsWith('/api/vendor/drive-copy')) return real(input, init);
      const { event_id: id } = JSON.parse(String(init?.body ?? '{}')) as { event_id: string };
      const n = (presses.get(id) ?? 0) + 1;
      presses.set(id, n);
      const scenario = (LAB_SCENARIOS as Record<string, string>)[id];
      const since = new Date().toISOString();
      let r: CopyRunResult;
      switch (scenario) {
        case 'done':
          r = n === 1 ? { ok: true, status: 'copying', since, total: 40, copied: 24, failed: 0, remaining: 16 } : { ok: true, status: 'done', since, total: 40, copied: 40, failed: 0, remaining: 0 };
          break;
        case 'some_failed':
          r = { ok: true, status: 'some_failed', since, total: 40, copied: 39, failed: 1, remaining: 0 };
          break;
        case 'unread':
          r = { ok: false, reason: 'unread' };
          break;
        case 'nothing':
          r = { ok: true, status: 'nothing_to_copy' };
          break;
        case 'slow':
          // Copying that keeps moving: 12 → 24 → 36 … so the track can be seen mid-way.
          r = { ok: true, status: 'copying', since, total: 400, copied: Math.min(399, 12 * n), failed: 0, remaining: 400 - 12 * n };
          await new Promise((res) => setTimeout(res, 1500));
          break;
        default:
          r = { ok: false, reason: 'error' };
      }
      await new Promise((res) => setTimeout(res, 400));
      return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    return () => {
      window.fetch = real;
    };
  }, []);
  return null;
}
