/** Tiny className combiner (avoids pulling in a dependency for a one-liner). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
