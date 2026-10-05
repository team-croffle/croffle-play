import type { SdkStatus } from './play';

/** Catalog entry as served by the platform API (`GET /v1/games`). */
export interface GameSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  serverProtocol: string | null;
  sdk: {
    major: number;
    status: SdkStatus;
    oldAt: string | null;
    deprecatedAt: string | null;
  } | null;
}
