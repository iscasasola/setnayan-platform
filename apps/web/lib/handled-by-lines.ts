/**
 * THE SETNAYAN LINE IN THE CHAT — who is handling the client (#8013 drawing (h), "Decided 19 Nov": every change posts
 * ONE Setnayan line — a handover, a manager's "Handled by ▾", a paused seat (g) and its return; same chat, every
 * message kept; the name is the person's name plus the shop's own name for their role).
 *
 * `who` is already "Joy Tan, Lead Stylist" (memberChatName). The words are the drawing's, verbatim.
 */
export type HandledByLine =
  | { kind: 'first'; who: string }
  | { kind: 'moved'; who: string }
  | { kind: 'paused'; awayFirstName: string; who: string }
  | { kind: 'back'; who: string };

export function handledByLine(line: HandledByLine): string {
  switch (line.kind) {
    case 'first':
      return `Your chat is being handled by ${line.who}.`;
    case 'moved':
      return `Your chat is now being handled by ${line.who}.`;
    case 'paused':
      return `${line.awayFirstName} is away for now — ${line.who}, is handling your chat.`;
    case 'back':
      return `${line.who}, is handling your chat again.`;
  }
}
