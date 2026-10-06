export interface MyGame {
  id: string;
  name: string;
  role: 'owner' | 'developer';
  listed: boolean;
  hosting: 'team' | 'platform';
  /** Where the game is served (by the team or by the platform). */
  url: string;
  manifestFetchedAt: string | null;
  sdk: { major: number; status: string; deprecatedAt: string | null } | null;
  warnings: string[];
}
