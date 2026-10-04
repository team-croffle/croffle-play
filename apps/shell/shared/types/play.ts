/** `GET /v1/sdk/:major`. */
export interface SdkInfo {
  major: number;
  status: 'current' | 'lts' | 'maintenance' | 'deprecated' | 'eol';
  adapterUrl: string | null;
  sri: string | null;
  deprecatedAt: string | null;
  eolAt: string | null;
}

/** `GET /v1/games/:id/play`. */
export interface PlayInfo {
  id: string;
  name: string;
  version: string;
  url: string;
  sdkMajor: number;
  sdk: SdkInfo | null;
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
