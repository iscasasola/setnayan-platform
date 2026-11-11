import s from './features-story.module.css';

/**
 * The "Coming" chip a planned /features row wears — on the row and in its ⓘ (v3: "the app's chip"). Drawn HERE only,
 * so the word is one thing in one place (the Root map reads a lone "Coming" as a count; this is a status, said once).
 */
export function ComingChip({ lead = false }: { lead?: boolean }) {
  return <span className={`${s.chip} ${s.chipWait} ${lead ? s.tagLead : s.tag}`}>Coming</span>;
}
