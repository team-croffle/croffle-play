import type { SdkStatus } from './play';

/** Admin view of an SDK major (API `SdkInfo` / `SdkDetail`). */
export interface AdminSdkInfo {
  major: number;
  status: SdkStatus;
  adapterUrl: string | null;
  sri: string | null;
  oldAt: string | null;
  deprecatedAt: string | null;
}

export type AdapterSource = 'image' | 'cli' | 'dev' | 'npm';

export interface AdapterVersionView {
  version: string;
  url: string;
  sri: string;
  source: AdapterSource;
  registeredAt: string;
  active: boolean;
}

/** A release of the major's adapter package on npm. */
export interface AvailableAdapter {
  version: string;
  requiresApi: string | null;
  /** Satisfies `requiresApi` for the running api. */
  compatible: boolean;
  installed: boolean;
}

export interface SyncStatus {
  /** Seconds between runs; 0 = off. */
  intervalSeconds: number;
  lastRunAt: string | null;
  lastResults: { major: number; installed: string | null; error?: string }[];
}

export interface SdkAdminEventView {
  id: string;
  kind: 'adapter_activated' | 'adapter_removed' | 'status_changed' | 'schedule_changed';
  from: Record<string, unknown> | null;
  to: Record<string, unknown>;
  actor: string | null;
  at: string;
}

export interface SdkDetail extends AdminSdkInfo {
  adapters: AdapterVersionView[];
  events: SdkAdminEventView[];
  /** Null when the registry could not be read; see `availableError`. */
  available: AvailableAdapter[] | null;
  availableError: string | null;
  sync: SyncStatus;
}
