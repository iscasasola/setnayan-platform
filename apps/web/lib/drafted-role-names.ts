import { cache } from 'react';
import { readRoleNames } from '@/lib/role-names.server';
import { withDraftedSectionWords, type RoleNames } from '@/lib/role-names';

/**
 * lib/drafted-role-names.ts — THE HOST'S CANVAS READS THE SECTION HEADINGS AS DRAFTED (owner 2026-10-19).
 *
 * A heading named in the Wedding March's Edit is a DRAFT until ✓ Apply (`lib/hub-draft.ts`, `role_names`, section keys
 * only). The guest tree reads the couple's words ONCE per render, by the service role (`loadEventRoleNames`,
 * `app/[slug]/_lib/loaders.ts`) — so the page that draws the host's canvas (`app/[slug]/page.tsx`, a verified host on
 * `?editor=1` only) holds the drafted words here, and that one reader lays them on. Every surface of the canvas — the
 * entourage in every style, the march, the dress code's rows — then prints the drafted heading, and a guest's render
 * (nothing held) prints exactly what is live.
 *
 * 🔒 Per render, never across requests: the Map React hands out once per server render (`cache(() => new Map())`, the
 * `lib/event-row-once.ts` posture) — never a module-level Map, which would show one couple's draft to the next viewer.
 */
const held = cache(() => new Map<string, unknown>());

/** The host's canvas only: the drafted `role_names` (section keys) for this render. */
export function holdDraftedRoleNames(eventId: string, drafted: unknown): void {
  held().set(eventId, drafted);
}

/** The couple's words with this render's drafted section headings laid on — the words unchanged when nothing is held. */
export function withHeldDraftedRoleNames(eventId: string, names: RoleNames): RoleNames {
  const map = held();
  if (!map.has(eventId)) return names;
  return readRoleNames(withDraftedSectionWords(names, map.get(eventId)));
}
