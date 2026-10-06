/** One uploaded build of a platform-hosted game (API `DeployView`). */
export interface DeployView {
  id: string;
  gameId: string;
  /** Served right now. */
  active: boolean;
  size: number;
  fileCount: number;
  /** `game.json` version of that build, when it had one. */
  version: string | null;
  uploadedBy: string | null;
  deployKeyId: string | null;
  createdAt: string;
}

export type GameHosting = 'team' | 'platform';
