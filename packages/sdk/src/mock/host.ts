import {
  capabilities as allCapabilities,
  event,
  fail,
  isRequestType,
  ok,
  parseEnvelope,
  parseHello,
  type PublicUser,
  type RequestType,
  requests,
} from '@croffledev/play-protocol';
import * as v from 'valibot';

import type { Transport } from '../transport.js';
import { defaultStorage, type MockStorage } from './storage.js';

export interface MockHostOptions {
  /** Player returned by `getUser`. `null` simulates a guest. */
  user?: PublicUser | null;
  /**
   * Capabilities announced in `__welcome`. Default: every v1 capability except `token` and
   * `rooms` — multiplayer needs the real rooms server (`pnpm dev:rooms` with the platform).
   */
  capabilities?: string[];
  /** Where saves go. Default: localStorage (memory when unavailable). */
  storage?: MockStorage;
  /** Log every message to the console. Default true. */
  log?: boolean;
}

export interface MockHost extends Transport {
  /** Push a host event to the game (`pause`, `resume`). */
  emit(type: 'pause' | 'resume'): void;
  /** Scores submitted so far, newest last. */
  readonly scores: readonly number[];
}

const MOCK_ORIGIN = 'mock://croffle-play';

/**
 * A fake platform for running a game alone (`vite dev`). Answers the handshake and every v1
 * request in-page, validating payloads with the same schemas as the real host.
 *
 * ```ts
 * const sdk = await createSdk({ game: 'tetris', transport: createMockHost() });
 * ```
 */
export function createMockHost(options: MockHostOptions = {}): MockHost {
  const user =
    options.user === undefined
      ? { id: 'mock-user', nickname: 'Player', avatar: null }
      : options.user;
  const caps =
    options.capabilities ?? allCapabilities.filter((c) => c !== 'token' && c !== 'rooms');
  const storage = options.storage ?? defaultStorage();
  const log = options.log ?? true;
  const listeners = new Set<(message: unknown, origin: string) => void>();
  const scores: number[] = [];
  let game = 'unknown';

  const toGame = (message: unknown) => {
    // Async like postMessage, so callers never observe re-entrancy.
    queueMicrotask(() => {
      for (const l of listeners) {
        l(structuredClone(message), MOCK_ORIGIN);
      }
    });
  };
  const trace = (dir: string, message: unknown) => {
    if (log) {
      // oxlint-disable-next-line no-console
      console.debug(`[croffle-play mock] ${dir}`, message);
    }
  };

  const handle = (type: RequestType, payload: unknown): unknown => {
    switch (type) {
      case 'ready':
      case 'exit':
        return undefined;
      case 'getUser':
        return user;
      case 'submitScore': {
        const { score } = payload as { score: number };
        scores.push(score);
        return { accepted: user !== null };
      }
      case 'save': {
        const { slot, data } = payload as { slot: string; data: string };
        storage.set(`croffle-play:mock:${game}:${slot}`, data);
        return undefined;
      }
      case 'load': {
        const { slot } = payload as { slot: string };
        return { data: storage.get(`croffle-play:mock:${game}:${slot}`) };
      }
      case 'fullscreen':
        return { on: (payload as { on: boolean }).on };
      case 'getToken':
      case 'getRoomsUrl':
        throw new Error('unsupported');
      case 'getLeaderboard': {
        const best = scores.length > 0 && user ? Math.max(...scores) : null;
        return { entries: best === null || !user ? [] : [{ rank: 1, user, score: best }] };
      }
    }
  };

  return {
    scores,
    emit(type) {
      trace('→', type);
      toGame(event(type));
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send(message) {
      trace('←', message);
      const hello = parseHello(message);
      if (hello) {
        game = hello.game;
        toGame({ type: '__welcome', capabilities: caps });
        return;
      }
      const req = parseEnvelope(message);
      if (req?.kind !== 'req') {
        return;
      }
      if (!isRequestType(req.type)) {
        toGame(fail(req.id, { code: 'unsupported', message: `Unknown request '${req.type}'` }));
        return;
      }
      if (!v.is(requests[req.type].request, req.payload)) {
        toGame(fail(req.id, { code: 'invalid_request', message: `Invalid '${req.type}' payload` }));
        return;
      }
      if (user === null && (req.type === 'save' || req.type === 'load')) {
        toGame(fail(req.id, { code: 'auth_required', message: 'Guests cannot save' }));
        return;
      }
      try {
        toGame(ok(req.id, handle(req.type, req.payload)));
      } catch {
        toGame(
          fail(req.id, { code: 'unsupported', message: `The mock host has no '${req.type}'` }),
        );
      }
    },
  };
}
