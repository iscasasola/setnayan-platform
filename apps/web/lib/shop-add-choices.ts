/**
 * 🧰 SHOP › YOUR SERVICES — the ONE add control's two choices (Build 3 Lane E item 6, owner 9 Nov: *"Create new bundle
 * and create new service"*). Plain values, shared by the services head, the thumb row and the bundles list (a server
 * file may not take a value from a 'use client' module).
 */
export const NEW_BUNDLE_HREF = '/vendor-dashboard/packages/new';

export function addChoices(bundlesOn: boolean): { key: 'bundle' | 'service'; label: string }[] {
  return [...(bundlesOn ? [{ key: 'bundle' as const, label: 'New bundle' }] : []), { key: 'service' as const, label: 'New service' }];
}
