import { describe, expect, it, vi } from 'vitest';

import { PublishError, publishBundle } from '../src/publish.js';
import { makeBundle } from './fixture.js';

function api(overrides: { complete?: Response; putStatus?: number[] } = {}) {
  const calls: { method: string; url: string; headers?: RequestInit['headers']; body?: unknown }[] =
    [];
  const putStatus = [...(overrides.putStatus ?? [])];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      method: init?.method ?? 'GET',
      url,
      ...(init?.headers ? { headers: init.headers } : {}),
      body: init?.body,
    });
    if (url.endsWith('/v1/sdk/1')) {
      return Response.json({ major: 1, status: 'current', eolAt: null });
    }
    if (url.endsWith('/v1/games/tetris/versions')) {
      const { files } = JSON.parse(String(init?.body)) as { files: { path: string }[] };
      return Response.json(
        {
          uploads: files.map((f) => ({
            path: f.path,
            url: `https://s3.test/${f.path}`,
            method: 'PUT',
            headers: { 'x-amz-checksum-sha256': 'h' },
          })),
        },
        { status: 201 },
      );
    }
    if (url.startsWith('https://s3.test/')) {
      return new Response('', { status: putStatus.shift() ?? 200 });
    }
    if (url.endsWith('/complete')) {
      return (
        overrides.complete ??
        Response.json({ version: '1.0.0', previewUrl: 'https://tetris.g.test/1.0.0/index.html' })
      );
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe('publishBundle', () => {
  it('declares, uploads every file, and completes', async () => {
    const { fetcher, calls } = api();
    const res = await publishBundle(await makeBundle({ 'Build/game.wasm.br': 'br' }), {
      api: 'https://api.test',
      key: 'cpk_tetris_x',
      fetch: fetcher,
    });
    expect(res.previewUrl).toBe('https://tetris.g.test/1.0.0/index.html');
    const declare = calls.find((c) => c.method === 'POST');
    expect(declare).toMatchObject({
      method: 'POST',
      url: 'https://api.test/v1/games/tetris/versions',
    });
    expect(declare?.headers).toMatchObject({ authorization: 'Bearer cpk_tetris_x' });
    const body = JSON.parse(String(declare?.body)) as {
      files: { path: string; sha256: string; contentEncoding?: string }[];
    };
    expect(body.files.find((f) => f.path === 'Build/game.wasm.br')?.contentEncoding).toBe('br');
    expect(body.files.every((f) => /^[A-Za-z0-9+/]{43}=$/.test(f.sha256))).toBe(true);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(6);
    expect(calls.at(-1)?.url).toBe('https://api.test/v1/games/tetris/versions/1.0.0/complete');
  });

  it('retries a failed upload', async () => {
    const { fetcher, calls } = api({ putStatus: [503] });
    await publishBundle(await makeBundle(), {
      api: 'https://api.test',
      key: 'k',
      fetch: fetcher,
      concurrency: 1,
    });
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(6);
  });

  it('stops on an invalid bundle before declaring anything', async () => {
    const { fetcher, calls } = api();
    await expect(
      publishBundle(await makeBundle({ 'thumb.png': null }), {
        api: 'https://api.test',
        key: 'k',
        fetch: fetcher,
      }),
    ).rejects.toBeInstanceOf(PublishError);
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  it('surfaces API problems', async () => {
    const { fetcher } = api({
      complete: Response.json(
        { message: 'Upload incomplete', problems: [{ path: 'a.js', problem: 'missing' }] },
        { status: 422 },
      ),
    });
    await expect(
      publishBundle(await makeBundle(), { api: 'https://api.test', key: 'k', fetch: fetcher }),
    ).rejects.toThrow(/422: \[\{"path":"a.js","problem":"missing"\}\]/);
  });
});
