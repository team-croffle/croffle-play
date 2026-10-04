import { handshake, SdkClient } from './client.js';
import { SdkError } from './errors.js';
import { type Transport, type WindowLike, windowTransport } from './transport.js';
import { SDK_VERSION } from './version.js';

export type { Peer, PublicUser } from '@croffledev/play-protocol';
export { Room, type RoomEvents, type SocketFactory, type SocketLike } from './rooms.js';
export { SdkClient, SdkError, SDK_VERSION, type Transport, windowTransport };

export interface SdkOptions {
  /** Game id, as in `game.json`. */
  game: string;
  /** Host connection. Defaults to the parent window; use `createMockHost()` for local runs. */
  transport?: Transport;
  /** Per-request timeout. Default 10 s. */
  timeoutMs?: number;
  /** How long to wait for the platform to answer `__hello`. Default 10 s. */
  handshakeTimeoutMs?: number;
}

/**
 * Connects to the platform (or a mock host). Resolves once the handshake is done.
 *
 * ```ts
 * const sdk = await createSdk({ game: 'tetris' });
 * if (sdk.has('score')) await sdk.submitScore(1200);
 * ```
 */
export async function createSdk(options: SdkOptions): Promise<SdkClient> {
  const transport = options.transport ?? defaultTransport();
  const { origin, capabilities } = await handshake(
    transport,
    { sdk: SDK_VERSION, game: options.game },
    options.handshakeTimeoutMs ?? 10_000,
  );
  return new SdkClient(transport, origin, capabilities, options.timeoutMs ?? 10_000);
}

function defaultTransport(): Transport {
  if (typeof window === 'undefined' || window.parent === window) {
    throw new SdkError(
      'unsupported',
      'Not running inside Croffle Play. For local development pass `transport: createMockHost()` ' +
        "from '@croffledev/play-sdk/mock'.",
    );
  }
  return windowTransport(window as unknown as WindowLike);
}
