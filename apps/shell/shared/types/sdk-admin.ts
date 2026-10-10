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

export interface AdapterVersionView {
  version: string;
  url: string;
  sri: string;
  source: 'image' | 'cli' | 'dev' | 'npm';
  registeredAt: string;
  active: boolean;
}

export interface SdkAdminEventView {
  id: string;
  kind: 'adapter_activated' | 'status_changed' | 'schedule_changed';
  from: Record<string, unknown> | null;
  to: Record<string, unknown>;
  actor: string | null;
  at: string;
}

export interface SdkDetail extends AdminSdkInfo {
  adapters: AdapterVersionView[];
  events: SdkAdminEventView[];
  /** The api re-activates its image's bundle at every start. */
  imageWins: boolean;
}
