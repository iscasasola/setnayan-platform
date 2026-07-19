/**
 * Branch action result types — kept OUT of actions.ts because a `'use server'`
 * module may only export async functions (a value export like BRANCH_IDLE or a
 * plain type would break the build). The client (branch-manager) imports these;
 * the server actions import the type and return it.
 */

export type BranchActionState =
  | { status: 'idle' }
  | {
      status: 'success';
      kind: 'created' | 'renewed' | 'cancelled';
      message: string;
      referenceCode?: string;
    }
  | { status: 'error'; message: string };

export const BRANCH_IDLE: BranchActionState = { status: 'idle' };
