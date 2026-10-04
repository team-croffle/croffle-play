/** Catalog entry as served by the platform API (`GET /v1/games`). */
export interface GameSummary {
  id: string;
  name: string;
  description: string;
  version: string;
}
