export interface MyGame {
  id: string;
  name: string;
  role: 'owner' | 'developer';
  listed: boolean;
  /** Where the team hosts the game. */
  url: string;
  manifestFetchedAt: string | null;
  sdk: { major: number; status: string; deprecatedAt: string | null } | null;
  warnings: string[];
}
