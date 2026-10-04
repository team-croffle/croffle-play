import type { GameSummary } from '../../shared/types/game';

type Fetcher = <T>(url: string, opts?: { baseURL?: string }) => Promise<T>;

/** Typed calls to the platform API. Runs on the shell server only. */
export function createPlatformApi(baseURL: string, fetcher: Fetcher) {
  return {
    async listGames(): Promise<GameSummary[]> {
      const res = await fetcher<{ items: GameSummary[] }>('/v1/games', { baseURL });
      return res.items;
    },
    getGame(id: string): Promise<GameSummary> {
      return fetcher<GameSummary>(`/v1/games/${encodeURIComponent(id)}`, { baseURL });
    },
  };
}

export function usePlatformApi() {
  return createPlatformApi(useRuntimeConfig().apiBase, $fetch);
}
