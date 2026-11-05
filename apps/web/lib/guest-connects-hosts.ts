/**
 * guest-connects-hosts.ts — 🤝 "ALSO CONNECT WITH <THE HOSTS>", the one tick at the moment a guest keeps their
 * invitation in their account (owner 2026-10-21, DECISION_LOG "A GUEST WHO KEEPS THEIR INVITATION ASKS THE HOSTS
 * TO CONNECT — ONE TICK, ON BY DEFAULT").
 *
 * Owner, verbatim: *"when they accept and links their event to an account, their account will automatically connect
 * to the host as connect request?"* → told "not today", recommended a default-on tick → *"Yes, build it: when a
 * guest links their account, a default-on tick "Also connect with <hosts>" sends a connect request I accept in
 * People → Requests."*
 *
 * WHAT IT IS, AND WHAT IT IS NOT:
 *   · a REQUEST — the existing pending `person_connections` row, unlabelled (owner 2026-08-21 "add first, label
 *     after"), written by the ONE writer (`lib/people-connection-request.server.ts`). It is never a connection: the
 *     host still presses Accept in People → Requests (the 2026-09-28 rule "never auto-connects" stands);
 *   · in-app only — the host's bell and their Requests row. 📵 No email (the standing rule): the guest path hands the
 *     writer no invitation sender;
 *   · only on purpose — the tick is drawn ON and the guest can untick it; unticked sends nothing, and a form that did
 *     not draw the tick (`CONNECT_HOSTS_SHOWN`) sends nothing either, whatever else it carries.
 *
 * Pure: no I/O. The server half (who the hosts are, the send) is `guest-connects-hosts.server.ts`.
 */

/** The checkbox's name. Its value is `'1'` when ticked; an unticked box posts nothing. */
export const CONNECT_HOSTS_FIELD = 'connect_hosts';

/** Posted beside the box, so the action can tell "drawn and unticked" from "never drawn". */
export const CONNECT_HOSTS_SHOWN = `${CONNECT_HOSTS_FIELD}_shown`;

/**
 * Did the guest leave the tick on? TRUE only when the form drew the tick AND it came back ticked — a form without
 * the tick (an older page, a crafted post, a page that hid it) asks nobody.
 */
export function connectHostsTicked(formData: FormData | null | undefined): boolean {
  if (!formData) return false;
  return formData.has(CONNECT_HOSTS_SHOWN) && formData.get(CONNECT_HOSTS_FIELD) === '1';
}

/** "Claire" · "Ice and Claire" · "Ice, Claire and Rosa" — the names the tick reads, in the order given. */
export function namesInPlainWords(names: readonly string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? '';
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

/** The tick's words. Never drawn with no name: the caller hides the tick when there is nobody to ask. */
export function connectHostsLine(firstNames: readonly string[]): string {
  const who = namesInPlainWords(firstNames);
  return who ? `Also connect with ${who}` : '';
}
