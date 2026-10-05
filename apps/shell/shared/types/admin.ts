export interface AdminGame {
  id: string;
  name: string;
  description: string;
  stableVersion: string | null;
  previewVersion: string | null;
  repo: string | null;
  scorePolicy: 'client' | 'server';
  scoreMin: number | null;
  scoreMax: number | null;
  maxBundleBytes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVersion {
  version: string;
  status: 'pending' | 'uploaded' | 'approved' | 'rejected';
  sdkMajor: number;
  uploadedAt: string | null;
  createdAt: string;
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
