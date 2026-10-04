import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { loadAdapter, verifyIntegrity } from '../app/utils/adapter-loader';

const code = 'export const major = 1; export function mount() {}';
const bytes = new TextEncoder().encode(code);
const sri = `sha384-${createHash('sha384').update(code).digest('base64')}`;
const okFetch = vi.fn(async () => new Response(bytes)) as unknown as typeof fetch;

describe('verifyIntegrity', () => {
  it('accepts a matching hash and rejects anything else', async () => {
    expect(await verifyIntegrity(bytes.buffer, sri)).toBe(true);
    expect(await verifyIntegrity(new TextEncoder().encode(`${code} `).buffer, sri)).toBe(false);
    expect(await verifyIntegrity(bytes.buffer, 'md5-abc')).toBe(false);
    expect(await verifyIntegrity(bytes.buffer, '')).toBe(false);
  });
});

describe('loadAdapter', () => {
  it('imports a verified bundle from a blob URL', async () => {
    const importModule = vi.fn(async (url: string) => {
      expect(url).toMatch(/^blob:/);
      return { major: 1, mount: () => ({ capabilities: [], dispose() {} }) };
    });
    const mod = await loadAdapter('https://cdn.test/a.js', sri, { fetch: okFetch, importModule });
    expect(mod.major).toBe(1);
  });

  it('refuses tampered bundles before importing them', async () => {
    const importModule = vi.fn();
    const tampered = vi.fn(async () => new Response(`${code};alert(1)`)) as unknown as typeof fetch;
    await expect(
      loadAdapter('https://cdn.test/a.js', sri, { fetch: tampered, importModule }),
    ).rejects.toThrow(/integrity/);
    expect(importModule).not.toHaveBeenCalled();
  });

  it('refuses modules that are not adapters and failed downloads', async () => {
    await expect(
      loadAdapter('u', sri, { fetch: okFetch, importModule: async () => ({}) }),
    ).rejects.toThrow(/adapter/);
    const notFound = vi.fn(
      async () => new Response('', { status: 404 }),
    ) as unknown as typeof fetch;
    await expect(loadAdapter('u', sri, { fetch: notFound })).rejects.toThrow(/404/);
  });
});
