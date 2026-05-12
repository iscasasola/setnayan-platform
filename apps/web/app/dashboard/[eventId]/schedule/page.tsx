import { IterationPlaceholder } from '../_components/placeholder';

export const metadata = { title: 'Schedule' };

export default function SchedulePage() {
  return (
    <IterationPlaceholder
      iteration="Iteration 0000 — Schedule view (deferred to a polish pass)"
      title="Schedule"
      blurb="Unified calendar pulling vendor meetings (0006), payment deadlines (0007), and event-day timeline (0004). List view by date group + month grid + .ics subscribe button."
      hint="Lights up once iterations 0006 and 0007 ship their data."
    />
  );
}
