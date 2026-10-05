/** What the admin page needs from a registered game's `game.json`. */
export interface GameManifestView {
  id: string;
  name: string;
  version?: string;
  entry: string;
  thumbnail?: string;
  sdk: string;
  server?: { protocol: string };
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

export interface GameServerView {
  gameId: string;
  gameName: string;
  image: string;
  protocol: string;
  status: 'requested' | 'approved' | 'revoked';
  requestedAt: string;
  approvedAt: string | null;
}
