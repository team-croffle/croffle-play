import type {
  HostApiError,
  HostCore,
  HttpMethod,
  PublicUser,
} from '@croffledev/play-protocol/host';

export interface HostCoreOptions {
  gameId: string;
  version: string;
  /** Element shown fullscreen for `ui.setFullscreen(true)`. */
  stage: () => HTMLElement | null;
  onGameReady: () => void;
  onNotify: (message: string) => void;
  onExit: () => void;
  getUser?: () => Promise<PublicUser | null>;
  fetchJson?: <T>(path: string, init: { method: HttpMethod; body?: unknown }) => Promise<T>;
  doc?: Document;
}

/**
 * The shell core given to adapters: identity, api, ui, lifecycle — nothing else
 * (design invariant 6). `api` reaches only this shell's own `/api/*` routes.
 */
export function createHostCore(o: HostCoreOptions): HostCore {
  const doc = o.doc ?? document;
  const fetchJson = o.fetchJson ?? defaultFetchJson;
  return {
    identity: { getUser: o.getUser ?? (async () => null) },
    async api<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
      if (!/^[a-z0-9][\w./-]*$/i.test(path) || path.includes('..')) {
        throw httpError(400, `Invalid core.api path '${path}'`);
      }
      return fetchJson<T>(`/api/${path}`, { method, body });
    },
    ui: {
      gameReady: o.onGameReady,
      notify: o.onNotify,
      requestLogin: () => o.onNotify('로그인하면 이 기능을 사용할 수 있습니다.'),
      async setFullscreen(on) {
        try {
          if (on && !doc.fullscreenElement) {
            await o.stage()?.requestFullscreen();
          } else if (!on && doc.fullscreenElement) {
            await doc.exitFullscreen();
          }
        } catch {
          // Refused by the browser (no user gesture); report the actual state.
        }
        return doc.fullscreenElement !== null;
      },
    },
    lifecycle: {
      gameId: o.gameId,
      version: o.version,
      exit: o.onExit,
      onVisibility(listener) {
        const handler = () => listener(doc.visibilityState === 'visible');
        doc.addEventListener('visibilitychange', handler);
        return () => doc.removeEventListener('visibilitychange', handler);
      },
    },
  };
}

function httpError(status: number, message: string): HostApiError {
  return Object.assign(new Error(message), { status });
}

async function defaultFetchJson<T>(
  path: string,
  init: { method: HttpMethod; body?: unknown },
): Promise<T> {
  try {
    const res: unknown = await $fetch(path, {
      method: init.method,
      ...(init.body === undefined ? {} : { body: init.body as Record<string, unknown> }),
    });
    return res as T;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    throw httpError(status, `core.api ${init.method} ${path} → ${status}`);
  }
}
