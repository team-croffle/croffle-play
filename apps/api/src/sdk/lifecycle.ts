import type { sdkVersions } from '../db/schema.js';

export type SdkStatus = (typeof sdkVersions.$inferSelect)['status'];

/** Majors that may still get new game versions. */
export const ACTIVE_STATUSES: readonly SdkStatus[] = ['current', 'lts', 'maintenance'];

/** Policy: at most this many active majors at once (each needs a maintained adapter). */
export const MAX_ACTIVE_MAJORS = 3;

/**
 * Status in force at `now`: dates win over the stored status, so changing a date is all it takes
 * to schedule deprecation or end of life (docs/ARCHITECTURE.md §3).
 */
export function effectiveStatus(
  row: { status: SdkStatus; deprecatedAt: Date | null; eolAt: Date | null },
  now: Date = new Date(),
): SdkStatus {
  if (row.eolAt && row.eolAt <= now) {
    return 'eol';
  }
  if (row.deprecatedAt && row.deprecatedAt <= now && row.status !== 'eol') {
    return 'deprecated';
  }
  return row.status;
}
