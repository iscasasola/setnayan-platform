/** Account › the launcher (`/dashboard`) — an incoming invitation's No and "Don't show me invites from …"
 *  (`(launcher)/incoming-request-actions.ts`). Its Yes opens the invitation — that one navigates. */
export const ACC_LAUNCHER_STAY_DOORS = ['accLauncher.answerIncomingRequest', 'accLauncher.muteInviter'] as const;
export type AccLauncherStayDoor = (typeof ACC_LAUNCHER_STAY_DOORS)[number];

/** The incoming request's failure sentence (`incoming-requests.tsx`'s Flash shows the same one for `?request_error=1`). */
export const INCOMING_REQUEST_FAILED = 'That didn’t go through. Try again.';
