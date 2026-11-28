/**
 * /panood/program/[eventId] — NOTHING while the server answers, on purpose. This window is what the host's encoder
 * (OBS) captures, so any skeleton here would go out on the couple's broadcast. The boundary only lets the window
 * commit at once; sign-in, "no such event" and membership are decided by `./layout.tsx` before it streams.
 */
export default function ProgramOutputLoading() {
  return null;
}
