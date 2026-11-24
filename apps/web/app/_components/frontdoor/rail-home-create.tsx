import Link from 'next/link';
import { Plus } from 'lucide-react';

/**
 * ➕ "Create an event" at the TOP OF THE RAIL, on Home only (Unihome v5, owner-approved 23 Nov 2026 — DECISION_LOG
 * "UNIHOME v5 APPROVED": *"the labelled floating 'Create an event' button at the bottom right on a phone (top of the
 * left rail on desktop)"*). It is the phone's floating button in its computer seat: drawn only where the rail shows
 * words (≥1280, `.fd-rail-create` in front-door.css). The TOP BAR still draws no create button of its own (owner
 * 2026-10-22) — this lives in the rail, and only while the page is Home.
 * 🔒 app/_components/frontdoor/create-follows-the-surface.test.ts
 */
export function RailHomeCreate() {
  return (
    <div className="fd-rail-create" data-unihome-rail-create="">
      <Link href="/dashboard/create-event" className="fd-rail-create-btn" data-tour="create-event">
        <Plus aria-hidden="true" strokeWidth={2.4} />
        Create an event
      </Link>
    </div>
  );
}
