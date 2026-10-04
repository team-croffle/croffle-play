import type { GameSummary } from '../../shared/types/game';
import type { Leaderboard, PlayInfo, SdkInfo } from '../../shared/types/play';

interface FetchOptions {
  baseURL?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

type Fetcher = <T>(url: string, opts?: FetchOptions) => Promise<T>;

const id = (s: string) => encodeURIComponent(s);

/** Typed calls to the platform API. Runs on the shell server only. */
export function createPlatformApi(baseURL: string, fetcher: Fetcher) {
  return {
    async listGames(): Promise<GameSummary[]> {
      const res = await fetcher<{ items: GameSummary[] }>('/v1/games', { baseURL });
      return res.items;
    },
    getGame(gameId: string): Promise<GameSummary> {
      return fetcher<GameSummary>(`/v1/games/${id(gameId)}`, { baseURL });
    },
    getPlayInfo(gameId: string, version?: string): Promise<PlayInfo> {
      return fetcher<PlayInfo>(`/v1/games/${id(gameId)}/play`, {
        baseURL,
        ...(version ? { query: { version } } : {}),
      });
    },
    getLeaderboard(gameId: string, limit: number): Promise<Leaderboard> {
      return fetcher(`/v1/games/${id(gameId)}/leaderboard`, {
        baseURL,
        query: { limit: String(limit) },
      });
    },
    getServer(gameId: string): Promise<{ url: string; protocol: string }> {
      return fetcher(`/v1/games/${id(gameId)}/server`, { baseURL });
    },
    getSdk(major: number): Promise<SdkInfo> {
      return fetcher<SdkInfo>(`/v1/sdk/${major}`, { baseURL });
    },
  };
}

export function usePlatformApi() {
  return createPlatformApi(useRuntimeConfig().apiBase, $fetch as Fetcher);
}
