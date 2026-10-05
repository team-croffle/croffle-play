import type { sdkVersions } from '../db/schema.js';

export type SdkStatus = (typeof sdkVersions.$inferSelect)['status'];

/** Majors new games may be registered on (and existing ones updated to). */
export const REGISTRABLE_STATUSES: readonly SdkStatus[] = ['current', 'lts'];

/** Majors that still run, so each needs a maintained host adapter. */
export const PLAYABLE_STATUSES: readonly SdkStatus[] = ['current', 'lts', 'old'];

/** Policy: at most this many playable majors at once (each needs a maintained adapter). */
export const MAX_PLAYABLE_MAJORS = 3;

/**
 * Status in force at `now`: dates win over the stored status, so changing a date is all it takes
 * to schedule a major going `old` or `deprecated` (docs/sdk-lifecycle.md).
 */
export function effectiveStatus(
  row: { status: SdkStatus; oldAt: Date | null; deprecatedAt: Date | null },
  now: Date = new Date(),
): SdkStatus {
  if (row.status === 'deprecated' || (row.deprecatedAt && row.deprecatedAt <= now)) {
    return 'deprecated';
  }
  if (row.oldAt && row.oldAt <= now) {
    return 'old';
  }
  return row.status;
}
