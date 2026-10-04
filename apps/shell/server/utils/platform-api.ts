import type { GameSummary } from '../../shared/types/game';
import type { PlayInfo, SdkInfo } from '../../shared/types/play';

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
    getSdk(major: number): Promise<SdkInfo> {
      return fetcher<SdkInfo>(`/v1/sdk/${major}`, { baseURL });
    },
    submitScore(gameId: string, score: number): Promise<{ accepted: boolean }> {
      return fetcher(`/v1/games/${id(gameId)}/scores`, {
        baseURL,
        method: 'POST',
        body: { score },
      });
    },
  };
}

export function usePlatformApi() {
  return createPlatformApi(useRuntimeConfig().apiBase, $fetch as Fetcher);
}
