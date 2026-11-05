import type { LogoActions } from '@/app/dashboard/[eventId]/launch/_components/logo-actions-context';

/**
 * 🧪 THE LAB'S STAND-IN FOR STUDIO › LOGO'S ONE WRITE (DEV-ONLY — `/dev/maker-lab?studio=1`). A plain module with NO action imported, so a
 * guard can load it. It writes nothing: the draft write is only COUNTED (`window.__labDrafts`, as the lab's other draft writes are) and
 * answers as the real door does when it lands. `&refuse=1` refuses with the database's own words, on purpose — the page must say one plain
 * sentence of its own and never print them.
 */
export const LAB_LOGO_ACTIONS: Partial<LogoActions> = {
  hubDraftAction: async (_eventId, fd) => {
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __labDrafts?: Array<Record<string, string>> };
      (w.__labDrafts ??= []).push(Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string')) as Record<string, string>);
    }
    return { ok: true, intent: 'save', applied: 0, held: [] };
  },
};
export const LAB_LOGO_REFUSALS: Partial<LogoActions> = {
  hubDraftAction: async () => ({ ok: false, intent: 'save', error: 'new row violates row-level security policy for table "events"' }),
};
