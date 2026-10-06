import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import { deployBuild } from '../src/deploy.js';
import { makeBundle, manifest } from './fixture.js';

const KEY = 'cdk_tetris_secret';

function api(status: number, body: object) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const deployed = { id: 'd-1', gameId: 'tetris', version: '1.0.0', fileCount: 5, size: 1234 };

describe('deployBuild', () => {
  it('packs a directory and posts it with the deploy key for the game.json id', async () => {
    const { fetcher, calls } = api(201, deployed);
    const r = await deployBuild(await makeBundle(), {
      api: 'https://api.test/',
      key: KEY,
      fetch: fetcher,
    });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.deploy).toEqual(deployed);
    expect(calls[0]?.url).toBe('https://api.test/v1/games/tetris/deploys');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
    expect(headers['content-type']).toBe('application/zip');
    expect(calls[0]?.init.body).toBeInstanceOf(Uint8Array);
  });

  it('sends a zip as is, reading the game id from its game.json', async () => {
    const dir = await makeBundle();
    const file = join(dir, 'build.zip');
    await writeFile(
      file,
      zipSync({
        'dist/game.json': new TextEncoder().encode(JSON.stringify(manifest)),
        'dist/index.html': new TextEncoder().encode('x'),
      }),
    );
    const { fetcher, calls } = api(201, deployed);
    const r = await deployBuild(file, { api: 'https://api.test', key: KEY, fetch: fetcher });
    expect(r.ok).toBe(true);
    expect(calls[0]?.url).toBe('https://api.test/v1/games/tetris/deploys');

    const explicit = api(201, deployed);
    await deployBuild(file, {
      api: 'https://api.test',
      key: KEY,
      game: 'other',
      fetch: explicit.fetcher,
    });
    expect(explicit.calls[0]?.url).toBe('https://api.test/v1/games/other/deploys');
  });

  it('explains refusals without ever printing the key', async () => {
    const dir = await makeBundle();
    const cases: [number, object, RegExp][] = [
      [401, { message: 'A valid deploy key is required' }, /refused the deploy key/],
      [403, { message: 'This deploy key belongs to another game' }, /another game/],
      [404, { message: "Game 'tetris' not found" }, /not registered/],
      [400, { message: "'../x' is not a path inside the build" }, /upload refused \(400\)/],
      [422, { message: 'SDK v1 is old' }, /SDK v1 is old/],
    ];
    for (const [status, body, expected] of cases) {
      const r = await deployBuild(dir, {
        api: 'https://api.test',
        key: KEY,
        fetch: api(status, body).fetcher,
      });
      expect(r.ok).toBe(false);
      expect(r.errors.join()).toMatch(expected);
      expect(JSON.stringify(r)).not.toContain(KEY);
    }
  });

  it('stops before uploading when the build is invalid', async () => {
    const { fetcher } = api(201, deployed);
    const r = await deployBuild(await makeBundle({ 'game.json': null }), {
      api: 'https://api.test',
      key: KEY,
      fetch: fetcher,
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/game.json is missing/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
