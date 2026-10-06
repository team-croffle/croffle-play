/** Admin view of an SDK major (API `SdkInfo` / `SdkDetail`). */
export type SdkStatus = 'current' | 'lts' | 'old' | 'deprecated';

export interface SdkInfo {
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
  source: 'image' | 'cli' | 'dev';
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

export interface SdkDetail extends SdkInfo {
  adapters: AdapterVersionView[];
  events: SdkAdminEventView[];
  /** The api re-activates its image's bundle at every start. */
  imageWins: boolean;
}
