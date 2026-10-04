import { describe, expect, it, vi } from 'vitest';

import { createPlatformApi } from '../server/utils/platform-api';

describe('createPlatformApi', () => {
  it('unwraps the catalog list', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [{ id: 'a' }] });
    const api = createPlatformApi('http://api', fetcher);
    await expect(api.listGames()).resolves.toEqual([{ id: 'a' }]);
    expect(fetcher).toHaveBeenCalledWith('/v1/games', { baseURL: 'http://api' });
  });

  it('encodes the game id', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'x' });
    await createPlatformApi('http://api', fetcher).getGame('a/b');
    expect(fetcher).toHaveBeenCalledWith('/v1/games/a%2Fb', { baseURL: 'http://api' });
  });
});
