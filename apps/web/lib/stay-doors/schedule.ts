/** Schedule — the host's segment picks, the host's questions, Tell the host (`schedule/_components/*`). */
export const SCHEDULE_STAY_DOORS = [
  'schedule.toggleActivityPick',
  'schedule.applyActivityPicks',
  'schedule.saveHostAnswers',
  'schedule.sendStageNoteFromEvent',
] as const;
export type ScheduleStayDoor = (typeof SCHEDULE_STAY_DOORS)[number];
