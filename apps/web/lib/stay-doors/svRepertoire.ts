/** Song bank — Add (library pick and typed song) and each song's video link on `/vendor-dashboard/repertoire` (`repertoire/actions.ts`). */
export const SV_REPERTOIRE_STAY_DOORS = ['svRepertoire.addRepertoireSong', 'svRepertoire.setPerformanceLink'] as const;
export type SvRepertoireStayDoor = (typeof SV_REPERTOIRE_STAY_DOORS)[number];
