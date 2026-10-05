/** UTC day key, e.g. "2026-10-05". */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** UTC hour key, e.g. "2026-10-05T14". */
export function hourKey(now: Date): string {
  return now.toISOString().slice(0, 13);
}

export const DAY_MS = 24 * 60 * 60 * 1000;
