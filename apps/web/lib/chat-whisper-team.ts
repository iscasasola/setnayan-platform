/**
 * 🏪 THE TEAM SIDE'S WORDS — every "your team" a whisper says, said only to the supplier's own staff (Unichat part E;
 * the Private filter line, #8071). They live HERE, alone, so `lib/the-host-says-suppliers.test.ts` allow-lists this one
 * file and still guards every host line in `lib/chat-whisper.ts` (reviewer's condition on #8060, 20 Nov).
 * Import-free; `lib/chat-whisper.ts` re-exports all of it.
 */

/** Only the people on the shop's side whisper to the team. */
export const WHISPER_TEAM_ONLY_MESSAGE = 'Only the shop’s own team can whisper here — your whisper was not sent.';
/** Nobody else on the team is in this chat. Refused, never sent to everyone. */
export const WHISPER_NO_TEAM_MESSAGE = 'No one else on your team is in this chat — your whisper was not sent.';
export const WHISPER_NO_TEAM_LINE = 'No one else on your team is in this chat yet.';
export const WHISPER_TEAM_UNREAD_LINE = "Couldn't load your team for this chat. Try again in a moment.";

/** The team whisper reaches — the composer's line (the prototype's words). */
export const WHISPER_TEAM_REACH = 'Only your team';
/** The switch in the box on the shop's side (only the shop's own staff ever see it). */
export const WHISPER_TEAM_SWITCH = 'Whisper to your team only';
/** The notification title a shop's teammate gets for a team whisper. */
export function teamWhisperTitle(vendorName: string): string {
  return `Whisper from your team · ${vendorName}`;
}
/** The plain words when the database refuses a team whisper's side (never the raw WHISPER_* code). */
export const WHISPER_SIDE_REFUSED_TEAM = 'Only your team can see this whisper';
/** Who sees the team's whispers, on the Private filter line ("Private · 2 whispers · your team only"). */
export const TEAM_FILTER_WHO = 'your team only';
/** The strip across a team whisper's bubble. */
export const TEAM_WHISPER_STRIP = 'Whisper · your team only';
