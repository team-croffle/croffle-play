/** What the admin page needs from a registered game's `game.json`. */
export interface GameManifestView {
  id: string;
  name: string;
  version?: string;
  entry: string;
  thumbnail?: string;
  sdk: string;
  server?: { url: string; protocol: string };
}

export interface AdminGame {
  id: string;
  name: string;
  description: string;
  /** Shown in the catalog. */
  listed: boolean;
  manifest: GameManifestView | null;
  sdkMajor: number | null;
  manifestFetchedAt: string | null;
  manifestError: string | null;
  repo: string | null;
  scorePolicy: 'client' | 'server';
  scoreMin: number | null;
  scoreMax: number | null;
  /** `team`: the team serves the game; `platform`: an uploaded build is served. */
  hosting: 'team' | 'platform';
  activeDeployId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Key of the game's own server (`csk_…`), for verified scores. */
export interface ServerKeyView {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}
