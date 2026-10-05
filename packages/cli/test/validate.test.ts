import { describe, expect, it, vi } from 'vitest';

import { validateBuild } from '../src/validate.js';
import { makeBundle, manifest, pngHeader } from './fixture.js';

const api = (status: number, body: object) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('validateBuild', () => {
  it('accepts a build with game.json, entry, and thumbnail', async () => {
    const r = await validateBuild(await makeBundle());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.manifest?.entry).toBe('index.html');
  });

  it('reports a missing or invalid game.json', async () => {
    expect((await validateBuild(await makeBundle({ 'game.json': null }))).errors[0]).toMatch(
      /game.json is missing/,
    );
    const bad = await validateBuild(
      await makeBundle({ 'game.json': JSON.stringify({ ...manifest, id: 'API' }) }),
    );
    expect(bad.errors.join()).toMatch(/game.json id/);
  });

  it('requires the entry and thumbnail files', async () => {
    const r = await validateBuild(await makeBundle({ 'thumb.png': null, 'index.html': null }));
    expect(r.errors).toEqual([
      expect.stringMatching(/entry 'index.html' is not in/),
      "game.json thumbnail 'thumb.png' is not in the build",
    ]);
  });

  it('only recommends thumbnail size and format', async () => {
    const small = await validateBuild(await makeBundle({ 'thumb.png': pngHeader(64, 64) }));
    expect(small.ok).toBe(true);
    expect(small.warnings[0]).toMatch(/64×64; 256×144 or larger/);
    const none = await validateBuild(
      await makeBundle({ 'game.json': JSON.stringify({ ...manifest, thumbnail: undefined }) }),
    );
    expect(none.warnings).toEqual(['game.json has no thumbnail; the catalog shows a placeholder']);
  });

  it('checks the SDK major against the platform lifecycle', async () => {
    const dir = await makeBundle();
    expect((await validateBuild(dir, { api: 'http://api', fetch: api(404, {}) })).errors).toEqual([
      'SDK v1 is not supported by the platform',
    ]);
    const old = await validateBuild(dir, {
      api: 'http://api',
      fetch: api(200, { status: 'old', deprecatedAt: '2027-01-01T00:00:00Z' }),
    });
    expect(old.errors[0]).toMatch(/SDK v1 is old \(deprecated from 2027-01-01\)/);
    const gone = await validateBuild(dir, {
      api: 'http://api',
      fetch: api(200, { status: 'deprecated', deprecatedAt: null }),
    });
    expect(gone.errors[0]).toMatch(/deprecated/);
    const ok = await validateBuild(dir, {
      api: 'http://api',
      fetch: api(200, { status: 'lts', deprecatedAt: null }),
    });
    expect(ok.ok).toBe(true);
  });
});
