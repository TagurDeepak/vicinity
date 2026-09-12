'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a stable function identity that always invokes the latest callback.
 * Avoids re-subscribing effects while still reading fresh state/props.
 */
export function useCallbackRef<A extends unknown[], R>(
  callback: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
