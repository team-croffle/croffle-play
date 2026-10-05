import { createSdk, type SdkClient } from '@croffledev/play-sdk';

import gameJson from '../game.json';

/**
 * Connects to Croffle Play. Outside the platform (`pnpm dev`, `vite preview`) the mock host
 * stands in, so the game runs on its own. The mock is loaded only in that case.
 */
export async function connect(): Promise<SdkClient> {
  if (window.parent !== window) {
    return createSdk({ game: gameJson.id });
  }
  const { createMockHost } = await import('@croffledev/play-sdk/mock');
  return createSdk({ game: gameJson.id, transport: createMockHost() });
}
