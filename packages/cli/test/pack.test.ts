import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { packBuild } from '../src/pack.js';
import { makeBundle } from './fixture.js';

describe('packBuild', () => {
  it('zips a valid build with paths relative to the build root', async () => {
    const r = await packBuild(await makeBundle());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.fileCount).toBe(5);
    const files = unzipSync(r.zip ?? new Uint8Array());
    expect(Object.keys(files).toSorted()).toEqual([
      'assets/dep.js',
      'assets/main.js',
      'game.json',
      'index.html',
      'thumb.png',
    ]);
    expect(new TextDecoder().decode(files['index.html'])).toContain('<!doctype html>');
  });

  it('does not zip a build that fails validation', async () => {
    const r = await packBuild(await makeBundle({ 'index.html': null }));
    expect(r.ok).toBe(false);
    expect(r.zip).toBeNull();
    expect(r.errors[0]).toMatch(/entry 'index.html' is not in/);
  });

  it('applies the platform limits before uploading', async () => {
    const many = await packBuild(await makeBundle(), { limits: { maxFiles: 3 } });
    expect(many.ok).toBe(false);
    expect(many.errors).toEqual(['5 files; the limit is 3']);

    const big = await packBuild(await makeBundle({ 'big.bin': Buffer.alloc(2048) }), {
      limits: { maxFileBytes: 1024 },
    });
    expect(big.errors[0]).toMatch(/'big.bin' is 2048 bytes; the limit is 1024/);

    const total = await packBuild(await makeBundle(), { limits: { maxTotalBytes: 10 } });
    expect(total.errors[0]).toMatch(/bytes in total; the limit is 10/);
  });
});
