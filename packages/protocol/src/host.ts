/**
 * Contract between the shell core and host adapters (design invariant 6). The core exposes only
 * `identity`, `api`, `ui`, and `lifecycle`; an adapter translates one SDK major's messages into
 * calls on it. Changing this interface means a shell release, so keep it small.
 */
import type { PublicUser } from './v1/messages.js';

export type { PublicUser };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Error thrown by `HostCore.api` for non-2xx responses. */
export interface HostApiError extends Error {
  status: number;
}

export interface HostCore {
  identity: {
    /** Signed-in player's public profile, or null for guests. */
    getUser(): Promise<PublicUser | null>;
  };
  /**
   * Calls the shell's own server (`/api/<path>`) with the player's session. Paths are relative,
   * e.g. `games/tetris/scores`. Rejects with `HostApiError` on non-2xx.
   */
  api<T = unknown>(method: HttpMethod, path: string, body?: unknown): Promise<T>;
  ui: {
    /** The game finished loading (`sdk.ready()`): hide the platform loading screen. */
    gameReady(): void;
    setFullscreen(on: boolean): Promise<boolean>;
    /** Short non-blocking message to the player. */
    notify(message: string): void;
    /** Ask the player to sign in (does not navigate away from the game by itself). */
    requestLogin(): void;
  };
  lifecycle: {
    readonly gameId: string;
    /** Game version if the host knows it; empty on Croffle Play (teams host their own games). */
    readonly version: string;
    /** Leave the game (back to its detail page). */
    exit(): void;
    /** Called with false when the page is hidden and true when shown again. */
    onVisibility(listener: (visible: boolean) => void): () => void;
  };
}

/** Message channel to the game frame. The shell has already checked source and origin. */
export interface GamePort {
  post(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
}

export interface AdapterContext {
  core: HostCore;
  port: GamePort;
  /** Version from the game's `__hello`. */
  sdkVersion: string;
}

export interface MountedAdapter {
  /** Sent to the game in `__welcome`. */
  capabilities: string[];
  dispose(): void;
}

/** Shape of an adapter bundle's module namespace (`adapters/v<major>/<ver>/index.js`). */
export interface AdapterModule {
  readonly major: number;
  mount(ctx: AdapterContext): MountedAdapter;
}
