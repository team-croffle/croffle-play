/** SDK major lifecycle (docs/sdk-lifecycle.md). */
export type SdkStatus = 'current' | 'lts' | 'old' | 'deprecated';

/** `GET /v1/sdk/:major`. */
export interface SdkInfo {
  major: number;
  status: SdkStatus;
  adapterUrl: string | null;
  sri: string | null;
  oldAt: string | null;
  deprecatedAt: string | null;
}

/**
 * `GET /v1/games/:id/play`: the entry document on the game's own origin. The SDK major (and so
 * the host adapter) comes from the game's `__hello`.
 */
export interface PlayInfo {
  id: string;
  name: string;
  url: string;
}

/** `GET /v1/games/:id/leaderboard`. */
export interface LeaderboardEntry {
  rank: number;
  user: { id: string; nickname: string; avatar: string | null };
  score: number;
  at: string;
  verified: boolean;
}

export interface Leaderboard {
  policy: 'client' | 'server';
  items: LeaderboardEntry[];
}
