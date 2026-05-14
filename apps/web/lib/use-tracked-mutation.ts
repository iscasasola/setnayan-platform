'use client';

// Thin wrapper around `useMutation` that enforces the invalidation discipline
// described in the Caching & Offline Strategy spec § 5.
//
// Every mutation MUST declare which query keys it invalidates. TypeScript
// enforces the `invalidates: QueryKey[]` prop is provided — feature code can
// never silently skip invalidation. On success, the wrapper invalidates each
// declared key BEFORE forwarding to the caller's `onSuccess`, so by the time
// downstream handlers run the cache is already marked stale and re-fetched.
//
// A future PR adds an ESLint rule (`setnayan/no-raw-mutation`) that flags any
// import of `useMutation` from `@tanstack/react-query` outside this file.

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

export type UseTrackedMutationOptions<
  TData,
  TError,
  TVariables,
  TOnMutateResult,
> = UseMutationOptions<TData, TError, TVariables, TOnMutateResult> & {
  /**
   * Query keys to invalidate on mutation success. REQUIRED.
   * The wrapper runs `queryClient.invalidateQueries({ queryKey })` for each
   * entry before forwarding to the caller's `onSuccess`.
   */
  invalidates: QueryKey[];
};

export function useTrackedMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: UseTrackedMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  const queryClient = useQueryClient();
  const { invalidates, onSuccess, ...rest } = options;

  return useMutation<TData, TError, TVariables, TOnMutateResult>({
    ...rest,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all(
        invalidates.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      await onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
