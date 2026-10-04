import { describe, expect, it, vi } from 'vitest';

import { findExternalUrls } from '../src/external-urls.js';
import { validateBundle } from '../src/validate.js';
import { makeBundle, manifest } from './fixture.js';

const api = (status: number, body: object) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('validateBundle', () => {
  it('accepts a self-contained bundle', async () => {
    const r = await validateBundle(await makeBundle());
    expect(r.errors).toEqual([]);
    expect(r.manifest?.entry).toBe('index.html');
    expect(r.files.map((f) => f.path)).toEqual([
      'assets/dep.js',
      'assets/main.js',
      'game.json',
      'index.html',
      'thumb.png',
    ]);
  });

  it('reports a missing or invalid manifest', async () => {
    expect((await validateBundle(await makeBundle({ 'game.json': null }))).errors).toEqual([
      'game.json is missing at the bundle root',
    ]);
    const bad = await validateBundle(
      await makeBundle({ 'game.json': JSON.stringify({ ...manifest, id: 'API' }) }),
    );
    expect(bad.errors.join()).toMatch(/game.json id/);
  });

  it('requires the entry and thumbnail files', async () => {
    const r = await validateBundle(await makeBundle({ 'thumb.png': null, 'index.html': null }));
    expect(r.errors).toEqual([
      "game.json entry 'index.html' is not in the bundle",
      "game.json thumbnail 'thumb.png' is not in the bundle",
    ]);
  });

  it('enforces the size limit', async () => {
    const r = await validateBundle(await makeBundle({ 'big.bin': 'x'.repeat(2048) }), {
      maxBytes: 1024,
    });
    expect(r.errors.join()).toMatch(/limit/);
  });

  it('flags external resources', async () => {
    const r = await validateBundle(
      await makeBundle({
        'index.html':
          '<script src="https://cdn.example.com/x.js"></script><a href="https://ok.example">ok</a>',
      }),
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(
      /index.html: external resource '<script src="https:\/\/cdn.example.com/,
    );
  });

  it('checks the SDK major against the platform', async () => {
    const dir = await makeBundle();
    expect((await validateBundle(dir, { api: 'http://api', fetch: api(404, {}) })).errors).toEqual([
      'SDK v1 is not supported by the platform',
    ]);
    expect(
      (
        await validateBundle(dir, {
          api: 'http://api',
          fetch: api(200, { status: 'eol', eolAt: null }),
        })
      ).ok,
    ).toBe(false);
    const maint = await validateBundle(dir, {
      api: 'http://api',
      fetch: api(200, { status: 'maintenance', eolAt: '2027-01-01T00:00:00Z' }),
    });
    expect(maint.ok).toBe(true);
    expect(maint.warnings[0]).toMatch(/maintenance \(end of life 2027-01-01\)/);
  });
});

describe('findExternalUrls', () => {
  it.each([
    ['html', '<link rel="stylesheet" href="//fonts.example/x.css">'],
    ['html', '<img srcset="https://x.example/a.png 2x">'],
    ['css', 'body { background: url("https://x.example/bg.png") }'],
    ['css', '@import url(https://x.example/a.css);'],
    ['js', 'import("https://x.example/m.js")'],
    ['js', 'export * from "https://x.example/m.js"'],
    ['js', 'importScripts("https://x.example/w.js")'],
  ] as const)('%s: %s', (kind, text) => {
    expect(findExternalUrls(kind, text).length).toBeGreaterThan(0);
  });

  it.each([
    ['html', '<a href="https://example.com">site</a>'],
    ['html', '<script src="./main.js"></script>'],
    ['css', 'body { background: url(./bg.png) }'],
    ['js', 'const help = "see https://example.com"'],
  ] as const)('ignores %s: %s', (kind, text) => {
    expect(findExternalUrls(kind, text)).toEqual([]);
  });
});
