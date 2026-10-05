import type { SdkStatus } from './play';

/** Catalog entry as served by the platform API (`GET /v1/games`). */
export interface GameSummary {
  id: string;
  name: string;
  description: string;
  /** `<game origin>/<thumbnail>` from the game's game.json. */
  thumbnailUrl: string | null;
  serverProtocol: string | null;
  sdk: {
    major: number;
    status: SdkStatus;
    oldAt: string | null;
    deprecatedAt: string | null;
  } | null;
}
